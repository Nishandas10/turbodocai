import { OpenAI } from "openai";
import { logger } from "firebase-functions";

export class EmbeddingService {
  private openai: OpenAI;

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
   * Generate embeddings for multiple text chunks with memory optimization
   */
  async embedChunks(chunks: string[]): Promise<number[][]> {
    try {
      const embeddings: number[][] = [];

      // Process chunks in smaller batches to avoid memory issues
      const batchSize = 10; // Reduced from 20 to save memory

      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        logger.info(
          `Processing embedding batch ${
            Math.floor(i / batchSize) + 1
          }/${Math.ceil(chunks.length / batchSize)} (${batch.length} chunks)`
        );

        const batchEmbeddings = await this.embedBatch(batch);
        embeddings.push(...batchEmbeddings);

        // Force garbage collection opportunity
        if (global.gc) {
          global.gc();
        }

        // Add a small delay between batches to respect rate limits and allow memory cleanup
        if (i + batchSize < chunks.length) {
          await this.delay(200); // Increased delay
        }
      }

      logger.info(`Generated ${embeddings.length} embeddings`);
      return embeddings;
    } catch (error) {
      logger.error("Error generating embeddings:", error);
      throw new Error("Failed to generate embeddings");
    }
  }

  /**
   * Generate embeddings for a batch of text chunks
   */
  private async embedBatch(chunks: string[]): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small", // Use consistent model

        input: chunks,
        encoding_format: "float",
        dimensions: 1024, // Match Pinecone index dimensions
      });

      return response.data.map((item) => item.embedding);
    } catch (error) {
      logger.error("Error in embedBatch:", error);
      throw error;
    }
  }

  /**
   * Generate embedding for a single query
   */
  async embedQuery(query: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
        encoding_format: "float",
        dimensions: 1024, // Match Pinecone index dimensions
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error("Error generating query embedding:", error);
      throw new Error("Failed to generate query embedding");
    }
  }

  /**
   * Get embedding model dimensions
   */
  getEmbeddingDimensions(): number {
    // text-embedding-3-small configured for 1024 dimensions to match Pinecone index
    return 1024;
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
