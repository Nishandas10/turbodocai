import { OpenAI, toFile } from "openai";
import { logger } from "firebase-functions";

export interface VectorDocMetadata {
  userId: string;
  documentId: string;
  title: string;
  fileName?: string;
}

export class OpenAIVectorStoreService {
  private openai: OpenAI;
  private vectorStoreId: string;

  constructor(vectorStoreId?: string) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      throw new Error("OPENAI_API_KEY environment variable is not set");

    this.openai = new OpenAI({ apiKey });
    this.vectorStoreId =
      vectorStoreId ||
      process.env.OPENAI_VECTOR_STORE_ID ||
      "vs_68f1528dad6c8191bfb8a090e1557a86";
    if (!this.vectorStoreId) {
      throw new Error(
        "OPENAI_VECTOR_STORE_ID is not set. Provide env or pass in constructor."
      );
    }
  }

  /** Return the resolved vector store id used by this service */
  getVectorStoreId(): string {
    return this.vectorStoreId;
  }

  /**
   * Delete a file from the vector store if it exists. Safe no-op on errors.
   */
  async deleteFile(vectorStoreId: string, fileId: string): Promise<void> {
    try {
      const vsId = vectorStoreId || this.vectorStoreId;
      // SDK shape uses vectorStores.files.del(vsId, fileId)
      await (this.openai as any).vectorStores.files.del(vsId, fileId);
      logger.info("Deleted file from OpenAI Vector Store", { vsId, fileId });
    } catch (e) {
      logger.warn(
        "Failed to delete file from vector store (continuing)",
        e as any
      );
    }
  }

  /**
   * Store raw text as a single file in the OpenAI vector store. The platform performs chunking and embedding.
   * For large texts, it will be uploaded as a bytes blob.
   */
  async uploadTextAsDocument(
    text: string,
    metadata: VectorDocMetadata
  ): Promise<{ fileId: string; vectorStoreFileId: string }> {
    try {
      const bytes = Buffer.from(text, "utf-8");
      const uploadFile = await toFile(bytes, `${metadata.documentId}.txt`, {
        type: "text/plain",
      });
      const file = await this.openai.files.create({
        file: uploadFile,
        purpose: "assistants",
      });

      // Attach file to vector store (signature: create(vectorStoreId, { file_id }))
      const vector = await (this.openai as any).vectorStores.files.create(
        this.vectorStoreId,
        { file_id: (file as any).id }
      );

      logger.info("Uploaded text to OpenAI Vector Store", {
        vsId: this.vectorStoreId,
        fileId: (file as any).id,
      });
      return {
        fileId: (file as any).id,
        vectorStoreFileId: (vector as any)?.id || (file as any).id,
      };
    } catch (error) {
      logger.error("Failed to upload text to OpenAI Vector Store", error);
      throw error;
    }
  }

  /**
   * Upsert text for a given document into the vector store. If an existing fileId is provided,
   * it will be deleted before uploading the new content to keep the store clean.
   */
  async upsertTextDocument(
    text: string,
    metadata: VectorDocMetadata & {
      existing?: { vectorStoreId?: string; fileId?: string };
    }
  ): Promise<{
    vectorStoreId: string;
    fileId: string;
    vectorStoreFileId: string;
  }> {
    const vsId = metadata.existing?.vectorStoreId || this.vectorStoreId;
    if (metadata.existing?.fileId) {
      await this.deleteFile(vsId, metadata.existing.fileId);
    }
    const uploaded = await this.uploadTextAsDocument(text, {
      userId: metadata.userId,
      documentId: metadata.documentId,
      title: metadata.title,
      fileName: metadata.fileName,
    });
    return {
      vectorStoreId: vsId,
      fileId: uploaded.fileId,
      vectorStoreFileId: uploaded.vectorStoreFileId,
    };
  }
}
