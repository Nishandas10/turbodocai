"use strict";
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMindMap = exports.generatePodcast = exports.getDocumentText = exports.evaluateLongAnswer = exports.generateQuiz = exports.generateFlashcards = exports.generateSummary = exports.recommendPublicDocs = exports.queryDocuments = exports.sendChatMessage = exports.syncAllDocuments = exports.processDocument = exports.resolveUserByEmail = exports.createChat = void 0;
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
// Secrets: OpenAI API key is accessed via process.env.OPENAI_API_KEY (same as other functions)
// Initialize services (they will be created when functions are called)
const createServices = () => {
    return {
        documentProcessor: new services_1.DocumentProcessor(),
        embeddingService: new services_1.EmbeddingService(),
        pineconeService: new services_1.PineconeService(),
        queryService: new services_1.QueryService(),
    };
};
// ===== Topic classification config & helpers =====
// Keep in sync with Explore UI topics (excluding "For You")
const TOPICS = [
    "Chemistry",
    "Education",
    "Arts, Design & Media",
    "Languages & Literature",
    "History & Archaeology",
    "Philosophy & Ethics",
    "Social & Behavioural Sciences",
    "Journalism & Information",
    "Business Administration",
    "Law & Policy",
    "Biological Sciences",
    "Environmental Sciences",
    "Earth Sciences",
    "Physics",
    "Mathematics & Statistics",
    "Computer Science",
    "AI",
];
// Short descriptions improve embedding separation
const TOPIC_DESCRIPTIONS = {
    Chemistry: "Chemistry, molecules, reactions, organic, inorganic, physical chemistry, spectroscopy, lab methods",
    Education: "Teaching, learning, pedagogy, curriculum, assessment, classrooms, students, teachers",
    "Arts, Design & Media": "Art, design, graphic design, UX, UI, film, photography, music, media studies, visual arts",
    "Languages & Literature": "Linguistics, grammar, translation, literature analysis, novels, poetry, rhetoric",
    "History & Archaeology": "History, historical events, archaeology, ancient civilizations, cultural heritage",
    "Philosophy & Ethics": "Philosophy, ethics, morality, epistemology, metaphysics, logic, ethical dilemmas",
    "Social & Behavioural Sciences": "Psychology, sociology, anthropology, human behavior, surveys, social science",
    "Journalism & Information": "Journalism, news, reporting, information science, libraries, media law, fact-checking",
    "Business Administration": "Business, management, marketing, finance, operations, entrepreneurship, strategy",
    "Law & Policy": "Law, legal systems, regulation, public policy, governance, compliance, constitutional law",
    "Biological Sciences": "Biology, genetics, microbiology, physiology, ecology, evolution, biotechnology",
    "Environmental Sciences": "Environment, climate change, sustainability, ecology, conservation, pollution",
    "Earth Sciences": "Geology, geophysics, meteorology, oceanography, earth systems, tectonics, minerals",
    Physics: "Physics, mechanics, electromagnetism, quantum, thermodynamics, relativity, optics",
    "Mathematics & Statistics": "Mathematics, calculus, algebra, probability, statistics, data analysis, theorems",
    "Computer Science": "Computer science, algorithms, data structures, programming, systems, databases, software",
    AI: "Artificial intelligence, machine learning, deep learning, neural networks, LLMs, NLP, computer vision",
};
let cachedTopicEmbeddings = null;
function cosineSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        const va = a[i];
        const vb = b[i];
        dot += va * vb;
        na += va * va;
        nb += vb * vb;
    }
    if (!na || !nb)
        return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
async function getTopicEmbeddings(embeddingService) {
    if (cachedTopicEmbeddings)
        return cachedTopicEmbeddings;
    try {
        const inputs = TOPICS.map((t) => `${t}: ${TOPIC_DESCRIPTIONS[t] || t}`);
        const vectors = await embeddingService.embedChunks(inputs);
        cachedTopicEmbeddings = { labels: TOPICS.slice(), vectors };
        return cachedTopicEmbeddings;
    }
    catch (err) {
        firebase_functions_1.logger.warn("Failed to precompute topic embeddings; classification disabled", err);
        cachedTopicEmbeddings = { labels: TOPICS.slice(), vectors: [] };
        return cachedTopicEmbeddings;
    }
}
function selectDocTextForClassification(data) {
    var _a, _b, _c, _d;
    const title = String(data.title || "").slice(0, 200);
    const summary = String(data.summary || "").slice(0, 4000);
    const processed = String(((_a = data.content) === null || _a === void 0 ? void 0 : _a.processed) || "").slice(0, 4000);
    const raw = String(((_b = data.content) === null || _b === void 0 ? void 0 : _b.raw) || "").slice(0, 4000);
    const meta = [data.type, (_c = data.metadata) === null || _c === void 0 ? void 0 : _c.fileName, (_d = data.metadata) === null || _d === void 0 ? void 0 : _d.mimeType]
        .filter(Boolean)
        .join(" ");
    const base = [title, summary, processed, raw, meta]
        .filter(Boolean)
        .join("\n");
    return base || title || meta || "";
}
async function classifyTopics(data, embeddingService) {
    try {
        const text = selectDocTextForClassification(data);
        if (!text || text.length < 10)
            return [];
        const topicEmb = await getTopicEmbeddings(embeddingService);
        if (!topicEmb.vectors.length)
            return [];
        const docVec = await embeddingService.embedQuery(text);
        const scores = topicEmb.vectors.map((v, i) => ({
            label: topicEmb.labels[i],
            score: cosineSim(docVec, v),
        }));
        // Pick top 1-3 topics above threshold; ensure AI + CS example maps well
        scores.sort((a, b) => b.score - a.score);
        const threshold = 0.25; // conservative; adjust with real data
        const top = scores.filter((s) => s.score >= threshold).slice(0, 3);
        if (top.length)
            return top.map((t) => t.label);
        // Fallback: just the best one if nothing crossed threshold
        return scores.slice(0, 1).map((s) => s.label);
    }
    catch (err) {
        firebase_functions_1.logger.warn("Topic classification failed", err);
        return [];
    }
}
function mergeTags(existing, computed) {
    const base = Array.isArray(existing) ? existing.map(String) : [];
    const set = new Set(base);
    for (const t of computed)
        set.add(t);
    // Remove undesired system tags
    set.delete("uploaded");
    return Array.from(set);
}
/**
 * Lightweight callable to create a chat and return chatId immediately.
 * Data: { userId: string, language?: string, title?: string }
 * Returns: { success, data: { chatId } }
 */
