"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingService = void 0;
const openai_1 = require("openai");
const firebase_functions_1 = require("firebase-functions");
class EmbeddingService {
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY environment variable is not set");
        }
        this.openai = new openai_1.OpenAI({
            apiKey: apiKey,
        });
    }
    /**
     * Generate embeddings for multiple text chunks with memory optimization
     */
    async embedChunks(chunks) {
        try {
            const embeddings = [];
            // Process chunks in smaller batches to avoid memory issues
            const batchSize = 10; // Reduced from 20 to save memory
            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                firebase_functions_1.logger.info(`Processing embedding batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batch.length} chunks)`);
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
    async embedBatch(chunks) {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-3-small", // Use consistent model
                input: chunks,
                encoding_format: "float",
                dimensions: 1024, // Match Pinecone index dimensions
            });
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
    async embedQuery(query) {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-3-small",
                input: query,
                encoding_format: "float",
                dimensions: 1024, // Match Pinecone index dimensions
            });
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
        // text-embedding-3-small configured for 1024 dimensions to match Pinecone index
        return 1024;
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