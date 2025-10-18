"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIVectorStoreService = void 0;
const openai_1 = require("openai");
const firebase_functions_1 = require("firebase-functions");
class OpenAIVectorStoreService {
    constructor(vectorStoreId) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey)
            throw new Error("OPENAI_API_KEY environment variable is not set");
        this.openai = new openai_1.OpenAI({ apiKey });
        this.vectorStoreId =
            vectorStoreId ||
                process.env.OPENAI_VECTOR_STORE_ID ||
                "vs_68f1528dad6c8191bfb8a090e1557a86";
        if (!this.vectorStoreId) {
            throw new Error("OPENAI_VECTOR_STORE_ID is not set. Provide env or pass in constructor.");
        }
    }
    /**
     * Store raw text as a single file in the OpenAI vector store. The platform performs chunking and embedding.
     * For large texts, it will be uploaded as a bytes blob.
     */
    async uploadTextAsDocument(text, metadata) {
        try {
            const bytes = Buffer.from(text, "utf-8");
            const uploadFile = await (0, openai_1.toFile)(bytes, `${metadata.documentId}.txt`, {
                type: "text/plain",
            });
            const file = await this.openai.files.create({
                file: uploadFile,
                purpose: "assistants",
            });
            // Attach file to vector store (signature: create(vectorStoreId, { file_id }))
            const vector = await this.openai.vectorStores.files.create(this.vectorStoreId, { file_id: file.id });
            firebase_functions_1.logger.info("Uploaded text to OpenAI Vector Store", {
                vsId: this.vectorStoreId,
                fileId: file.id,
            });
            return {
                fileId: file.id,
                vectorStoreFileId: (vector === null || vector === void 0 ? void 0 : vector.id) || file.id,
            };
        }
        catch (error) {
            firebase_functions_1.logger.error("Failed to upload text to OpenAI Vector Store", error);
            throw error;
        }
    }
    /**
     * Upload pre-chunked text as multiple files to the vector store. This gives us control over chunk sizes
     * (e.g., ~800 words ≈ 500–1000 tokens) while still letting OpenAI handle embeddings inside the store.
     * Returns the list of created fileIds and vectorStoreFileIds.
     */
    async uploadChunksAsFiles(chunks, metadata) {
        const results = [];
        try {
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                if (!chunk || !chunk.trim())
                    continue;
                const name = `${metadata.documentId}_chunk_${i + 1}.txt`;
                const uploadFile = await (0, openai_1.toFile)(Buffer.from(chunk, "utf-8"), name, {
                    type: "text/plain",
                });
                const file = await this.openai.files.create({
                    file: uploadFile,
                    purpose: "assistants",
                });
                const vector = await this.openai.vectorStores.files.create(this.vectorStoreId, { file_id: file.id });
                results.push({
                    fileId: file.id,
                    vectorStoreFileId: (vector === null || vector === void 0 ? void 0 : vector.id) || file.id,
                });
                if ((i + 1) % 20 === 0) {
                    firebase_functions_1.logger.info("Uploaded chunks to OpenAI Vector Store", {
                        vsId: this.vectorStoreId,
                        uploaded: i + 1,
                        total: chunks.length,
                    });
                }
                // brief delay to avoid rate spikes
                await new Promise((r) => setTimeout(r, 60));
            }
            firebase_functions_1.logger.info("Completed chunk uploads to OpenAI Vector Store", {
                vsId: this.vectorStoreId,
                total: results.length,
            });
            return { files: results };
        }
        catch (error) {
            firebase_functions_1.logger.error("Failed to upload chunks to OpenAI Vector Store", error);
            throw error;
        }
    }
}
exports.OpenAIVectorStoreService = OpenAIVectorStoreService;
//# sourceMappingURL=openaiVectorStoreService.js.map