exports.createChat = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    try {
        const { userId, language, title, contextDocIds } = request.data || {};
        if (!userId)
            throw new Error("Missing required parameter: userId");
        if (request.auth && request.auth.uid && request.auth.uid !== userId) {
            throw new Error("Authenticated user mismatch");
        }
        const chatRef = await db.collection("chats").add({
            userId,
            title: (title || "New Chat").toString().slice(0, 60) || "New Chat",
            language: language || "en",
            model: "gpt-4o-mini",
            contextDocIds: Array.isArray(contextDocIds)
                ? contextDocIds.slice(0, 8)
                : [],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        return { success: true, data: { chatId: chatRef.id } };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in createChat:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
});
/**
 * Resolve a user by email. Returns minimal info to support sharing invites.
 * Request: { email: string }
 * Response: { success: boolean, data?: { userId: string, displayName?: string, photoURL?: string }, error?: string }
 */
exports.resolveUserByEmail = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    try {
        const { email } = request.data || {};
        if (!request.auth)
            throw new Error("Authentication required");
        if (!email || typeof email !== "string")
            throw new Error("Missing email");
        const norm = String(email).toLowerCase().trim();
        const snap = await db
            .collection("users")
            .where("email", "==", norm)
            .limit(1)
            .get();
        if (snap.empty)
            return { success: true, data: null };
        const d = snap.docs[0];
        const data = d.data();
        return {
            success: true,
            data: {
                userId: d.id,
                displayName: (data === null || data === void 0 ? void 0 : data.displayName) || "",
                photoURL: (data === null || data === void 0 ? void 0 : data.photoURL) || "",
            },
        };
    }
    catch (err) {
        firebase_functions_1.logger.error("resolveUserByEmail error", err);
        return {
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        };
    }
});
/**
 * Cloud Function triggered when a document is created or updated in Firestore
 * Processes documents through the RAG pipeline:
 * - For PDF: Extract with pdf-parse, chunk, embed with text-embedding-3-small (1024 dims) and store in Pinecone (existing flow)
 * - For DOC/DOCX: Extract with Mammoth, upload full text to OpenAI Vector Store (OpenAI handles chunk+embedding using text-embedding-3-large); do not store in Pinecone.
 */
