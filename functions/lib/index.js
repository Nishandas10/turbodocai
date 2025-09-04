"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateFlashcards = exports.generateSummary = exports.queryDocuments = exports.processDocument = void 0;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const storage_1 = require("firebase-admin/storage");
const firestore_2 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
const services_1 = require("./services");
// Initialize Firebase Admin
const app = (0, app_1.initializeApp)();
// Set global options
(0, v2_1.setGlobalOptions)({
    maxInstances: 5,
    concurrency: 1,
    region: "us-central1",
    memory: "4GiB",
    timeoutSeconds: 540,
});
const db = (0, firestore_2.getFirestore)(app);
const storage = (0, storage_1.getStorage)();
// Initialize services (they will be created when functions are called)
const createServices = () => {
    return {
        documentProcessor: new services_1.DocumentProcessor(),
        embeddingService: new services_1.EmbeddingService(),
        pineconeService: new services_1.PineconeService(),
        queryService: new services_1.QueryService(),
    };
};
/**
 * Cloud Function triggered when a document is created or updated in Firestore
 * Processes PDF files through the RAG pipeline:
 * 1. Download file from Storage
 * 2. Extract text using pdf-parse
 * 3. Chunk the text
 * 4. Generate embeddings
 * 5. Store in Pinecone
 */
exports.processDocument = (0, firestore_1.onDocumentWritten)("documents/{userId}/userDocuments/{documentId}", async (event) => {
    var _a, _b, _c, _d;
    const documentData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after.data();
    const { userId, documentId } = event.params;
    if (!documentData) {
        firebase_functions_1.logger.error("No document data found");
        return;
    }
    firebase_functions_1.logger.info(`Processing document ${documentId} for user ${userId}`);
    firebase_functions_1.logger.info(`Document data:`, {
        type: documentData.type,
        storagePath: (_b = documentData.metadata) === null || _b === void 0 ? void 0 : _b.storagePath,
        title: documentData.title,
    });
    try {
        // Initialize services
        const { documentProcessor, embeddingService, pineconeService } = createServices();
        // Only process if it's a PDF and has a storage path
        if (documentData.type !== "pdf") {
            firebase_functions_1.logger.info(`Skipping processing - not a PDF document, type: ${documentData.type}`);
            return;
        }
        if (!((_c = documentData.metadata) === null || _c === void 0 ? void 0 : _c.storagePath)) {
            firebase_functions_1.logger.info(`PDF document ${documentId} doesn't have storagePath yet, will process when storage info is updated`);
            return;
        }
        // Skip if already processed
        if (documentData.processingStatus === "completed" ||
            documentData.processingStatus === "processing") {
            firebase_functions_1.logger.info(`Document ${documentId} already processed or currently processing, skipping`);
            return;
        }
        // Update document status to processing
        await db
            .collection("documents")
            .doc(userId)
            .collection("userDocuments")
            .doc(documentId)
            .update({
            processingStatus: "processing",
            processingStartedAt: new Date(),
        });
        // Step 1: Download file from Firebase Storage
        firebase_functions_1.logger.info("Downloading file from storage...");
        const fileBuffer = await downloadFileFromStorage(documentData.metadata.storagePath);
        // Step 2: Extract text from PDF
        firebase_functions_1.logger.info("Extracting text from PDF...");
        const extractedText = await documentProcessor.extractTextFromPDF(fileBuffer);
        if (!extractedText || extractedText.length < 10) {
            throw new Error("No meaningful text extracted from PDF");
        }
        // Guard against extremely large documents (hard cap 2.5M chars)
        const MAX_CHARS = 2500000;
        let truncated = false;
        let workingText = extractedText;
        if (workingText.length > MAX_CHARS) {
            workingText = workingText.slice(0, MAX_CHARS);
            truncated = true;
            firebase_functions_1.logger.warn(`Document text truncated to ${MAX_CHARS} characters to conserve memory`);
        }
        // Streaming chunk generation to avoid holding all chunks
        function* generateChunks(text, chunkSize = 300, overlap = 20) {
            const words = text.split(/\s+/);
            let start = 0;
            while (start < words.length) {
                const end = Math.min(start + chunkSize, words.length);
                const chunk = words.slice(start, end).join(" ").trim();
                if (chunk)
                    yield chunk;
                start = end - overlap;
                if (start < 0)
                    start = 0;
                if (start >= end)
                    start = end; // safety
            }
        }
        firebase_functions_1.logger.info("Beginning streaming chunk processing...");
        let chunkCount = 0;
        const memLog = () => {
            const mu = process.memoryUsage();
            firebase_functions_1.logger.info("Memory usage", {
                rss: mu.rss,
                heapUsed: mu.heapUsed,
                heapTotal: mu.heapTotal,
                external: mu.external,
            });
        };
        let processedChars = 0;
        const totalChars = workingText.length;
        for (const chunk of generateChunks(workingText, 300, 20)) {
            const i = chunkCount;
            chunkCount++;
            if (chunkCount === 1)
                firebase_functions_1.logger.info("First chunk length", { len: chunk.length });
            if (chunkCount % 25 === 0)
                firebase_functions_1.logger.info(`Processed ${chunkCount} chunks so far`);
            try {
                const embedding = await embeddingService.embedChunks([chunk]);
                await pineconeService.storeEmbeddings([chunk], embedding, documentId, userId, {
                    title: documentData.title,
                    fileName: (_d = documentData.metadata) === null || _d === void 0 ? void 0 : _d.fileName,
                }, i);
            }
            catch (chunkError) {
                firebase_functions_1.logger.error(`Error processing chunk ${chunkCount}`, chunkError);
            }
            processedChars += chunk.length;
            // Periodic progress update (every 25 chunks) capped below 100 until completion
            if (chunkCount % 25 === 0) {
                const progressPct = Math.min(99, Math.round((processedChars / totalChars) * 100));
                try {
                    await db
                        .collection("documents")
                        .doc(userId)
                        .collection("userDocuments")
                        .doc(documentId)
                        .set({
                        processingProgress: progressPct,
                        processingStatus: "processing",
                        chunkCount,
                    }, { merge: true });
                }
                catch (progressErr) {
                    firebase_functions_1.logger.warn("Progress update failed", progressErr);
                }
            }
            if (global.gc)
                global.gc();
            if (chunkCount % 10 === 0)
                memLog();
            // Tiny delay to yield event loop & allow GC
            await new Promise((r) => setTimeout(r, 40));
        }
        // Update document with processed content and status
        await db
            .collection("documents")
            .doc(userId)
            .collection("userDocuments")
            .doc(documentId)
            .update({
            "content.raw": workingText.slice(0, 1000000),
            "content.processed": `Indexed ${chunkCount} chunks${truncated ? " (truncated)" : ""}`,
            processingStatus: "completed",
            processingCompletedAt: new Date(),
            chunkCount,
            characterCount: workingText.length,
            truncated,
            processingProgress: 100,
        });
        firebase_functions_1.logger.info(`Successfully processed document ${documentId} with ${chunkCount} chunks`);
    }
    catch (error) {
        firebase_functions_1.logger.error(`Error processing document ${documentId}:`, error);
        // Update document status to failed
        await db
            .collection("documents")
            .doc(userId)
            .collection("userDocuments")
            .doc(documentId)
            .update({
            processingStatus: "failed",
            processingError: error instanceof Error ? error.message : "Unknown error",
            processingFailedAt: new Date(),
        });
    }
});
/**
 * Download file from Firebase Storage
 */
