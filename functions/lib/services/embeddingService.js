"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const openai_1 = require("openai");
const firebase_functions_1 = require("firebase-functions");
class EmbeddingService {
    constructor(opts) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY environment variable is not set");
        }
        this.openai = new openai_1.OpenAI({
            apiKey: apiKey,
        });
        this.defaultModel = (opts === null || opts === void 0 ? void 0 : opts.model) || "text-embedding-3-small";
        this.defaultDimensions = (opts === null || opts === void 0 ? void 0 : opts.dimensions) || 1024;
    }
    /**
     * Generate embeddings for multiple text chunks with memory optimization
     */
    async embedChunks(chunks, opts) {
        try {
            const embeddings = [];
            // Process chunks in smaller batches to avoid memory issues
            const batchSize = 10; // Reduced from 20 to save memory
            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                firebase_functions_1.logger.info(`Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batch.length} chunks)`);
                const batchEmbeddings = await this.embedBatch(batch, opts);
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
            firebase_functions_1.logger.info(`Generated ${embeddings.length} embeddings`);
            return embeddings;
        }
        catch (error) {
            firebase_functions_1.logger.error("Error generating embeddings:", error);
            throw new Error("Failed to generate embeddings");
        }
    }
    /**
     * Generate embeddings for a batch of text chunks
     */
    async embedBatch(chunks, opts) {
        var _a;
        try {
            const model = (opts === null || opts === void 0 ? void 0 : opts.model) || this.defaultModel;
            const dimensions = (_a = opts === null || opts === void 0 ? void 0 : opts.dimensions) !== null && _a !== void 0 ? _a : this.defaultDimensions;
            const response = await this.openai.embeddings.create(Object.assign({ model, input: chunks, encoding_format: "float" }, (typeof dimensions === "number" ? { dimensions } : {})));
            return response.data.map((item) => item.embedding);
        }
        catch (error) {
            firebase_functions_1.logger.error("Error in embedBatch:", error);
            throw error;
        }
    }
    /**
     * Generate embedding for a single query
     */
    async embedQuery(query, opts) {
        var _a;
        try {
            const model = (opts === null || opts === void 0 ? void 0 : opts.model) || this.defaultModel;
            const dimensions = (_a = opts === null || opts === void 0 ? void 0 : opts.dimensions) !== null && _a !== void 0 ? _a : this.defaultDimensions;
            const response = await this.openai.embeddings.create(Object.assign({ model, input: query, encoding_format: "float" }, (typeof dimensions === "number" ? { dimensions } : {})));
            return response.data[0].embedding;
        }
        catch (error) {
            firebase_functions_1.logger.error("Error generating query embedding:", error);
            throw new Error("Failed to generate query embedding");
        }
    }
    /**
     * Get embedding model dimensions
     */
    getEmbeddingDimensions() {
        return this.defaultDimensions;
    }
    /**
     * Utility function to add delay
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.EmbeddingService = EmbeddingService;
//# sourceMappingURL=embeddingService.js.map