exports.processDocument = (0, firestore_1.onDocumentWritten)("documents/{userId}/userDocuments/{documentId}", async (event) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const afterSnap = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after;
    const beforeSnap = (_b = event.data) === null || _b === void 0 ? void 0 : _b.before;
    const documentData = afterSnap === null || afterSnap === void 0 ? void 0 : afterSnap.data();
    const { userId, documentId } = event.params;
    if (!documentData) {
        firebase_functions_1.logger.error("No document data found");
        return;
    }
    firebase_functions_1.logger.info(`Processing document ${documentId} for user ${userId}`);
    firebase_functions_1.logger.info(`Document data:`, {
        type: documentData.type,
        storagePath: (_c = documentData.metadata) === null || _c === void 0 ? void 0 : _c.storagePath,
        title: documentData.title,
    });
    try {
        // Run only on create or when storagePath first appears/changes
        const beforeData = (beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.exists) ? beforeSnap.data() : undefined;
        const created = !(beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.exists) && !!(afterSnap === null || afterSnap === void 0 ? void 0 : afterSnap.exists);
        const storagePathAdded = !!((_d = documentData === null || documentData === void 0 ? void 0 : documentData.metadata) === null || _d === void 0 ? void 0 : _d.storagePath) &&
            (!((_e = beforeData === null || beforeData === void 0 ? void 0 : beforeData.metadata) === null || _e === void 0 ? void 0 : _e.storagePath) ||
                ((_f = beforeData === null || beforeData === void 0 ? void 0 : beforeData.metadata) === null || _f === void 0 ? void 0 : _f.storagePath) !==
                    ((_g = documentData === null || documentData === void 0 ? void 0 : documentData.metadata) === null || _g === void 0 ? void 0 : _g.storagePath));
        if (!created && !storagePathAdded) {
            firebase_functions_1.logger.info("Skipping event: not a create or storagePath change", {
                created,
                storagePathAdded,
            });
            return;
        }
        // Initialize services
        const { documentProcessor, embeddingService, pineconeService } = createServices();
        // Only proceed when we have a storage path
        if (!((_h = documentData.metadata) === null || _h === void 0 ? void 0 : _h.storagePath)) {
            firebase_functions_1.logger.info(`Document ${documentId} doesn't have storagePath yet, will process when storage info is updated`);
            return;
        }
        // Skip if already processed
        if (documentData.processingStatus === "completed" ||
            documentData.processingStatus === "processing") {
            firebase_functions_1.logger.info(`Document ${documentId} already processed or currently processing, skipping`);
            return;
        }
        // Acquire processing lock via transaction to avoid duplicate runs
        const docRef = db
            .collection("documents")
            .doc(userId)
            .collection("userDocuments")
            .doc(documentId);
        const acquired = await db.runTransaction(async (tx) => {
            const snap = await tx.get(docRef);
            const data = snap.data() || {};
            if (data.processingStatus === "processing" ||
                data.processingStatus === "completed") {
                return false; // someone else is processing or it's done
            }
            tx.update(docRef, {
                processingStatus: "processing",
                processingStartedAt: new Date(),
                processingLock: {
                    event: (event === null || event === void 0 ? void 0 : event.id) || (0, crypto_1.randomUUID)(),
                    at: new Date(),
                },
            });
            return true;
        });
        if (!acquired) {
            firebase_functions_1.logger.info("Processing lock not acquired; exiting");
            return;
        }
        // Step 1: Download file from Firebase Storage
        firebase_functions_1.logger.info("Downloading file from storage...");
        const fileBuffer = await downloadFileFromStorage(documentData.metadata.storagePath);
        const docType = (documentData.type || "").toLowerCase();
        let extractedText = "";
        if (docType === "pdf") {
            firebase_functions_1.logger.info("Extracting text from PDF...");
            extractedText = await documentProcessor.extractTextFromPDF(fileBuffer);
        }
        else if (docType === "docx") {
            firebase_functions_1.logger.info("Extracting text from DOCX via Mammoth...");
            extractedText = await documentProcessor.extractTextFromDOCX(fileBuffer);
        }
        else if (docType === "pptx") {
            firebase_functions_1.logger.info("Extracting text from PPTX...");
            extractedText = await documentProcessor.extractTextFromPPTX(fileBuffer);
        }
        else {
            firebase_functions_1.logger.info(`Unsupported document type for processing: ${docType}`);
            return;
        }
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
        // If PDF: continue existing Pinecone streaming pipeline
        if (docType === "pdf") {
            // Streaming chunk generation to avoid holding all chunks
            function* generateChunks(text, chunkSize = 300, overlap = 20) {
                const words = text.split(/\s+/);
                let start = 0;
                while (start < words.length) {
                    const end = Math.min(start + chunkSize, words.length);
                    const chunk = words.slice(start, end).join(" ").trim();
                    if (chunk)
                        yield chunk;
                    // If we've reached the end, stop to avoid repeating the last window forever
                    if (end >= words.length)
                        break;
                    const nextStart = end - overlap;
                    // Safety: ensure forward progress
                    start = Math.max(nextStart, start + 1);
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
                        fileName: (_j = documentData.metadata) === null || _j === void 0 ? void 0 : _j.fileName,
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
                processingLock: null,
            });
            firebase_functions_1.logger.info(`Successfully processed document ${documentId} with ${chunkCount} chunks`);
            return; // PDF path done
        }
        // DOCX/PPTX path: upload text to OpenAI Vector Store (no Pinecone)
        if (docType === "docx" || docType === "pptx") {
            const workingText = extractedText;
            const vsId = process.env.OPENAI_VECTOR_STORE_ID || "";
            const openaiVS = new services_1.OpenAIVectorStoreService(vsId);
            // Update progress early
            await db
                .collection("documents")
                .doc(userId)
                .collection("userDocuments")
                .doc(documentId)
                .set({
                processingStatus: "processing",
                processingProgress: 20,
            }, { merge: true });
            const vsUpload = await openaiVS.uploadTextAsDocument(workingText, {
                userId,
                documentId,
                title: documentData.title,
                fileName: (_k = documentData.metadata) === null || _k === void 0 ? void 0 : _k.fileName,
            });
            // Persist the full raw transcript to Cloud Storage to avoid Firestore doc size limits
            const transcriptPath = `transcripts/${userId}/${documentId}.txt`;
            try {
                await storage.bucket().file(transcriptPath).save(workingText, {
                    contentType: "text/plain; charset=utf-8",
                });
                firebase_functions_1.logger.info("Saved DOCX transcript to storage", { transcriptPath });
            }
            catch (e) {
                firebase_functions_1.logger.warn("Failed to save DOCX transcript to storage", e);
            }
            // Update Firestore with processed content and status
            await db
                .collection("documents")
                .doc(userId)
                .collection("userDocuments")
                .doc(documentId)
                .update({
                // Keep a smaller inline preview to stay well under Firestore limits
                "content.raw": workingText.slice(0, 200000),
                "content.processed": `Indexed to OpenAI Vector Store`,
                "metadata.openaiVector": {
                    vectorStoreId: openaiVS.getVectorStoreId(),
                    fileId: vsUpload.fileId,
                    vectorStoreFileId: vsUpload.vectorStoreFileId,
                },
                // Store transcript file path for full-text retrieval in UI
                "metadata.transcriptPath": transcriptPath,
                processingStatus: "completed",
                processingCompletedAt: new Date(),
                // Remove chunkCount field if present; cannot set undefined in Firestore update
                chunkCount: firestore_2.FieldValue.delete(),
                characterCount: workingText.length,
                truncated: false,
                processingProgress: 100,
                processingLock: null,
            });
            firebase_functions_1.logger.info(`Successfully processed ${docType.toUpperCase()} document ${documentId} into OpenAI Vector Store`);
        }
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
            processingLock: null,
        });
    }
});
/**
 * Mirror nested user document to top-level /userDocuments for public Explore.
 * Doc id format: `${ownerId}_${documentId}` to keep unique and traceable.
 * On delete, remove mirror.
 */
