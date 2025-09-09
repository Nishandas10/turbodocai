"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMindMap = exports.generatePodcast = exports.getDocumentText = exports.generateQuiz = exports.generateFlashcards = exports.generateSummary = exports.queryDocuments = exports.processDocument = void 0;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const storage_1 = require("firebase-admin/storage");
const firestore_2 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
const openai_1 = require("openai");
const crypto_1 = require("crypto");
const services_1 = require("./services");
// Initialize Firebase Admin
const app = (0, app_1.initializeApp)();
// Set global options
(0, v2_1.setGlobalOptions)({
    maxInstances: 5,
    concurrency: 1, // Ensure only one execution per instance to cap memory usage
    region: "us-central1",
    memory: "4GiB", // Maximum memory allocation
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
/**
 * Callable function to generate quiz questions for a document
 */
exports.generateQuiz = (0, https_1.onCall)({
    enforceAppCheck: false,
}, async (request) => {
    try {
        const { documentId, userId, count, difficulty } = request.data || {};
        if (!documentId || !userId) {
            throw new Error("Missing required parameters: documentId and userId");
        }
        const { queryService } = createServices();
        const questions = await queryService.generateQuiz(documentId, userId, count || 10, difficulty || "mixed");
        return { success: true, data: { quiz: questions } };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in generateQuiz:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
});
/**
 * Callable function to fetch full raw document text from Pinecone (ordered by chunk index)
 * Falls back to Firestore stored raw content if vectors are not available.
 */
exports.getDocumentText = (0, https_1.onCall)({
    enforceAppCheck: false,
}, async (request) => {
    var _a, _b, _c, _d;
    try {
        const { documentId, userId, limitChars } = request.data || {};
        if (!documentId || !userId) {
            throw new Error("Missing required parameters: documentId and userId");
        }
        const { pineconeService } = createServices();
        // Try to read document metadata (including chunkCount) from Firestore
        let chunkCount = 0;
        let title;
        let fileName;
        try {
            const snap = await db
                .collection("documents")
                .doc(userId)
                .collection("userDocuments")
                .doc(documentId)
                .get();
            if (snap.exists) {
                const data = snap.data();
                chunkCount = Number((data === null || data === void 0 ? void 0 : data.chunkCount) || 0);
                title = data === null || data === void 0 ? void 0 : data.title;
                fileName = (_a = data === null || data === void 0 ? void 0 : data.metadata) === null || _a === void 0 ? void 0 : _a.fileName;
            }
        }
        catch (_e) {
            /* ignore */
        }
        // If chunkCount unknown, attempt a cheap probe
        if (!chunkCount) {
            try {
                const probe = await pineconeService.querySimilarChunks(new Array(1024).fill(0), userId, 50, documentId);
                const indices = probe
                    .map((m) => parseInt(String(m.id).split("_").pop() || "0", 10))
                    .filter((n) => !isNaN(n));
                if (indices.length)
                    chunkCount = Math.max(...indices) + 1;
            }
            catch (_f) {
                /* ignore */
            }
        }
        let text = "";
        let source = "pinecone";
        if (chunkCount > 0) {
            const ordered = await pineconeService.fetchDocumentChunks(documentId, userId, chunkCount);
            text = ordered.map((c) => c.chunk).join("\n\n");
        }
        // Fallback to Firestore stored raw content
        if (!text || text.length < 10) {
            source = "firestore";
            try {
                const snap = await db
                    .collection("documents")
                    .doc(userId)
                    .collection("userDocuments")
                    .doc(documentId)
                    .get();
                if (snap.exists) {
                    const data = snap.data();
                    title = title || (data === null || data === void 0 ? void 0 : data.title);
                    fileName = fileName || ((_b = data === null || data === void 0 ? void 0 : data.metadata) === null || _b === void 0 ? void 0 : _b.fileName);
                    text =
                        ((_c = data === null || data === void 0 ? void 0 : data.content) === null || _c === void 0 ? void 0 : _c.raw) ||
                            ((_d = data === null || data === void 0 ? void 0 : data.content) === null || _d === void 0 ? void 0 : _d.processed) ||
                            (data === null || data === void 0 ? void 0 : data.summary) ||
                            "";
                }
            }
            catch (_g) {
                /* ignore */
            }
        }
        const totalChars = text.length;
        const max = Number(limitChars) && Number(limitChars) > 0
            ? Number(limitChars)
            : totalChars;
        const sliced = text.slice(0, max);
        const truncated = sliced.length < totalChars;
        return {
            success: true,
            data: {
                text: sliced,
                title,
                fileName,
                chunkCount: chunkCount || undefined,
                characterCount: totalChars,
                source,
                truncated,
            },
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in getDocumentText:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
});
/**
 * Callable function: Generate or fetch podcast audio (MP3) for a document's summary using OpenAI TTS.
 * Caches result under documents/{userId}/userDocuments/{documentId}/aiArtifacts/podcast_v1
 * Stores audio at gs://<bucket>/podcasts/{userId}/{documentId}/{voice or default}.mp3
 */
exports.generatePodcast = (0, https_1.onCall)({
    enforceAppCheck: false,
}, async (request) => {
    var _a;
    try {
        const { documentId, userId, voice, force } = request.data || {};
        if (!documentId || !userId) {
            throw new Error("Missing required parameters: documentId and userId");
        }
        const { queryService } = createServices();
        const dbRef = db
            .collection("documents")
            .doc(userId)
            .collection("userDocuments")
            .doc(documentId)
            .collection("aiArtifacts")
            .doc("podcast_v1");
        // Attempt cache
        if (!force) {
            const cache = await dbRef.get();
            if (cache.exists) {
                const data = cache.data();
                const audioPath = data === null || data === void 0 ? void 0 : data.audioPath;
                if (audioPath) {
                    const file = storage.bucket().file(audioPath);
                    const [exists] = await file.exists();
                    if (exists) {
                        // Build Firebase download token URL
                        let token = data === null || data === void 0 ? void 0 : data.downloadToken;
                        const [meta] = await file.getMetadata();
                        const bucketName = storage.bucket().name;
                        const metaToken = ((_a = meta === null || meta === void 0 ? void 0 : meta.metadata) === null || _a === void 0 ? void 0 : _a.firebaseStorageDownloadTokens) || "";
                        if (!token) {
                            token = (metaToken === null || metaToken === void 0 ? void 0 : metaToken.split(",")[0]) || undefined;
                        }
                        if (!token) {
                            token = (0, crypto_1.randomUUID)();
                            await file.setMetadata({
                                metadata: { firebaseStorageDownloadTokens: token },
                            });
                        }
                        const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(audioPath)}?alt=media&token=${token}`;
                        return {
                            success: true,
                            data: {
                                audioUrl: mediaUrl,
                                audioPath,
                                voice: (data === null || data === void 0 ? void 0 : data.voice) || "alloy",
                                model: (data === null || data === void 0 ? void 0 : data.model) || "gpt-4o-mini-tts",
                                summary: (data === null || data === void 0 ? void 0 : data.summary) || "",
                            },
                        };
                    }
                }
            }
        }
        // Fetch summary: prefer stored summary, else generate
        let summary = "";
        try {
            const docSnap = await db
                .collection("documents")
                .doc(userId)
                .collection("userDocuments")
                .doc(documentId)
                .get();
            if (docSnap.exists) {
                const data = docSnap.data();
                summary = (data === null || data === void 0 ? void 0 : data.summary) || "";
            }
        }
        catch (_b) {
            /* ignore */
        }
        if (!summary || summary.trim().length < 40) {
            summary = await queryService.generateDocumentSummary(documentId, userId, 500);
        }
        // Limit input length for TTS to keep under model limits
        const ttsInput = summary.trim().slice(0, 4000);
        const openai = new openai_1.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const ttsModel = "gpt-4o-mini-tts"; // compact, good quality
        const ttsVoice = typeof voice === "string" && voice.trim() ? voice.trim() : "alloy";
        // Create speech audio (mp3)
        const speech = await openai.audio.speech.create({
            model: ttsModel,
            voice: ttsVoice,
            input: ttsInput,
        });
        const arrayBuf = await speech.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        // Save to Storage
        const audioPath = `podcasts/${userId}/${documentId}/${ttsVoice}.mp3`;
        const file = storage.bucket().file(audioPath);
        await file.save(buffer, { contentType: "audio/mpeg", resumable: false });
        // Set cache control and Firebase download token for public access via URL
        const token = (0, crypto_1.randomUUID)();
        await file.setMetadata({
            cacheControl: "public, max-age=3600",
            metadata: { firebaseStorageDownloadTokens: token },
            contentType: "audio/mpeg",
        });
        const bucketName = storage.bucket().name;
        const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(audioPath)}?alt=media&token=${token}`;
        // Cache metadata
        await dbRef.set({
            audioPath,
            voice: ttsVoice,
            model: ttsModel,
            summary: ttsInput,
            downloadToken: token,
            updatedAt: new Date(),
        }, { merge: true });
        return {
            success: true,
            data: {
                audioUrl: mediaUrl,
                audioPath,
                voice: ttsVoice,
                model: ttsModel,
                summary: ttsInput,
            },
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in generatePodcast:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
});
// Mind map generation trigger: when a new mind map doc is created with status 'generating'
exports.generateMindMap = (0, firestore_1.onDocumentWritten)("mindmaps/{mindMapId}", async (event) => {
    var _a, _b, _c, _d;
    try {
        const after = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.data();
        const before = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.before) === null || _d === void 0 ? void 0 : _d.data();
        const mindMapId = event.params.mindMapId;
        if (!after)
            return; // deleted
        if (before && before.structure && before.status === "ready")
            return; // already processed
        if (after.status !== "generating")
            return; // only process generating state
        const { prompt, language, userId, mode } = after;
        if (!prompt || !userId)
            return;
        const openai = new openai_1.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const system = `You create hierarchical JSON mind map structures. Return STRICT JSON only in this shape: {"root": {"title": string, "children": [{"title": string, "children": [...] }]}}. Depth max 4, each node max 6 words. No extraneous fields.`;
        const userPrompt = `Prompt: ${prompt}\nLanguage: ${language || "English"}\nMode: ${mode}`;
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            messages: [
                { role: "system", content: system },
                { role: "user", content: userPrompt },
            ],
            max_tokens: 800,
            response_format: { type: "json_object" },
        });
        let structure = null;
        try {
            const raw = completion.choices[0].message.content || "{}";
            structure = JSON.parse(raw);
        }
        catch (e) {
            structure = {
                root: { title: after.title || "Mind Map", children: [] },
            };
        }
        await db.collection("mindmaps").doc(mindMapId).set({
            structure,
            status: "ready",
            updatedAt: new Date(),
        }, { merge: true });
    }
    catch (err) {
        firebase_functions_1.logger.error("Mind map generation failed", err);
        const mindMapId = event.params.mindMapId;
        await db
            .collection("mindmaps")
            .doc(mindMapId)
            .set({
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
            updatedAt: new Date(),
        }, { merge: true });
    }
});
//# sourceMappingURL=index.js.map