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
    /** Return the resolved vector store id used by this service */
    getVectorStoreId() {
        return this.vectorStoreId;
    }
    /**
     * Delete a file from the vector store if it exists. Safe no-op on errors.
     */
    async deleteFile(vectorStoreId, fileId) {
        try {
            const vsId = vectorStoreId || this.vectorStoreId;
            // SDK shape uses vectorStores.files.del(vsId, fileId)
            await this.openai.vectorStores.files.del(vsId, fileId);
            firebase_functions_1.logger.info("Deleted file from OpenAI Vector Store", { vsId, fileId });
        }
        catch (e) {
            firebase_functions_1.logger.warn("Failed to delete file from vector store (continuing)", e);
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
     * Upsert text for a given document into the vector store. If an existing fileId is provided,
     * it will be deleted before uploading the new content to keep the store clean.
     */
    async upsertTextDocument(text, metadata) {
        var _a, _b;
        const vsId = ((_a = metadata.existing) === null || _a === void 0 ? void 0 : _a.vectorStoreId) || this.vectorStoreId;
        if ((_b = metadata.existing) === null || _b === void 0 ? void 0 : _b.fileId) {
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
exports.OpenAIVectorStoreService = OpenAIVectorStoreService;
//# sourceMappingURL=openaiVectorStoreService.js.map