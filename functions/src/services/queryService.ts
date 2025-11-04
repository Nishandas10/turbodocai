import { OpenAI } from "openai";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";

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

export interface GeneratedFlashcard {
  front: string; // question / prompt
  back: string; // answer / explanation
  category: string; // semantic grouping e.g., Definition / Concept / Fact
}

export interface GeneratedQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

export class QueryService {
  private openai: OpenAI;
  // Pinecone removed; using OpenAI Vector Store and content fallbacks.

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }

    this.openai = new OpenAI({
      apiKey: apiKey,
    });
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

      // If a specific document is targeted and it has OpenAI Vector Store metadata, use OpenAI file_search
      if (documentId) {
        try {
          const db = getFirestore();
          const snap = await db
            .collection("documents")
            .doc(userId)
            .collection("userDocuments")
            .doc(documentId)
            .get();
          const data = (snap.data() as any) || {};
          let vsId: string | undefined =
            data?.metadata?.openaiVector?.vectorStoreId;
          const isDocxPptxTxt =
            ["docx", "pptx", "text"].includes(
              String(data?.type || "").toLowerCase()
            ) ||
            String(data?.metadata?.mimeType || "").includes("word") ||
            String(data?.metadata?.mimeType || "").includes("presentation") ||
            String(data?.metadata?.mimeType || "").includes("text/plain");
          if (!vsId && isDocxPptxTxt && data?.metadata?.openaiVector) {
            vsId =
              process.env.OPENAI_VECTOR_STORE_ID ||
              "vs_68f1528dad6c8191bfb8a090e1557a86";
          }
          if (vsId) {
            logger.info("Routing query to OpenAI Vector Store file_search", {
              documentId,
              vsId,
            });
            const answer = await this.answerWithOpenAIVectorStore(
              question,
              vsId
            );
            const title = data?.title || "Document";
            const fileName = data?.metadata?.fileName as string | undefined;
            return {
              answer,
              sources: [
                {
                  documentId,
                  title,
                  fileName,
                  chunk: "Retrieved via OpenAI Vector Store file search",
                  score: 1.0,
                },
              ],
              confidence: 80,
            };
          }
        } catch (e) {
          logger.warn("OpenAI Vector Store routing failed, falling back", e);
        }
      }

      // Prefer vector store if available for this document
      {
        if (documentId) {
          try {
            const db = getFirestore();
            const snap = await db
              .collection("documents")
              .doc(userId)
              .collection("userDocuments")
              .doc(documentId)
              .get();
            if (snap.exists) {
              const data = snap.data() as {
                title?: string;
                metadata?: {
                  fileName?: string;
                  downloadURL?: string;
                  openaiVector?: { vectorStoreId?: string };
                };
                content?: { raw?: string; processed?: string };
                summary?: string;
              };
              let vsId: string | undefined =
                data?.metadata?.openaiVector?.vectorStoreId;
              if (vsId) {
                logger.info("Answering via OpenAI Vector Store", {
                  documentId,
                  vsId,
                });
                try {
                  const answer = await this.answerWithOpenAIVectorStore(
                    question,
                    vsId
                  );
                  return {
                    answer,
                    sources: [
                      {
                        documentId,
                        title: data.title || "Document",
                        fileName: data?.metadata?.fileName,
                        chunk: "Retrieved via OpenAI Vector Store file search",
                        score: 1.0,
                      },
                    ],
                    confidence: 80,
                  };
                } catch (e) {
                  logger.warn(
                    "Vector store answering failed, falling back",
                    e as any
                  );
                }
              }
              let context = (
                data.summary ||
                data.content?.raw ||
                data.content?.processed ||
                ""
              ).slice(0, 24000);
              if (!context || context.length < 80) {
                const url = data.metadata?.downloadURL;
                if (url) {
                  try {
                    const res = await fetch(url);
                    if (res.ok) {
                      const txt = await res.text();
                      context = (txt || "").slice(0, 24000);
                    }
                  } catch (e) {
                    logger.warn(
                      "queryRAG downloadURL fallback failed",
                      e as any
                    );
                  }
                }
              }
              if (context && context.length >= 80) {
                const answer = await this.generateAnswer(question, context);
                const sourceTitle = data.title || "Document";
                const fileName = data.metadata?.fileName;
                return {
                  answer,
                  sources: [
                    {
                      documentId,
                      title: sourceTitle,
                      fileName,
                      chunk:
                        context.slice(0, 200) +
                        (context.length > 200 ? "..." : ""),
                      score: 0.99,
                    },
                  ],
                  confidence: 70,
                };
              }
            }
          } catch (fbErr) {
            logger.warn(
              "queryRAG Firestore/content fallback failed",
              fbErr as any
            );
          }
        }
        // Still nothing useful
        return {
          answer:
            "I couldn't find enough context from this document yet. Try again after processing finishes or ensure the document has accessible text.",
          sources: [],
          confidence: 0,
        };
      }
      // Multi-doc path not implemented for vector store yet; fall back to insufficient context
      return {
        answer:
          "I can answer best when a specific document is provided. Please attach a document with vector indexing.",
        sources: [],
        confidence: 0,
      };
    } catch (error) {
      logger.error("Error in queryRAG:", error);
      throw new Error("Failed to process query");
    }
  }

  /**
   * Answer a question using OpenAI Assistants API with file_search tool over a vector store id.
   */
  private async answerWithOpenAIVectorStore(
    question: string,
    vectorStoreId: string
  ): Promise<string> {
    try {
      // Create a temporary assistant with file_search enabled on the vector store
      const assistant = await this.openai.beta.assistants.create({
        model: "gpt-4o-mini",
        instructions:
          "You are a helpful assistant that answers questions based strictly on the provided documents. Use the file_search tool to find relevant information and ground your answers only on retrieved content. If you cannot find the information in the documents, say so clearly.",
        tools: [{ type: "file_search" }],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreId],
          },
        },
      });

      // Create a thread and add the user's question
      const thread = await this.openai.beta.threads.create({
        messages: [
          {
            role: "user",
            content: question,
          },
        ],
      });

      // Run the assistant
      const run = await this.openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      });

      // Wait for completion and get the response
      let runStatus = await this.openai.beta.threads.runs.retrieve(
        thread.id,
        run.id
      );
      while (
        runStatus.status === "queued" ||
        runStatus.status === "in_progress"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        runStatus = await this.openai.beta.threads.runs.retrieve(
          thread.id,
          run.id
        );
      }

      if (runStatus.status === "completed") {
        const messages = await this.openai.beta.threads.messages.list(
          thread.id
        );
        const assistantMessage = messages.data.find(
          (msg) => msg.role === "assistant"
        );
        const textContent = assistantMessage?.content.find(
          (content) => content.type === "text"
        );
        const answer =
          textContent?.text?.value || "I couldn't generate an answer.";

        // Clean up temporary assistant
        await this.openai.beta.assistants.del(assistant.id);

        return answer;
      } else {
        // Clean up temporary assistant on failure
        await this.openai.beta.assistants.del(assistant.id);
        throw new Error(
          `Assistant run failed with status: ${runStatus.status}`
        );
      }
    } catch (err) {
      logger.error("answerWithOpenAIVectorStore failed", err as any);
      throw err;
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
   * Summarize a document using OpenAI Assistants API with file_search over a vector store.
   * This asks the model to produce a structured markdown summary grounded only on the attached store.
   */
  private async summarizeWithOpenAIVectorStore(
    vectorStoreId: string,
    maxLength: number,
    title: string
  ): Promise<string> {
    try {
      const prompt = `Create a professional, well-structured markdown summary (~${maxLength} words) of the attached document titled "${title}" using only retrieved content.\n\nOutput Requirements:\n- Start with a brief overview paragraph.\n- Use clear headings (##, ###), bullets and numbers.\n- Bold important terms.\n- Include a short Key Takeaways section at the end.\n- No code fences.`;

      // Create a temporary assistant with file_search enabled on the vector store
      const assistant = await this.openai.beta.assistants.create({
        model: "gpt-4o-mini",
        instructions:
          "You are a helpful assistant that creates document summaries based strictly on the provided documents. Use the file_search tool to find relevant information and create comprehensive summaries.",
        tools: [{ type: "file_search" }],
        tool_resources: {
          file_search: {
            vector_store_ids: [vectorStoreId],
          },
        },
      });

      // Create a thread and add the summarization request
      const thread = await this.openai.beta.threads.create({
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

      // Run the assistant
      const run = await this.openai.beta.threads.runs.create(thread.id, {
        assistant_id: assistant.id,
      });

      // Wait for completion and get the response
      let runStatus = await this.openai.beta.threads.runs.retrieve(
        thread.id,
        run.id
      );
      while (
        runStatus.status === "queued" ||
        runStatus.status === "in_progress"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        runStatus = await this.openai.beta.threads.runs.retrieve(
          thread.id,
          run.id
        );
      }

      if (runStatus.status === "completed") {
        const messages = await this.openai.beta.threads.messages.list(
          thread.id
        );
        const assistantMessage = messages.data.find(
          (msg) => msg.role === "assistant"
        );
        const textContent = assistantMessage?.content.find(
          (content) => content.type === "text"
        );
        const summary = textContent?.text?.value || "";

        // Clean up temporary assistant
        await this.openai.beta.assistants.del(assistant.id);

        return summary.trim();
      } else {
        // Clean up temporary assistant on failure
        await this.openai.beta.assistants.del(assistant.id);
        throw new Error(
          `Assistant run failed with status: ${runStatus.status}`
        );
      }
    } catch (err) {
      logger.error("summarizeWithOpenAIVectorStore failed", err as any);
      throw err;
    }
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
      // If the document was indexed into OpenAI Vector Store (DOCX path), use file_search-based summarization
      try {
        const db = getFirestore();
        const snap = await db
          .collection("documents")
          .doc(userId)
          .collection("userDocuments")
          .doc(documentId)
          .get();
        if (snap.exists) {
          const data = (snap.data() as any) || {};
          const vsId: string | undefined =
            data?.metadata?.openaiVector?.vectorStoreId;
          if (vsId) {
            logger.info("Summarizing via OpenAI Vector Store", {
              documentId,
              vsId,
            });
            try {
              const summary = await this.summarizeWithOpenAIVectorStore(
                vsId,
                maxLength,
                String(data?.title || "Document")
              );
              if (summary && summary.trim().length) return summary;
            } catch (e) {
              logger.warn(
                "Vector store summarization failed, attempting Firestore raw content fallback",
                e as any
              );
              // Fallback to Firestore raw content if available
              let rawText: string = String(
                data?.content?.raw || data?.content?.processed || ""
              ).slice(0, 24000);
              // If no inline content, try transcript from Storage (e.g., YouTube)
              if (!rawText || rawText.length < 100) {
                const transcriptPath = data?.metadata?.transcriptPath as
                  | string
                  | undefined;
                if (transcriptPath) {
                  try {
                    const [buf] = await (await import("firebase-admin/storage"))
                      .getStorage()
                      .bucket()
                      .file(transcriptPath)
                      .download();
                    rawText = buf.toString("utf-8").slice(0, 24000);
                  } catch (trErr) {
                    logger.warn(
                      "Transcript read failed for summary fallback",
                      trErr as any
                    );
                  }
                }
              }
              if (rawText && rawText.length > 100) {
                const prompt = `Summarize the following document into ~${maxLength} words using markdown with headings, bullets, numbered lists, and a Key Takeaways section. Maintain factuality.\n\n${rawText}`;
                const resp = await this.openai.chat.completions.create({
                  model: "gpt-4o-mini",
                  messages: [
                    {
                      role: "system",
                      content:
                        "You are an expert summarizer. Produce clear, well-structured markdown. No code fences.",
                    },
                    { role: "user", content: prompt },
                  ],
                  max_tokens: Math.ceil(maxLength * 1.6),
                  temperature: 0.25,
                });
                const txt = resp.choices?.[0]?.message?.content || "";
                if (txt) return txt;
              }
            }
          }
        }
      } catch (vsCheckErr) {
        logger.warn(
          "Vector store check failed; attempting content fallback",
          vsCheckErr as any
        );
      }

      // Content fallback for summary
      const db = getFirestore();
      const snap = await db
        .collection("documents")
        .doc(userId)
        .collection("userDocuments")
        .doc(documentId)
        .get();
      if (!snap.exists) return "No content available for summary.";
      const data = (snap.data() as any) || {};
      let rawText: string = String(
        data?.content?.raw || data?.content?.processed || data?.summary || ""
      ).slice(0, 24000);
      // If still no content, try reading transcript stored in Storage (YouTube, audio, etc.)
      if (
        (!rawText || rawText.length < 100) &&
        data?.metadata?.transcriptPath
      ) {
        try {
          const [buf] = await (await import("firebase-admin/storage"))
            .getStorage()
            .bucket()
            .file(String(data.metadata.transcriptPath))
            .download();
          rawText = buf.toString("utf-8").slice(0, 24000);
        } catch (e) {
          logger.warn(
            "Transcript read failed for main summary fallback",
            e as any
          );
        }
      }
      if (!rawText || rawText.length < 80)
        return "No content available for summary.";
      const prompt = `Summarize the following document into ~${maxLength} words using markdown with headings, bullets, numbered lists, and a Key Takeaways section. Maintain factuality.\n\n${rawText}`;
      const resp = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert summarizer. Produce clear, well-structured markdown. No code fences.",
          },
          { role: "user", content: prompt },
        ],
        max_tokens: Math.ceil(maxLength * 1.6),
        temperature: 0.25,
      });
      const txt = resp.choices?.[0]?.message?.content || "";
      return txt || "Could not generate summary.";
    } catch (error) {
      logger.error("Error generating document summary:", error);
      throw new Error("Failed to generate document summary");
    }
  }

  /**
   * Generate study flashcards for a document.
   * Strategy:
   *  - Probe available content for chunkCount (same heuristic as summary)
   *  - Fetch up to MAX_CHUNKS_FOR_FLASHCARDS ordered chunks
   *  - Concatenate & truncate context
   *  - Prompt OpenAI to emit clean JSON ONLY: [{"front":"...","back":"...","category":"..."}, ...]
   */
  async generateFlashcards(
    documentId: string,
    userId: string,
    count: number = 12,
    forceNew: boolean = false
  ): Promise<GeneratedFlashcard[]> {
    try {
      const db = getFirestore();
      // Cache lookup first (skip if forceNew is true)
      if (!forceNew) {
        try {
          const cacheDoc = await db
            .collection("documents")
            .doc(userId)
            .collection("userDocuments")
            .doc(documentId)
            .collection("aiArtifacts")
            .doc("flashcards_v1")
            .get();
          if (cacheDoc.exists) {
            const data = cacheDoc.data() as {
              flashcards?: GeneratedFlashcard[];
            };
            if (data.flashcards && data.flashcards.length) {
              logger.info("Serving flashcards from cache", {
                len: data.flashcards.length,
              });
              return data.flashcards.slice(0, count);
            }
          }
        } catch (e) {
          logger.warn("Flashcard cache read failed", e);
        }
      }

      logger.info("Flashcards generation start", {
        userId,
        documentId,
        requested: count,
      });

      // Read document and build source text
      const docSnap = await db
        .collection("documents")
        .doc(userId)
        .collection("userDocuments")
        .doc(documentId)
        .get();
      if (!docSnap.exists) return [];
      const data = docSnap.data() as {
        content?: { raw?: string; processed?: string };
        summary?: string;
        metadata?: { downloadURL?: string; transcriptPath?: string };
      };
      let sourceText = (
        data.summary ||
        data.content?.raw ||
        data.content?.processed ||
        ""
      ).slice(0, 18000);
      if (!sourceText || sourceText.length < 120) {
        const transcriptPath = data.metadata?.transcriptPath;
        if (transcriptPath) {
          try {
            const [buf] = await (await import("firebase-admin/storage"))
              .getStorage()
              .bucket()
              .file(transcriptPath)
              .download();
            sourceText = buf.toString("utf-8").slice(0, 18000);
          } catch {
            // ignore
          }
        }
        const url = data.metadata?.downloadURL;
        if ((!sourceText || sourceText.length < 120) && url) {
          try {
            const res = await fetch(url);
            if (res.ok) {
              const txt = await res.text();
              sourceText = (txt || "").slice(0, 18000);
            }
          } catch (fetchErr) {
            logger.warn(
              "downloadURL fetch failed for flashcards fallback",
              fetchErr as any
            );
          }
        }
      }

      if (!sourceText || sourceText.length < 120) {
        return [];
      }

      const fcPrompt = `Generate ${count} JSON flashcards from the following text. Return ONLY a JSON array where each item has front, back, and category. Text:\n\n${sourceText}`;
      const resp = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You produce concise educational flashcards as valid JSON array only. Do not include any commentary.",
          },
          { role: "user", content: fcPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1400,
      });
      const raw = resp.choices?.[0]?.message?.content || "";
      const sIdx = raw.indexOf("[");
      const eIdx = raw.lastIndexOf("]");
      let cards: GeneratedFlashcard[] = [];
      if (sIdx !== -1 && eIdx !== -1) {
        try {
          const parsed = JSON.parse(raw.slice(sIdx, eIdx + 1)) as any[];
          cards = parsed
            .filter((c) => c && c.front && c.back)
            .slice(0, count)
            .map((c) => ({
              front: String(c.front).trim().slice(0, 200),
              back: String(c.back).trim().slice(0, 400),
              category: (c.category ? String(c.category) : "Concept")
                .trim()
                .slice(0, 40),
            }));
        } catch (parseErr) {
          logger.warn("Failed to parse flashcards JSON", parseErr);
        }
      }

      logger.info("Flashcards generated", { count: cards.length });

      // Persist cache asynchronously
      if (cards.length) {
        db.collection("documents")
          .doc(userId)
          .collection("userDocuments")
          .doc(documentId)
          .collection("aiArtifacts")
          .doc("flashcards_v1")
          .set(
            {
              flashcards: cards,
              updatedAt: new Date(),
              size: cards.length,
              model: "gpt-4o-mini",
              version: 1,
              fallback: false,
            },
            { merge: true }
          )
          .catch((err) => logger.warn("Failed to cache flashcards", err));
      }

      return cards;
    } catch (error) {
      logger.error("Error generating flashcards:", error);
      throw new Error("Failed to generate flashcards");
    }
  }

  /**
   * Generate quiz questions for a document.
   * Similar strategy to flashcards but generates multiple choice questions with explanations.
   */
  async generateQuiz(
    documentId: string,
    userId: string,
    count: number = 10,
    difficulty: "mixed" | "easy" | "medium" | "hard" = "mixed",
    forceNew: boolean = false
  ): Promise<GeneratedQuizQuestion[]> {
    try {
      const db = getFirestore();
      const cacheKey = `quiz_v1_${difficulty}_${count}`;

      // Cache lookup first (skip if forceNew is true)
      if (!forceNew) {
        try {
          const cacheDoc = await db
            .collection("documents")
            .doc(userId)
            .collection("userDocuments")
            .doc(documentId)
            .collection("aiArtifacts")
            .doc(cacheKey)
            .get();
          if (cacheDoc.exists) {
            const cdata = cacheDoc.data() as { quiz?: GeneratedQuizQuestion[] };
            if (cdata.quiz && cdata.quiz.length) {
              logger.info("Serving quiz from cache", {
                len: cdata.quiz.length,
                difficulty,
              });
              return cdata.quiz.slice(0, count);
            }
          }
        } catch (e) {
          logger.warn("Quiz cache read failed", e);
        }
      }

      logger.info("Quiz generation start", {
        userId,
        documentId,
        requested: count,
        difficulty,
      });

      // Read document and build source text
      const docSnap = await db
        .collection("documents")
        .doc(userId)
        .collection("userDocuments")
        .doc(documentId)
        .get();
      if (!docSnap.exists) return [];
      const data = docSnap.data() as {
        content?: { raw?: string; processed?: string };
        summary?: string;
        metadata?: { transcriptPath?: string; downloadURL?: string };
      };

      const preferTranscript = count >= 20;
      let sourceText = "";
      if (preferTranscript && data.metadata?.transcriptPath) {
        try {
          const [buf] = await (await import("firebase-admin/storage"))
            .getStorage()
            .bucket()
            .file(data.metadata.transcriptPath)
            .download();
          sourceText = buf.toString("utf-8").slice(0, 18000);
        } catch (e) {
          logger.warn(
            "Transcript read failed; falling back to Firestore fields",
            e as any
          );
        }
      }
      if (!sourceText) {
        sourceText = (
          data.summary ||
          data.content?.raw ||
          data.content?.processed ||
          ""
        ).slice(0, 18000);
      }
      if (
        (!sourceText || sourceText.length < 120) &&
        data.metadata?.transcriptPath
      ) {
        try {
          const [buf] = await (await import("firebase-admin/storage"))
            .getStorage()
            .bucket()
            .file(data.metadata.transcriptPath)
            .download();
          sourceText = buf.toString("utf-8").slice(0, 18000);
        } catch {
          /* ignore */
        }
      }
      if (
        (!sourceText || sourceText.length < 120) &&
        data.metadata?.downloadURL
      ) {
        try {
          const res = await fetch(data.metadata.downloadURL);
          if (res.ok) {
            const txt = await res.text();
            sourceText = (txt || "").slice(0, 18000);
          }
        } catch (fetchErr) {
          logger.warn(
            "downloadURL fetch failed for quiz fallback",
            fetchErr as any
          );
        }
      }

      if (!sourceText || sourceText.length < 120) return [];

      const quizPrompt = `Generate ${count} multiple-choice quiz questions from the following text. Return ONLY a strict JSON array (no markdown/code fences), where each item has: id, question, options (array of 4 strings), correctAnswer (0-3 index), explanation, category, difficulty (easy/medium/hard). Use valid JSON only: double quotes for strings, no comments, no trailing commas.\n\nText:\n\n${sourceText}`;
      const resp = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You produce educational quiz questions as a strict JSON array only. No commentary, no markdown, no code fences. Do not include trailing commas.",
          },
          { role: "user", content: quizPrompt },
        ],
        temperature: count >= 15 ? 0.2 : 0.4,
        max_tokens: Math.min(3500, 120 + count * 130),
      });

      let raw = resp.choices?.[0]?.message?.content || "";
      const sIdx = raw.indexOf("[");
      const eIdx = raw.lastIndexOf("]");
      let questions: GeneratedQuizQuestion[] = [];
      if (sIdx !== -1 && eIdx !== -1) {
        const rawSlice = raw.slice(sIdx, eIdx + 1);
        const sanitize = (s: string) =>
          s
            .replace(/```json|```/g, "")
            .replace(/[\u201C\u201D]/g, '"')
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/,\s*([}\]])/g, "$1");
        try {
          const parsed = JSON.parse(sanitize(rawSlice)) as any[];
          questions = parsed
            .filter(
              (q) =>
                q &&
                q.question &&
                q.options &&
                Array.isArray(q.options) &&
                q.options.length === 4
            )
            .slice(0, count)
            .map((q, index) => ({
              id: String((q as any).id || index + 1),
              question: String(q.question).trim().slice(0, 300),
              options: (q.options as any[]).map((opt: any) =>
                String(opt).trim().slice(0, 150)
              ),
              correctAnswer: Math.max(
                0,
                Math.min(3, Number((q as any).correctAnswer ?? 0))
              ),
              explanation: String((q as any).explanation || "")
                .trim()
                .slice(0, 400),
              category: ((q as any).category
                ? String((q as any).category)
                : "General"
              )
                .trim()
                .slice(0, 40),
              difficulty: (["easy", "medium", "hard"].includes(
                (q as any).difficulty
              )
                ? (q as any).difficulty
                : "medium") as "easy" | "medium" | "hard",
            }));
        } catch (parseErr) {
          logger.warn("Failed to parse quiz JSON", parseErr as any);
        }
      }

      logger.info("Quiz generated", { count: questions.length, difficulty });

      // Persist cache asynchronously
      if (questions.length) {
        db.collection("documents")
          .doc(userId)
          .collection("userDocuments")
          .doc(documentId)
          .collection("aiArtifacts")
          .doc(cacheKey)
          .set(
            {
              quiz: questions,
              updatedAt: new Date(),
              size: questions.length,
              model: "gpt-4o-mini",
              version: 1,
              difficulty,
              fallback: false,
            },
            { merge: true }
          )
          .catch((err) => logger.warn("Failed to cache quiz", err));
      }

      return questions;
    } catch (error) {
      logger.error("Error generating quiz:", error);
      throw new Error("Failed to generate quiz");
    }
  }
}