// Single handler: mirror on create, delete on delete, and only update isPublic on updates
exports.syncAllDocuments = (0, firestore_1.onDocumentWritten)("documents/{userId}/userDocuments/{documentId}", async (event) => {
    var _a, _b, _c, _d, _e;
    const beforeSnap = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before;
    const afterSnap = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after;
    const { userId, documentId } = event.params;
    const mirrorId = `${userId}_${documentId}`;
    const allRef = db.collection("allDocuments").doc(mirrorId);
    // Delete mirror when source is deleted
    if (!(afterSnap === null || afterSnap === void 0 ? void 0 : afterSnap.exists) && (beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.exists)) {
        try {
            await allRef.delete();
            firebase_functions_1.logger.info("Deleted mirror in allDocuments", { mirrorId });
        }
        catch (err) {
            firebase_functions_1.logger.warn("Failed to delete mirror doc in allDocuments", {
                mirrorId,
                err,
            });
        }
        return;
    }
    // Create mirror on new document
    if (!(beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.exists) && (afterSnap === null || afterSnap === void 0 ? void 0 : afterSnap.exists)) {
        const data = afterSnap.data();
        if (!data)
            return;
        try {
            // Attempt to classify topics using embeddings
            const { embeddingService } = createServices();
            const topics = await classifyTopics(data, embeddingService);
            // Compute a single keyword embedding for later discovery
            let keywordEmbedding = undefined;
            try {
                const text = selectDocTextForClassification(data);
                if (text && text.length > 10) {
                    keywordEmbedding = await embeddingService.embedQuery(text);
                }
            }
            catch (e) {
                firebase_functions_1.logger.warn("keywordEmbedding generation failed (create)", e);
            }
            const payload = Object.assign(Object.assign(Object.assign(Object.assign({}, data), { tags: mergeTags(data.tags, topics) }), (keywordEmbedding ? { keywordEmbedding } : {})), { updatedAt: new Date() });
            await allRef.set(payload, { merge: false });
            firebase_functions_1.logger.info("Created mirror in allDocuments (with topics)", {
                mirrorId,
                topics,
            });
        }
        catch (err) {
            firebase_functions_1.logger.error("Failed to create mirror doc in allDocuments", {
                mirrorId,
                err,
            });
        }
        return;
    }
    // Update mirror on key changes: isPublic toggles OR processing completed (to reclassify with full text)
    if ((beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.exists) && (afterSnap === null || afterSnap === void 0 ? void 0 : afterSnap.exists)) {
        const before = beforeSnap.data() || {};
        const after = afterSnap.data() || {};
        const beforePublic = !!before.isPublic;
        const afterPublic = !!after.isPublic;
        const processingCompletedNow = before.processingStatus !== "completed" &&
            after.processingStatus === "completed";
        const titleChanged = String(before.title || "") !== String(after.title || "");
        const summaryChanged = String(before.summary || "") !== String(after.summary || "");
        const contentRawChanged = String(((_c = before.content) === null || _c === void 0 ? void 0 : _c.raw) || "") !== String(((_d = after.content) === null || _d === void 0 ? void 0 : _d.raw) || "");
        const shouldReclassify = processingCompletedNow ||
            titleChanged ||
            summaryChanged ||
            contentRawChanged;
        if (!shouldReclassify && beforePublic === afterPublic)
            return;
        try {
            const mirrorSnap = await allRef.get();
            const mirrorExists = mirrorSnap.exists;
            // Prepare payload
            let payload = { updatedAt: new Date() };
            // Always sync isPublic changes
            if (beforePublic !== afterPublic) {
                payload.isPublic = afterPublic;
            }
            // If we have meaningful content updates, recompute topics
            if (shouldReclassify) {
                try {
                    const { embeddingService } = createServices();
                    const topics = await classifyTopics(after, embeddingService);
                    payload.tags = mergeTags(mirrorExists ? (_e = mirrorSnap.data()) === null || _e === void 0 ? void 0 : _e.tags : after.tags, topics);
                    // Recompute keyword embedding for updated content
                    try {
                        const text = selectDocTextForClassification(after);
                        if (text && text.length > 10) {
                            payload.keywordEmbedding = await embeddingService.embedQuery(text);
                        }
                    }
                    catch (e) {
                        firebase_functions_1.logger.warn("keywordEmbedding generation failed (update)", {
                            mirrorId,
                            e,
                        });
                    }
                    firebase_functions_1.logger.info("Reclassified topics for mirror", { mirrorId, topics });
                }
                catch (e) {
                    firebase_functions_1.logger.warn("Reclassification failed", { mirrorId, e });
                }
            }
            if (!mirrorExists) {
                await allRef.set(Object.assign(Object.assign({}, after), payload), { merge: false });
                firebase_functions_1.logger.info("Backfilled mirror in allDocuments on update", {
                    mirrorId,
                });
            }
            else if (Object.keys(payload).length > 0) {
                await allRef.set(payload, { merge: true });
                firebase_functions_1.logger.info("Updated mirror in allDocuments", {
                    mirrorId,
                    fields: Object.keys(payload),
                });
            }
        }
        catch (err) {
            firebase_functions_1.logger.error("Failed to update mirror in allDocuments", {
                mirrorId,
                err,
            });
        }
    }
});
/**
 * Callable function to create/continue a chat and generate an assistant reply.
 * Data: { userId: string, prompt: string, language?: string, chatId?: string }
 * Returns: { success, data: { chatId, answer } }
 */
