"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PineconeService = void 0;
const pinecone_1 = require("@pinecone-database/pinecone");
const firebase_functions_1 = require("firebase-functions");
class PineconeService {
    constructor() {
        const apiKey = process.env.PINECONE_API_KEY;
        const indexName = process.env.PINECONE_INDEX;
        if (!apiKey) {
            throw new Error("PINECONE_API_KEY environment variable is not set");
        }
        if (!indexName) {
            throw new Error("PINECONE_INDEX environment variable is not set");
        }
        this.pinecone = new pinecone_1.Pinecone({
            apiKey: apiKey,
        });
        this.indexName = indexName;
    }
    /**
     * Store embeddings in Pinecone
     */
    async storeEmbeddings(chunks, embeddings, documentId, userId, metadata, startIndex = 0) {
        try {
            const index = this.pinecone.index(this.indexName);
            // Prepare vectors for upsert
            const vectors = chunks.map((chunk, i) => ({
                id: `${documentId}_${startIndex + i}`,
                values: embeddings[i],
                metadata: {
                    userId,
                    documentId,
                    chunkIndex: startIndex + i,
                    chunk: chunk.substring(0, 40000),
                    title: metadata.title,
                    fileName: metadata.fileName,
                    timestamp: Date.now(),
                },
            }));
            // Upsert in smaller batches to avoid payload size limits and memory issues
            const batchSize = 50; // Reduced from 100
            for (let i = 0; i < vectors.length; i += batchSize) {
                const batch = vectors.slice(i, i + batchSize);
                firebase_functions_1.logger.info(`Upserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(vectors.length / batchSize)} to Pinecone`);
                await index.upsert(batch);
                // Add small delay between batches
                if (i + batchSize < vectors.length) {
                    await this.delay(100);
                }
            }
            firebase_functions_1.logger.info(`Successfully stored ${vectors.length} vectors in Pinecone`);
        }
        catch (error) {
            firebase_functions_1.logger.error("Error storing embeddings in Pinecone:", error);
            throw new Error("Failed to store embeddings in Pinecone");
        }
    }
    /**
     * Query Pinecone for similar chunks
     */
    async querySimilarChunks(queryEmbedding, userId, topK = 5, documentId) {
        var _a;
        try {
            const index = this.pinecone.index(this.indexName);
            // Build filter
            const filter = {
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
            return (((_a = queryResponse.matches) === null || _a === void 0 ? void 0 : _a.map((match) => {
                var _a, _b, _c, _d;
                return ({
                    id: match.id,
                    score: match.score || 0,
                    chunk: ((_a = match.metadata) === null || _a === void 0 ? void 0 : _a.chunk) || "",
                    documentId: ((_b = match.metadata) === null || _b === void 0 ? void 0 : _b.documentId) || "",
                    title: ((_c = match.metadata) === null || _c === void 0 ? void 0 : _c.title) || "",
                    fileName: (_d = match.metadata) === null || _d === void 0 ? void 0 : _d.fileName,
                });
            })) || []);
        }
        catch (error) {
            firebase_functions_1.logger.error("Error querying Pinecone:", error);
            throw new Error("Failed to query Pinecone");
        }
    }
    /**
     * Fetch specific chunk vectors by their IDs (ordered)
     */
    async fetchChunksByIds(ids) {
        if (!ids.length)
            return [];
        const index = this.pinecone.index(this.indexName);
        const results = [];
        // Pinecone fetch limit ~100 IDs per call
        for (let i = 0; i < ids.length; i += 100) {
            const batchIds = ids.slice(i, i + 100);
            const fetched = await index.fetch(batchIds);
            // fetched.records is a map id -> record
            const records = (fetched === null || fetched === void 0 ? void 0 : fetched.records) || (fetched === null || fetched === void 0 ? void 0 : fetched.vectors) || {};
            for (const id of batchIds) {
                const rec = records[id];
                if (rec === null || rec === void 0 ? void 0 : rec.metadata) {
                    results.push({
                        id,
                        chunk: rec.metadata.chunk || "",
                        documentId: rec.metadata.documentId || "",
                        title: rec.metadata.title || "",
                        fileName: rec.metadata.fileName,
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
    async fetchDocumentChunks(documentId, userId, chunkCount, limit) {
        const max = limit ? Math.min(limit, chunkCount) : chunkCount;
        const ids = Array.from({ length: max }, (_, i) => `${documentId}_${i}`);
        return this.fetchChunksByIds(ids);
    }
    /**
     * Delete vectors for a specific document
     */
    async deleteDocumentVectors(documentId, userId) {
        try {
            const index = this.pinecone.index(this.indexName);
            await index.deleteMany({
                filter: {
                    documentId: { $eq: documentId },
                    userId: { $eq: userId },
                },
            });
            firebase_functions_1.logger.info(`Deleted vectors for document ${documentId}`);
        }
        catch (error) {
            firebase_functions_1.logger.error("Error deleting document vectors:", error);
            throw new Error("Failed to delete document vectors");
        }
    }
    /**
     * Get index statistics
     */
    async getIndexStats() {
        try {
            const index = this.pinecone.index(this.indexName);
            return await index.describeIndexStats();
        }
        catch (error) {
            firebase_functions_1.logger.error("Error getting index stats:", error);
            throw new Error("Failed to get index stats");
        }
    }
    /**
     * Utility function to add delay
     */
    delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.PineconeService = PineconeService;
//# sourceMappingURL=pineconeService.js.map