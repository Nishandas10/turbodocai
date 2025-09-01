import { OpenAI } from "openai";
import { logger } from "firebase-functions";
import { EmbeddingService } from "./embeddingService";
import { PineconeService } from "./pineconeService";

interface QueryResult {
  answer: string;
  sources: Array<{
    documentId: string;
    title: string;
    fileName?: string;
    chunk: string;
    score: number;
  }>;
  confidence: number;
}

export class QueryService {
  private openai: OpenAI;
  private embeddingService: EmbeddingService;
  private pineconeService: PineconeService;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });

    this.embeddingService = new EmbeddingService();
    this.pineconeService = new PineconeService();
  }

  /**
   * Query the RAG system with a question
   */
  async queryRAG(
    question: string,
    userId: string,
    documentId?: string,
    topK: number = 5
  ): Promise<QueryResult> {
    try {
      logger.info(`Processing RAG query for user ${userId}: ${question}`);

      // Step 1: Generate embedding for the question
      const queryEmbedding = await this.embeddingService.embedQuery(question);

      // Step 2: Search Pinecone for similar chunks
      const similarChunks = await this.pineconeService.querySimilarChunks(
        queryEmbedding,
        userId,
        topK,
        documentId
      );

      if (similarChunks.length === 0) {
        return {
          answer:
            "I couldn't find any relevant information to answer your question. Please make sure you have uploaded and processed documents.",
          sources: [],
          confidence: 0,
        };
      }

      // Step 3: Combine chunks into context
      const context = similarChunks
        .map((chunk) => `[Source: ${chunk.title}] ${chunk.chunk}`)
        .join("\n\n");

      // Step 4: Generate answer using GPT-4o-mini
      const answer = await this.generateAnswer(question, context);

      // Calculate confidence based on similarity scores
      const avgScore =
        similarChunks.reduce((sum, chunk) => sum + chunk.score, 0) /
        similarChunks.length;
      const confidence = Math.min(avgScore * 100, 95); // Cap at 95%

      return {
        answer,
        sources: similarChunks.map((chunk) => ({
          documentId: chunk.documentId,
          title: chunk.title,
          fileName: chunk.fileName,
          chunk: chunk.chunk.substring(0, 200) + "...", // Truncate for display
          score: chunk.score,
        })),
        confidence,
      };
    } catch (error) {
      logger.error("Error in queryRAG:", error);
      throw new Error("Failed to process query");
    }
  }

  /**
   * Generate answer using OpenAI
   */
  private async generateAnswer(
    question: string,
    context: string
  ): Promise<string> {
    try {
      const prompt = this.buildPrompt(question, context);

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a helpful AI assistant that answers questions based on provided document context. 
            Always base your answers on the given context and cite sources when possible. 
            If the context doesn't contain enough information to answer the question, say so clearly.
            Keep your answers concise but comprehensive.`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      });

      return (
        response.choices[0]?.message?.content ||
        "I couldn't generate an answer."
      );
    } catch (error) {
      logger.error("Error generating answer:", error);
      throw new Error("Failed to generate answer");
    }
  }

  /**
   * Build the prompt for the LLM
   */
  private buildPrompt(question: string, context: string): string {
    return `Please answer the following question using only the provided context. If the context doesn't contain enough information to answer the question, please say so.

Context:
${context}

Question: ${question}

Answer:`;
  }

  /**
   * Generate a summary of a document
   */
  async generateDocumentSummary(
    documentId: string,
    userId: string,
    maxLength: number = 500
  ): Promise<string> {
    try {
      // First attempt to infer chunkCount from a representative vector (by querying 1 similar vector)
      // Fallback: assume up to 1000 chunks cap
      let chunkCount = 0;
      try {
        const probe = await this.pineconeService.querySimilarChunks(
          new Array(1024).fill(0),
          userId,
          1,
          documentId
        );
        if (probe.length) {
          // Try to parse highest index by querying a wider set
          const broader = await this.pineconeService.querySimilarChunks(
            new Array(1024).fill(0),
            userId,
            50,
            documentId
          );
          const indices = broader
            .map((m) => parseInt(m.id.split("_").pop() || "0", 10))
            .filter((n) => !isNaN(n));
          if (indices.length) chunkCount = Math.max(...indices) + 1;
        }
      } catch (e) {
        // ignore
      }
      if (chunkCount === 0) chunkCount = 300; // safe default

      // Fetch ordered chunks (limit for summarization efficiency)
      const MAX_CHUNKS_FOR_SUMMARY = 200; // tuneable
      const ordered = await this.pineconeService.fetchDocumentChunks(
        documentId,
        userId,
        chunkCount,
        MAX_CHUNKS_FOR_SUMMARY
      );

      if (!ordered.length) return "No content available for summary.";

      // Map-Reduce style summarization for very large documents
      const PART_SIZE_CHARS = 6000; // each part fed to model
      const parts: string[] = [];
      let buffer = "";
      for (const c of ordered) {
        if (buffer.length + c.chunk.length > PART_SIZE_CHARS) {
          parts.push(buffer);
          buffer = "";
        }
        buffer += (buffer ? " " : "") + c.chunk;
      }
      if (buffer) parts.push(buffer);

      const intermediateSummaries: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].substring(0, PART_SIZE_CHARS);
        const resp = await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You summarize document sections. Produce a concise bullet summary of the section's key points.`,
            },
            {
              role: "user",
              content: `Section ${i + 1} of ${
                parts.length
              } (truncate if noisy):\n\n${part}`,
            },
          ],
          max_tokens: 300,
          temperature: 0.2,
        });
        const partial = resp.choices[0]?.message?.content?.trim();
        if (partial) intermediateSummaries.push(partial);
        if (intermediateSummaries.length >= 12) break; // prevent runaway cost
      }

      // Final synthesis
      const synthesisInput = intermediateSummaries
        .join("\n\n")
        .substring(0, 8000);

      const finalResp = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert summarizer. Merge bullet summaries into a single cohesive summary (~${maxLength} words). Emphasize core concepts, structure logically, avoid redundancy.`,
          },
          {
            role: "user",
            content: synthesisInput,
          },
        ],
        max_tokens: Math.ceil(maxLength * 1.6),
        temperature: 0.25,
      });

      return (
        finalResp.choices[0]?.message?.content || "Could not generate summary."
      );
    } catch (error) {
      logger.error("Error generating document summary:", error);
      throw new Error("Failed to generate document summary");
    }
  }
}