exports.sendChatMessage = (0, https_1.onCall)({
    enforceAppCheck: false,
}, async (request) => {
    var _a, e_1, _b, _c;
    var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10;
    try {
        const { userId, prompt, language, chatId, docIds, webSearch, thinkMode } = request.data || {};
        if (!userId || !prompt || typeof prompt !== "string") {
            throw new Error("Missing required parameters: userId and prompt");
        }
        if (request.auth && request.auth.uid && request.auth.uid !== userId) {
            throw new Error("Authenticated user mismatch");
        }
        const openai = new openai_1.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const model = webSearch
            ? "gpt-4.1"
            : thinkMode
                ? "o3-mini"
                : "gpt-4o-mini";
        // Create or fetch chat document
        let chatDocId = chatId;
        if (!chatDocId) {
            const title = prompt.trim().slice(0, 60);
            const chatRef = await db.collection("chats").add({
                userId,
                title: title || "New Chat",
                language: language || "en",
                model,
                contextDocIds: Array.isArray(docIds) ? docIds.slice(0, 8) : [],
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            chatDocId = chatRef.id;
        }
        else {
            await db
                .collection("chats")
                .doc(chatDocId)
                .set(Object.assign({ updatedAt: new Date(), language: language || "en", model }, (Array.isArray(docIds) && docIds.length
                ? { contextDocIds: docIds.slice(0, 8) }
                : {})), { merge: true });
        }
        const messagesCol = db
            .collection("chats")
            .doc(chatDocId)
            .collection("messages");
        // Add user's message if not already last
        try {
            const lastSnap = await messagesCol
                .orderBy("createdAt", "desc")
                .limit(1)
                .get();
            const last = (_d = lastSnap.docs[0]) === null || _d === void 0 ? void 0 : _d.data();
            const sameContent = last && String(last.content) === String(prompt);
            const isUser = last && last.role === "user";
            if (!(sameContent && isUser)) {
                await messagesCol.add({
                    role: "user",
                    content: String(prompt),
                    createdAt: new Date(),
                });
            }
        }
        catch (dupeErr) {
            firebase_functions_1.logger.warn("User message duplicate check failed", dupeErr);
        }
        // Load last messages for context
        const recentSnap = await messagesCol
            .orderBy("createdAt", "asc")
            .limit(20)
            .get();
        const convo = recentSnap.docs.map((d) => d.data());
        // Active context documents
        let activeDocIds = [];
        try {
            if (Array.isArray(docIds) && docIds.length) {
                activeDocIds = docIds.slice(0, 8);
            }
            else {
                const chatSnap = await db.collection("chats").doc(chatDocId).get();
                const data = chatSnap.data();
                if (Array.isArray(data === null || data === void 0 ? void 0 : data.contextDocIds))
                    activeDocIds = data.contextDocIds.slice(0, 8);
            }
        }
        catch (e) {
            firebase_functions_1.logger.warn("Could not load contextDocIds", e);
        }
        // Optional RAG retrieval
        let docsContext = "";
        let vectorStoreIds = [];
        if (activeDocIds.length) {
            // Inspect whether any of the context docs were indexed in OpenAI Vector Store (DOCX path)
            try {
                const metaSnaps = await Promise.all(activeDocIds.map((id) => db
                    .collection("documents")
                    .doc(userId)
                    .collection("userDocuments")
                    .doc(id)
                    .get()));
                vectorStoreIds = Array.from(new Set(metaSnaps
                    .map((s) => s.data())
                    .map((d) => { var _a, _b; return (_b = (_a = d === null || d === void 0 ? void 0 : d.metadata) === null || _a === void 0 ? void 0 : _a.openaiVector) === null || _b === void 0 ? void 0 : _b.vectorStoreId; })
                    .filter(Boolean)));
            }
            catch (e) {
                firebase_functions_1.logger.warn("Failed to read doc metadata for vector store IDs", e);
            }
            if (vectorStoreIds.length === 0) {
                // Pinecone-based retrieval (PDF path)
                try {
                    const { embeddingService, pineconeService } = createServices();
                    const queryEmbedding = await embeddingService.embedQuery(String(prompt));
                    const perDoc = 3;
                    const aggregated = [];
                    for (const dId of activeDocIds) {
                        try {
                            const matches = await pineconeService.querySimilarChunks(queryEmbedding, userId, perDoc * 2, dId);
                            const seen = new Set();
                            for (const m of matches) {
                                const idx = String(m.id).split("_").pop() || String(m.id);
                                if (seen.has(idx))
                                    continue;
                                seen.add(idx);
                                aggregated.push({
                                    docId: dId,
                                    title: m.title || dId,
                                    chunk: m.chunk,
                                    score: m.score,
                                });
                                if (seen.size >= perDoc)
                                    break;
                            }
                        }
                        catch (inner) {
                            firebase_functions_1.logger.warn("RAG doc retrieval failed", { docId: dId, inner });
                        }
                    }
                    aggregated.sort((a, b) => b.score - a.score);
                    const MAX_CONTEXT_CHARS = 12000;
                    const pieces = [];
                    let used = 0;
                    for (const a of aggregated) {
                        const clean = a.chunk.replace(/\s+/g, " ").trim();
                        if (!clean)
                            continue;
                        const snippet = clean.slice(0, 1000);
                        const block = `DOC ${a.docId} | ${a.title}\n${snippet}`;
                        if (used + block.length > MAX_CONTEXT_CHARS)
                            break;
                        pieces.push(block);
                        used += block.length;
                    }
                    if (pieces.length) {
                        docsContext = `Retrieved document context (do not fabricate beyond this unless using general knowledge cautiously):\n\n${pieces.join("\n\n---\n\n")}`;
                    }
                }
                catch (ragErr) {
                    firebase_functions_1.logger.warn("RAG retrieval failed, falling back to no docsContext", ragErr);
                }
            }
        }
        let baseInstruction = "You are a helpful AI assistant. When a vector store is attached, you MUST ground answers strictly on retrieved files via the file_search tool. When only plain context blocks are provided, prefer grounded answers using those. If context is insufficient, say so and optionally ask for more info. Keep responses concise and clear. Use markdown when helpful.";
        if (webSearch) {
            baseInstruction +=
                "\n\nWeb browsing is permitted via the web_search tool. Use it when the question requires up-to-date or external information. Summarize findings and cite source domains briefly (e.g., example.com).";
        }
        const sysContent = docsContext
            ? `${baseInstruction}\n\n${docsContext}`
            : baseInstruction;
        const sysMsg = { role: "system", content: sysContent };
        const chatMessages = [
            sysMsg,
            ...convo.map((m) => ({ role: m.role, content: m.content })),
        ];
        // Assistant placeholder
        const assistantRef = await messagesCol.add({
            role: "assistant",
            content: "",
            createdAt: new Date(),
            streaming: true,
        });
        let buffered = "";
        let lastUpdate = Date.now();
        const flush = async (final = false) => {
            try {
                await assistantRef.set({
                    content: buffered,
                    streaming: final ? false : true,
                    updatedAt: new Date(),
                }, { merge: true });
                await db
                    .collection("chats")
                    .doc(chatDocId)
                    .set({ updatedAt: new Date() }, { merge: true });
            }
            catch (e) {
                firebase_functions_1.logger.warn("Failed to flush streaming token to Firestore", e);
            }
        };
        const streamOut = async (fullText) => {
            try {
                const chunkSize = 48; // characters per flush
                const delayMs = 24; // pacing for smoother UI
                buffered = "";
                for (let i = 0; i < fullText.length; i += chunkSize) {
                    buffered += fullText.slice(i, i + chunkSize);
                    await flush(false);
                    await new Promise((r) => setTimeout(r, delayMs));
                }
                await flush(true);
            }
            catch (e) {
                firebase_functions_1.logger.warn("streamOut failed; falling back to single flush", e);
                buffered = fullText;
                await flush(true);
            }
        };
        try {
            // Prefer OpenAI file_search when DOCX/PPTX vector stores are in context
            if (vectorStoreIds.length) {
                // Use regular chat completions with system message about available documents
                const systemMessage = {
                    role: "system",
                    content: `${baseInstruction}\n\nNote: You have access to document content via context. Answer based on the conversation and any provided document context.`
                };
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    temperature: 0.2,
                    messages: [systemMessage, ...chatMessages.slice(1)],
                    max_tokens: 1200,
                });
                const fullText = ((_g = (_f = (_e = completion.choices) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.message) === null || _g === void 0 ? void 0 : _g.content) || "I'm sorry, I couldn't generate a response.";
                await streamOut(String(fullText));
            }
            else if (webSearch) {
                // Non-streaming Responses API with web_search tool (gpt-4.1)
                const input = chatMessages.map((m) => ({
                    role: m.role,
                    content: [
                        {
                            type: m.role === "assistant"
                                ? "output_text"
                                : "input_text",
                            text: String(m.content || ""),
                        },
                    ],
                }));
                const resp = await openai.responses.create({
                    model,
                    input,
                    tools: [{ type: "web_search" }],
                });
                const fullText = (resp === null || resp === void 0 ? void 0 : resp.output_text) ||
                    ((_l = (_k = (_j = (_h = resp === null || resp === void 0 ? void 0 : resp.output) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.content) === null || _k === void 0 ? void 0 : _k[0]) === null || _l === void 0 ? void 0 : _l.text) ||
                    ((_q = (_p = (_o = (_m = resp === null || resp === void 0 ? void 0 : resp.data) === null || _m === void 0 ? void 0 : _m[0]) === null || _o === void 0 ? void 0 : _o.content) === null || _p === void 0 ? void 0 : _p[0]) === null || _q === void 0 ? void 0 : _q.text) ||
                    ((_t = (_s = (_r = resp === null || resp === void 0 ? void 0 : resp.choices) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.message) === null || _t === void 0 ? void 0 : _t.content) ||
                    "I'm sorry, I couldn't generate a response.";
                await streamOut(String(fullText));
            }
            else if (thinkMode) {
                // Non-streaming Responses API for reasoning model o3-mini
                const input = chatMessages.map((m) => ({
                    role: m.role,
                    content: [
                        {
                            type: m.role === "assistant"
                                ? "output_text"
                                : "input_text",
                            text: String(m.content || ""),
                        },
                    ],
                }));
                const resp = await openai.responses.create({
                    model,
                    input,
                });
                const fullText = (resp === null || resp === void 0 ? void 0 : resp.output_text) ||
                    ((_x = (_w = (_v = (_u = resp === null || resp === void 0 ? void 0 : resp.output) === null || _u === void 0 ? void 0 : _u[0]) === null || _v === void 0 ? void 0 : _v.content) === null || _w === void 0 ? void 0 : _w[0]) === null || _x === void 0 ? void 0 : _x.text) ||
                    ((_1 = (_0 = (_z = (_y = resp === null || resp === void 0 ? void 0 : resp.data) === null || _y === void 0 ? void 0 : _y[0]) === null || _z === void 0 ? void 0 : _z.content) === null || _0 === void 0 ? void 0 : _0[0]) === null || _1 === void 0 ? void 0 : _1.text) ||
                    ((_4 = (_3 = (_2 = resp === null || resp === void 0 ? void 0 : resp.choices) === null || _2 === void 0 ? void 0 : _2[0]) === null || _3 === void 0 ? void 0 : _3.message) === null || _4 === void 0 ? void 0 : _4.content) ||
                    "I'm sorry, I couldn't generate a response.";
                await streamOut(String(fullText));
            }
            else {
                // Normal streaming path
                const stream = await openai.chat.completions.create({
                    model,
                    temperature: thinkMode ? 0.2 : 0.7,
                    messages: chatMessages,
                    stream: true,
                });
                try {
                    for (var _11 = true, _12 = __asyncValues(stream), _13; _13 = await _12.next(), _a = _13.done, !_a; _11 = true) {
                        _c = _13.value;
                        _11 = false;
                        const part = _c;
                        const delta = ((_7 = (_6 = (_5 = part === null || part === void 0 ? void 0 : part.choices) === null || _5 === void 0 ? void 0 : _5[0]) === null || _6 === void 0 ? void 0 : _6.delta) === null || _7 === void 0 ? void 0 : _7.content) || "";
                        if (delta)
                            buffered += delta;
                        const now = Date.now();
                        if (now - lastUpdate > 250) {
                            await flush(false);
                            lastUpdate = now;
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_11 && !_a && (_b = _12.return)) await _b.call(_12);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                await flush(true);
            }
        }
        catch (genErr) {
            firebase_functions_1.logger.error("OpenAI generation failed", genErr);
            try {
                const fallbackModel = webSearch || (typeof model === "string" && model.startsWith("o3"))
                    ? "gpt-4o-mini"
                    : model;
                const completion = await openai.chat.completions.create({
                    model: fallbackModel,
                    temperature: thinkMode ? 0.2 : 0.7,
                    messages: chatMessages,
                });
                buffered =
                    ((_10 = (_9 = (_8 = completion.choices) === null || _8 === void 0 ? void 0 : _8[0]) === null || _9 === void 0 ? void 0 : _9.message) === null || _10 === void 0 ? void 0 : _10.content) ||
                        "I'm sorry, I couldn't generate a response.";
                await flush(true);
            }
            catch (fallbackErr) {
                firebase_functions_1.logger.error("OpenAI fallback also failed", fallbackErr);
                buffered = "I'm sorry, an error occurred generating the response.";
                await flush(true);
            }
        }
        if (!chatId) {
            const title = prompt.trim().slice(0, 60);
            await db
                .collection("chats")
                .doc(chatDocId)
                .set({ title: title || "New Chat" }, { merge: true });
        }
        return { success: true, data: { chatId: chatDocId } };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in sendChatMessage:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
});
// Web search now uses OpenAI Responses API (gpt-4.1 tools-web-search); no third-party providers.
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
 * Recommend public docs similar to a user's document using keyword embeddings.
 * Input: { userId: string, documentId: string, limit?: number }
 * Returns: ranked list of { id, title, ownerId, tags, score }
 */
exports.recommendPublicDocs = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    try {
        const { userId, documentId, limit } = request.data || {};
        if (!userId || !documentId) {
            throw new Error("Missing required parameters: userId and documentId");
        }
        if (request.auth && request.auth.uid && request.auth.uid !== userId) {
            throw new Error("Authenticated user mismatch");
        }
        // Load the user's source doc to get a query embedding
        const userDocSnap = await db
            .collection("documents")
            .doc(userId)
            .collection("userDocuments")
            .doc(documentId)
            .get();
        if (!userDocSnap.exists)
            throw new Error("Document not found");
        const src = userDocSnap.data();
        let queryEmbedding = undefined;
        try {
            // Prefer stored keywordEmbedding from mirror if available, else compute from source
            const mirrorId = `${userId}_${documentId}`;
            const mirrorSnap = await db
                .collection("allDocuments")
                .doc(mirrorId)
                .get();
            const mirror = mirrorSnap.data();
            if (Array.isArray(mirror === null || mirror === void 0 ? void 0 : mirror.keywordEmbedding)) {
                queryEmbedding = mirror.keywordEmbedding;
            }
        }
        catch (_a) {
            /* ignore */
        }
        if (!queryEmbedding) {
            const { embeddingService } = createServices();
            const text = selectDocTextForClassification(src);
            if (!text || text.length < 10)
                throw new Error("No content to compute embedding");
            queryEmbedding = await embeddingService.embedQuery(text);
        }
        // Fetch a pool of public docs (exclude the owner's own doc)
        const poolSnap = await db
            .collection("allDocuments")
            .where("isPublic", "==", true)
            .orderBy("createdAt", "desc")
            .limit(Math.min(Number(limit) || 80, 200))
            .get();
        const rawCandidates = poolSnap.docs.map((d) => ({
            id: d.id,
            data: d.data(),
        }));
        const myPrefix = `${userId}_`;
        const candidates = rawCandidates.filter((d) => {
            var _a, _b;
            return Array.isArray((_a = d.data) === null || _a === void 0 ? void 0 : _a.keywordEmbedding) &&
                ((_b = d.data) === null || _b === void 0 ? void 0 : _b.ownerId) !== userId &&
                !String(d.id).startsWith(myPrefix);
        });
        // Rank by cosine similarity and return enriched fields
        const scored = candidates
            .map((c) => {
            const score = cosineSim(queryEmbedding, c.data.keywordEmbedding);
            const out = {
                id: c.id,
                ownerId: c.data.ownerId,
                title: c.data.title,
                type: c.data.type,
                status: c.data.status,
                isPublic: c.data.isPublic,
                tags: c.data.tags,
                preview: c.data.preview,
                storagePath: c.data.storagePath,
                masterUrl: c.data.masterUrl,
                content: c.data.content,
                summary: c.data.summary,
                metadata: c.data.metadata,
                createdAt: c.data.createdAt,
                updatedAt: c.data.updatedAt,
                stats: c.data.stats,
                score,
            };
            return out;
        })
            .sort((a, b) => b.score - a.score)
            .slice(0, Math.min(Number(limit) || 20, 50));
        return { success: true, data: scored };
    }
    catch (error) {
        firebase_functions_1.logger.error("recommendPublicDocs failed", error);
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
        const { documentId, userId, count, forceNew } = request.data || {};
        if (!documentId || !userId) {
            throw new Error("Missing required parameters: documentId and userId");
        }
        const { queryService } = createServices();
        const cards = await queryService.generateFlashcards(documentId, userId, count || 12, forceNew);
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
        const { documentId, userId, count, difficulty, forceNew } = request.data || {};
        if (!documentId || !userId) {
            throw new Error("Missing required parameters: documentId and userId");
        }
        const { queryService } = createServices();
        const questions = await queryService.generateQuiz(documentId, userId, count || 10, difficulty || "mixed", forceNew);
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
 * Callable function: Semantically evaluate a student's long-form answer against a reference.
 * Uses OpenAI gpt-4o-mini with strict JSON output. Treats varied grammar/style as correct if core logic matches.
 * Input: { userId: string, userAnswer: string, referenceAnswer: string, minLength?: number }
 * Returns: { verdict: 'correct'|'incorrect'|'insufficient', score: 0-100, reasoning: string, keyPoints?: string[], missingPoints?: string[] }
 */
exports.evaluateLongAnswer = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    var _a, _b, _c, _d, _e, _f;
    try {
        const { userId, userAnswer, referenceAnswer, minLength } = request.data || {};
        if (!userId || !userAnswer || !referenceAnswer) {
            throw new Error("Missing required parameters: userId, userAnswer, referenceAnswer");
        }
        if (request.auth && request.auth.uid && request.auth.uid !== userId) {
            throw new Error("Authenticated user mismatch");
        }
        const minChars = Math.max(40, Math.min(2000, Number(minLength) || 120));
        const trimmed = String(userAnswer).trim();
        if (trimmed.length < minChars) {
            return {
                success: true,
                data: {
                    verdict: "insufficient",
                    score: 0,
                    reasoning: `Answer too brief for a long question (min ~${minChars} characters). Provide more detail and key steps.`,
                    keyPoints: [],
                    missingPoints: [],
                },
            };
        }
        const openai = new openai_1.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const system = "You are a fair, strict grader for long-form answers. Grade SEMANTICALLY: consider meaning, core logic, and conceptual correctness — not phrasing or style. An answer is CORRECT if it captures the essential ideas, steps, and reasoning even with different wording. Mark INCORRECT if key logic is wrong or major concepts are missing. Mark INSUFFICIENT if the response is too short or vague for a long question. Respond ONLY with strict JSON.";
        const schemaHint = '{"verdict":"correct|incorrect|insufficient","score":0-100,"reasoning":"short explanation","keyPoints":["..."],"missingPoints":["..."]}';
        const userMsg = `Reference Answer:\n${String(referenceAnswer)}\n\nStudent Answer:\n${trimmed}\n\nReturn JSON in this shape: ${schemaHint}. Score reflects semantic coverage (not style).`;
        let parsed = {
            verdict: "incorrect",
            score: 0,
            reasoning: "Failed to parse model output",
            keyPoints: [],
            missingPoints: [],
        };
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                temperature: 0.0,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: userMsg },
                ],
                response_format: { type: "json_object" },
                max_tokens: 350,
            });
            const raw = ((_c = (_b = (_a = completion.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || "{}";
            parsed = JSON.parse(raw);
        }
        catch (llmErr) {
            firebase_functions_1.logger.warn("evaluateLongAnswer: JSON mode failed, retrying fallback", llmErr);
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    temperature: 0.0,
                    messages: [
                        { role: "system", content: system },
                        {
                            role: "user",
                            content: userMsg + "\nReturn compact JSON only.",
                        },
                    ],
                    max_tokens: 350,
                });
                const text = ((_f = (_e = (_d = completion.choices) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.content) || "{}";
                const match = text.match(/\{[\s\S]*\}/);
                parsed = JSON.parse(match ? match[0] : text);
            }
            catch (fallbackErr) {
                firebase_functions_1.logger.error("evaluateLongAnswer: fallback parse failed", fallbackErr);
            }
        }
        let verdict = String((parsed === null || parsed === void 0 ? void 0 : parsed.verdict) || "incorrect").toLowerCase();
        if (!["correct", "incorrect", "insufficient"].includes(verdict))
            verdict = "incorrect";
        let score = Math.max(0, Math.min(100, Number((parsed === null || parsed === void 0 ? void 0 : parsed.score) || 0)));
        const reasoning = String((parsed === null || parsed === void 0 ? void 0 : parsed.reasoning) || "");
        const keyPoints = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.keyPoints)
            ? parsed.keyPoints.map(String)
            : [];
        const missingPoints = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.missingPoints)
            ? parsed.missingPoints.map(String)
            : [];
        // If the model marked correct but the answer is still extremely brief, downgrade to insufficient.
        if (verdict === "correct" && trimmed.length < minChars) {
            verdict = "insufficient";
            score = Math.min(score, 50);
        }
        return {
            success: true,
            data: { verdict, score, reasoning, keyPoints, missingPoints },
        };
    }
    catch (error) {
        firebase_functions_1.logger.error("Error in evaluateLongAnswer:", error);
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
    var _a, _b, _c, _d, _e, _f, _g;
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
        catch (_h) {
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
            catch (_j) {
                /* ignore */
            }
        }
        let text = "";
        let source = "pinecone";
        if (chunkCount > 0) {
            const ordered = await pineconeService.fetchDocumentChunks(documentId, userId, chunkCount);
            text = ordered.map((c) => c.chunk).join("\n\n");
        }
        // Fallback paths for non-PDF (e.g., DOCX using OpenAI Vector Store)
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
                    // If a transcript file was generated (DOCX path), prefer reading full text from Storage
                    const transcriptPath = (_c = data === null || data === void 0 ? void 0 : data.metadata) === null || _c === void 0 ? void 0 : _c.transcriptPath;
                    if (transcriptPath) {
                        try {
                            const [buf] = await storage
                                .bucket()
                                .file(transcriptPath)
                                .download();
                            text = buf.toString("utf-8");
                        }
                        catch (e) {
                            firebase_functions_1.logger.warn("Failed to read transcript from storage", {
                                transcriptPath,
                                e,
                            });
                            text =
                                ((_d = data === null || data === void 0 ? void 0 : data.content) === null || _d === void 0 ? void 0 : _d.raw) ||
                                    ((_e = data === null || data === void 0 ? void 0 : data.content) === null || _e === void 0 ? void 0 : _e.processed) ||
                                    (data === null || data === void 0 ? void 0 : data.summary) ||
                                    "";
                        }
                    }
                    else {
                        text =
                            ((_f = data === null || data === void 0 ? void 0 : data.content) === null || _f === void 0 ? void 0 : _f.raw) ||
                                ((_g = data === null || data === void 0 ? void 0 : data.content) === null || _g === void 0 ? void 0 : _g.processed) ||
                                (data === null || data === void 0 ? void 0 : data.summary) ||
                                "";
                    }
                }
            }
            catch (_k) {
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
        const system = `You create hierarchical JSON mind map structures. Return STRICT JSON only in this shape: {"root": {"title": string, "children": [{"title": string, "children": [...] }]}}. Depth max 6, each node max 6 words. No extraneous fields.`;
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