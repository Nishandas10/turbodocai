import { Pinecone } from "@pinecone-database/pinecone";
import { logger } from "firebase-functions";

interface DocumentMetadata {
  title: string;
  fileName?: string;
}

interface PineconeVector {
  id: string;
  values: number[];
  metadata: {
    userId: string;
    documentId: string;
    chunkIndex: number;
    chunk: string;
    title: string;
    fileName?: string;
    timestamp: number;
  };
}

export class PineconeService {
  private pinecone: Pinecone;
  private indexName: string;

  constructor() {
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX;

    if (!apiKey) {
      throw new Error("PINECONE_API_KEY environment variable is not set");
    }

    if (!indexName) {
      throw new Error("PINECONE_INDEX environment variable is not set");
    }

    this.pinecone = new Pinecone({
      apiKey: apiKey,
    });

    this.indexName = indexName;
  }

  /**
   * Store embeddings in Pinecone
   */
  async storeEmbeddings(
    chunks: string[],
    embeddings: number[][],
    documentId: string,
    userId: string,
    metadata: DocumentMetadata,
    startIndex: number = 0
  ): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);

      // Prepare vectors for upsert
      const vectors: PineconeVector[] = chunks.map((chunk, i) => ({
        id: `${documentId}_${startIndex + i}`, // Use startIndex for unique IDs
        values: embeddings[i],
        metadata: {
          userId,
          documentId,
          chunkIndex: startIndex + i, // Use global chunk index
          chunk: chunk.substring(0, 40000), // Pinecone metadata limit
          title: metadata.title,
          fileName: metadata.fileName,
          timestamp: Date.now(),
        },
      }));

      // Upsert in smaller batches to avoid payload size limits and memory issues
      const batchSize = 50; // Reduced from 100

      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize);

        logger.info(
          `Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            vectors.length / batchSize
          )} to Pinecone`
        );

        await index.upsert(batch);

        // Add small delay between batches
        if (i + batchSize < vectors.length) {
          await this.delay(100);
        }
      }

      logger.info(`Successfully stored ${vectors.length} vectors in Pinecone`);
    } catch (error) {
      logger.error("Error storing embeddings in Pinecone:", error);
      throw new Error("Failed to store embeddings in Pinecone");
    }
  }

  /**
   * Query Pinecone for similar chunks
   */
  async querySimilarChunks(
    queryEmbedding: number[],
    userId: string,
    topK: number = 5,
    documentId?: string
  ): Promise<
    Array<{
      id: string;
      score: number;
      chunk: string;
      documentId: string;
      title: string;
      fileName?: string;
    }>
  > {
    try {
      const index = this.pinecone.index(this.indexName);

      // Build filter
      const filter: any = {
        userId: { $eq: userId },
      };

      if (documentId) {
        filter.documentId = { $eq: documentId };
      }

      const queryResponse = await index.query({
        vector: queryEmbedding,
        topK,
        filter,
        includeMetadata: true,
      });

      return (
        queryResponse.matches?.map((match) => ({
          id: match.id,
          score: match.score || 0,
          chunk: (match.metadata?.chunk as string) || "",
          documentId: (match.metadata?.documentId as string) || "",
          title: (match.metadata?.title as string) || "",
          fileName: match.metadata?.fileName as string,
        })) || []
      );
    } catch (error) {
      logger.error("Error querying Pinecone:", error);
      throw new Error("Failed to query Pinecone");
    }
  }

  /**
   * Fetch specific chunk vectors by their IDs (ordered)
   */
  async fetchChunksByIds(ids: string[]): Promise<
    Array<{
      id: string;
      chunk: string;
      documentId: string;
      title: string;
      fileName?: string;
    }>
  > {
    if (!ids.length) return [];
    const index = this.pinecone.index(this.indexName);
    const results: Array<{
      id: string;
      chunk: string;
      documentId: string;
      title: string;
      fileName?: string;
    }> = [];
    // Pinecone fetch limit ~100 IDs per call
    for (let i = 0; i < ids.length; i += 100) {
      const batchIds = ids.slice(i, i + 100);
      const fetched = await index.fetch(batchIds);
      // fetched.records is a map id -> record
      const records =
        (fetched as any)?.records || (fetched as any)?.vectors || {};
      for (const id of batchIds) {
        const rec = records[id];
        if (rec?.metadata) {
          results.push({
            id,
            chunk: (rec.metadata.chunk as string) || "",
            documentId: (rec.metadata.documentId as string) || "",
            title: (rec.metadata.title as string) || "",
            fileName: rec.metadata.fileName as string | undefined,
          });
        }
      }
    }
    // Ensure original order
    results.sort((a, b) => a.id.localeCompare(b.id));
    return results;
  }

  /**
   * Convenience: fetch ordered chunks for a document given chunkCount
   */
  async fetchDocumentChunks(
    documentId: string,
    userId: string,
    chunkCount: number,
    limit?: number
  ): Promise<
    Array<{
      id: string;
      chunk: string;
      documentId: string;
      title: string;
      fileName?: string;
    }>
  > {
    const max = limit ? Math.min(limit, chunkCount) : chunkCount;
    const ids = Array.from({ length: max }, (_, i) => `${documentId}_${i}`);
    return this.fetchChunksByIds(ids);
  }

  /**
   * Delete vectors for a specific document
   */
  async deleteDocumentVectors(
    documentId: string,
    userId: string
  ): Promise<void> {
    try {
      const index = this.pinecone.index(this.indexName);

      await index.deleteMany({
        filter: {
          documentId: { $eq: documentId },
          userId: { $eq: userId },
        },
      });

      logger.info(`Deleted vectors for document ${documentId}`);
    } catch (error) {
      logger.error("Error deleting document vectors:", error);
      throw new Error("Failed to delete document vectors");
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      const index = this.pinecone.index(this.indexName);
      return await index.describeIndexStats();
    } catch (error) {
      logger.error("Error getting index stats:", error);
      throw new Error("Failed to get index stats");
    }
  }

  /**
   * Utility function to add delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