async function downloadFileFromStorage(storagePath) {
    try {
        const bucket = storage.bucket();
        const file = bucket.file(storagePath);
        const [fileBuffer] = await file.download();
        return fileBuffer;
    }
    catch (error) {
        firebase_functions_1.logger.error("Error downloading file from storage:", error);
        throw new Error("Failed to download file from storage");
    }
}
/**
 * Callable function to query documents using RAG
 */
exports.queryDocuments = (0, https_1.onCall)({
    enforceAppCheck: false, // Set to true in production
}, async (request) => {
    try {
        const { question, userId, documentId, topK } = request.data;
        if (!question || !userId) {
            throw new Error("Missing required parameters: question and userId");
        }
        // Initialize services
        const { queryService } = createServices();
        const result = await queryService.queryRAG(question, userId, documentId, topK || 5);
        return { success: true, data: result };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in queryDocuments:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
});
/**
 * Callable function to generate document summary
 */
exports.generateSummary = (0, https_1.onCall)({
    enforceAppCheck: false, // Set to true in production
}, async (request) => {
    try {
        const { documentId, userId, maxLength } = request.data;
        if (!documentId || !userId) {
            throw new Error("Missing required parameters: documentId and userId");
        }
        // Initialize services
        const { queryService } = createServices();
        const summary = await queryService.generateDocumentSummary(documentId, userId, maxLength || 500);
        return { success: true, data: { summary } };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in generateSummary:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
});
/**
 * Callable function to generate flashcards for a document
 */
exports.generateFlashcards = (0, https_1.onCall)({
    enforceAppCheck: false,
}, async (request) => {
    try {
        const { documentId, userId, count } = request.data || {};
        if (!documentId || !userId) {
            throw new Error("Missing required parameters: documentId and userId");
        }
        const { queryService } = createServices();
        const cards = await queryService.generateFlashcards(documentId, userId, count || 12);
        return { success: true, data: { flashcards: cards } };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in generateFlashcards:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
});
//# sourceMappingURL=index.js.map