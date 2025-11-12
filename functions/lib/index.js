"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMindMap = exports.generatePodcast = exports.getDocumentText = exports.evaluateLongAnswer = exports.generateQuiz = exports.generateFlashcards = exports.generateSummary = exports.recommendPublicDocs = exports.queryDocuments = exports.sendChatMessage = exports.syncAllDocuments = exports.syncNotebookEmbeddings = exports.processDocument = exports.resolveUserByEmail = exports.createChat = void 0;
const v2_1 = require("firebase-functions/v2");
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const storage_1 = require("firebase-admin/storage");
const firestore_2 = require("firebase-admin/firestore");
const firebase_functions_1 = require("firebase-functions");
const openai_1 = require("openai");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_static_1 = __importDefault(require("ffmpeg-static"));
const fsp = __importStar(require("node:fs/promises"));
const path = __importStar(require("node:path"));
const os = __importStar(require("node:os"));
const crypto_1 = require("crypto");
const node_child_process_1 = require("node:child_process");
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
/**
 * Transcribe an audio buffer using OpenAI using only gpt-4o-mini-transcribe.
 * If the audio duration is >= 1400 seconds OR the raw size exceeds ~24MB, the audio
 * is chunked via ffmpeg and each segment is transcribed sequentially. This removes
 * the previous whisper-1 fallback to avoid long delay switching models.
 */
async function transcribeAudioBuffer(buffer, fileName, mimeType, onProgress) {
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey)
        throw new Error("OPENAI_API_KEY is not set");
    const openai = new openai_1.OpenAI({ apiKey });
    const MAX_BYTES = 24 * 1024 * 1024; // keep under server limit (~25MB)
    const MAX_DIRECT_DURATION_SEC = 1400; // >= 1400s triggers chunking
    // Probe duration using ffmpeg. Returns seconds or null if probe fails.
    const getAudioDurationSeconds = async (buf, nameHint) => {
        let tmpDir = null;
        try {
            tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "probe-"));
            const inPath = path.join(tmpDir, nameHint || `probe_${(0, crypto_1.randomUUID)()}`.replace(/[^a-zA-Z0-9_.-]/g, ""));
            await fsp.writeFile(inPath, buf);
            // Ensure ffmpeg path set (ffprobe often not bundled; we parse ffmpeg output)
            try {
                if (ffmpeg_static_1.default)
                    fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
            }
            catch (_a) {
                /* ignore */
            }
            // Run ffmpeg -i <file> (no output encode) to get stderr with Duration line
            const args = ["-hide_banner", "-i", inPath, "-f", "null", "-"];
            const ff = (0, node_child_process_1.spawn)(ffmpeg_static_1.default, args, {
                stdio: ["ignore", "pipe", "pipe"],
            });
            let stderr = "";
            ff.stderr.on("data", (d) => (stderr += d.toString()));
            await new Promise((resolve) => ff.on("close", () => resolve()));
            const m = stderr.match(/Duration:\s+(\d+):(\d+):(\d+\.\d+)/);
            if (!m)
                return null;
            const [_, hh, mm, ss] = m;
            const seconds = parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseFloat(ss);
            if (!Number.isFinite(seconds))
                return null;
            return seconds;
        }
        catch (_b) {
            return null;
        }
        finally {
            if (tmpDir) {
                try {
                    await fsp.rm(tmpDir, { recursive: true, force: true });
                }
                catch (_c) {
                    /* ignore */
                }
            }
        }
    };
    // Helper to transcribe a single small buffer (<= limit) with simple retry
    const transcribeSmall = async (buf, name, mt) => {
        const file = await (0, openai_1.toFile)(buf, name || "audio.webm", {
            type: mt || "audio/webm",
        });
        const MAX_ATTEMPTS = 2;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                const res = await openai.audio.transcriptions.create({
                    file,
                    model: "gpt-4o-mini-transcribe",
                });
                const text = String((res === null || res === void 0 ? void 0 : res.text) || "").trim();
                if (text)
                    return text;
                throw new Error("Empty transcription text");
            }
            catch (err) {
                firebase_functions_1.logger.warn(`gpt-4o-mini-transcribe attempt ${attempt} failed`, err);
                if (attempt === MAX_ATTEMPTS) {
                    throw new Error("Audio transcription failed after retries");
                }
                // brief jitter (non-blocking setTimeout wrapped in promise)
                await new Promise((r) => setTimeout(r, 500 + attempt * 250));
            }
        }
        throw new Error("Unreachable");
    };
    // Decide if we need chunking based on size OR probed duration
    let needsChunking = buffer.byteLength > MAX_BYTES;
    let durationSec = null;
    if (!needsChunking) {
        durationSec = await getAudioDurationSeconds(buffer, fileName);
        if (durationSec && durationSec >= MAX_DIRECT_DURATION_SEC) {
            needsChunking = true;
            firebase_functions_1.logger.info("Duration exceeds threshold; using chunked transcription", {
                durationSec,
            });
        }
    }
    else {
        firebase_functions_1.logger.info("Size exceeds threshold; using chunked transcription", {
            bytes: buffer.byteLength,
        });
    }
    // If direct path allowed
    if (!needsChunking) {
        return transcribeSmall(buffer, fileName, mimeType);
    }
    // Chunk with ffmpeg and transcribe sequentially
    // Ensure ffmpeg binary path set
    try {
        if (ffmpeg_static_1.default)
            fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_static_1.default);
    }
    catch (e) {
        firebase_functions_1.logger.warn("Failed to set ffmpeg path; proceeding with default PATH", e);
    }
    const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "audio-chunks-"));
    const inPath = path.join(tmpDir, fileName || `input_${(0, crypto_1.randomUUID)()}`);
    const outDir = path.join(tmpDir, "parts");
    await fsp.mkdir(outDir, { recursive: true });
    await fsp.writeFile(inPath, buffer);
    // Segment to ~15 minute parts, transcode down to 16k mono 32kbps for safety.
    // Rationale: Lower bitrate + mono drastically reduces size while preserving speech clarity for transcription.
    // 15 min chosen to keep typical spoken segments < 10MB. Adjust -segment_time if future limits change.
    const outPattern = path.join(outDir, "part_%03d.mp3");
    await new Promise((resolve, reject) => {
        try {
            fluent_ffmpeg_1.default(inPath)
                .audioChannels(1)
                .audioBitrate("32k")
                .audioFrequency(16000)
                .format("segment")
                .outputOptions(["-segment_time 900", "-reset_timestamps 1"])
                .output(outPattern)
                .on("error", (err) => reject(err))
                .on("end", () => resolve())
                .run();
        }
        catch (err) {
            reject(err);
        }
    });
    // Read generated parts
    const files = (await fsp.readdir(outDir))
        .filter((f) => /^part_\d{3}\.mp3$/i.test(f))
        .sort();
    if (!files.length) {
        // Fallback: if segmentation failed, try compressing whole file and split again with shorter duration
        firebase_functions_1.logger.error("ffmpeg segmentation produced no parts");
        throw new Error("Failed to segment audio for transcription");
    }
    let combined = "";
    for (let i = 0; i < files.length; i++) {
        const p = files[i];
        const full = path.join(outDir, p);
        const buf = await fsp.readFile(full);
        const partText = await transcribeSmall(buf, p, "audio/mpeg");
        combined += (combined ? "\n\n" : "") + partText;
        // Report progress (from 0..100)
        const pct = Math.round(((i + 1) / files.length) * 100);
        try {
            if (onProgress)
                await onProgress(pct);
        }
        catch (_a) {
            /* ignore */
        }
    }
    // Cleanup best-effort
    try {
        await fsp.rm(tmpDir, { recursive: true, force: true });
    }
    catch (_b) {
        /* ignore */
    }
    return combined.trim();
}
// Initialize services (they will be created when functions are called)
const createServices = () => {
    return {
        documentProcessor: new services_1.DocumentProcessor(),
        embeddingService: new services_1.EmbeddingService(),
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
 * Processes documents through the RAG pipeline (OpenAI Vector Store only):
 * - For PDF/DOC/DOCX/PPTX/TXT: Extract text, then upload full text to OpenAI Vector Store
 *   (OpenAI handles chunking + embeddings). No Pinecone is used anywhere.
 */
exports.processDocument = (0, firestore_1.onDocumentWritten)("documents/{userId}/userDocuments/{documentId}", async (event) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7;
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
        // Initialize services (will be instantiated as needed below)
        // Determine type early for branching
        const docType = String(documentData.type || "").toLowerCase();
        // Only proceed when we have a storage path, unless this is a website or youtube URL doc
        if (!["website", "youtube", "audio"].includes(docType) &&
            !((_h = documentData.metadata) === null || _h === void 0 ? void 0 : _h.storagePath)) {
            firebase_functions_1.logger.info(`Document ${documentId} doesn't have storagePath yet, will process when storage info is updated`);
            return;
        }
        // For audio docs specifically, wait until storagePath is populated (creation fires before upload finishes)
        if (docType === "audio" && !((_j = documentData.metadata) === null || _j === void 0 ? void 0 : _j.storagePath)) {
            firebase_functions_1.logger.info(`Audio document ${documentId} has no storagePath yet, will retry on storagePath update`);
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
        let extractedText = "";
        if (docType === "website") {
            // Webpage extraction path: use metadata.url
            const url = String(((_k = documentData === null || documentData === void 0 ? void 0 : documentData.metadata) === null || _k === void 0 ? void 0 : _k.url) || ((_l = documentData === null || documentData === void 0 ? void 0 : documentData.content) === null || _l === void 0 ? void 0 : _l.raw) || "");
            if (!url)
                throw new Error("Website document missing URL");
            firebase_functions_1.logger.info("Extracting article from website URL...");
            const result = await createServices().documentProcessor.extractTextFromURL(url);
            extractedText = result.text || "";
            // Optional: update title if missing and extractor provided one
            if (result.title &&
                (!documentData.title ||
                    String(documentData.title).toLowerCase().includes("website -"))) {
                try {
                    await db
                        .collection("documents")
                        .doc(userId)
                        .collection("userDocuments")
                        .doc(documentId)
                        .set({ title: String(result.title).slice(0, 140) }, { merge: true });
                }
                catch (_8) {
                    /* ignore */
                }
            }
        }
        else if (docType === "youtube") {
            // YouTube transcript path: use metadata.url
            const videoUrl = String(((_m = documentData === null || documentData === void 0 ? void 0 : documentData.metadata) === null || _m === void 0 ? void 0 : _m.url) || ((_o = documentData === null || documentData === void 0 ? void 0 : documentData.content) === null || _o === void 0 ? void 0 : _o.raw) || "").trim();
            if (!videoUrl)
                throw new Error("YouTube document missing URL");
            firebase_functions_1.logger.info("Fetching transcript via Transcript API...");
            const { text: transcriptText, title: apiTitle } = await fetchYouTubeTranscript(videoUrl);
            // Clean text using TXT pipeline cleaner
            const buffer = Buffer.from(transcriptText, "utf-8");
            extractedText = await createServices().documentProcessor.extractTextFromTXT(buffer);
            // Optionally update document title if API provided one and current title is generic
            if (apiTitle) {
                const currentTitle = String(documentData.title || "");
                const looksGeneric = /YouTube\s*Video/i.test(currentTitle) || !currentTitle.trim();
                if (looksGeneric) {
                    try {
                        await db
                            .collection("documents")
                            .doc(userId)
                            .collection("userDocuments")
                            .doc(documentId)
                            .set({ title: String(apiTitle).slice(0, 140) }, { merge: true });
                    }
                    catch (_9) {
                        /* ignore */
                    }
                }
            }
        }
        else if (docType === "audio") {
            // Audio transcription path: download audio and transcribe via OpenAI
            const storagePath = String(((_p = documentData.metadata) === null || _p === void 0 ? void 0 : _p.storagePath) || "");
            if (!storagePath)
                throw new Error("Audio document missing storagePath");
            firebase_functions_1.logger.info("Downloading audio file from storage for transcription...");
            const fileBuffer = await downloadFileFromStorage(storagePath);
            // Update progress early
            await db
                .collection("documents")
                .doc(userId)
                .collection("userDocuments")
                .doc(documentId)
                .set({ processingStatus: "processing", processingProgress: 10 }, { merge: true });
            // Determine filename and mime type hints
            const fileName = String(((_q = documentData === null || documentData === void 0 ? void 0 : documentData.metadata) === null || _q === void 0 ? void 0 : _q.fileName) || `${documentId}.webm`);
            const mimeType = String(((_r = documentData === null || documentData === void 0 ? void 0 : documentData.metadata) === null || _r === void 0 ? void 0 : _r.mimeType) || "audio/webm");
            firebase_functions_1.logger.info("Transcribing audio via OpenAI", {
                model: "gpt-4o-mini-transcribe",
            });
            const rawTranscript = await transcribeAudioBuffer(fileBuffer, fileName, mimeType, async (pct) => {
                // Map chunking progress (0-100) into overall doc processing progress window 10-40
                const mapped = 10 + Math.round((pct / 100) * 30);
                try {
                    await db
                        .collection("documents")
                        .doc(userId)
                        .collection("userDocuments")
                        .doc(documentId)
                        .set({ processingProgress: mapped }, { merge: true });
                }
                catch (e) {
                    firebase_functions_1.logger.warn("Failed to update chunk transcription progress", e);
                }
            });
            // Clean text through TXT cleaner
            const cleaned = await createServices().documentProcessor.extractTextFromTXT(Buffer.from(rawTranscript || "", "utf-8"));
            extractedText = cleaned;
        }
        else if (docType === "image") {
            // OCR path using OpenAI Vision (gpt-4o-mini)
            const storagePath = String(((_s = documentData.metadata) === null || _s === void 0 ? void 0 : _s.storagePath) || "");
            if (!storagePath)
                throw new Error("Image document missing storagePath");
            firebase_functions_1.logger.info("Downloading image file from storage for OCR...");
            const fileBuffer = await downloadFileFromStorage(storagePath);
            // Progress update
            await db
                .collection("documents")
                .doc(userId)
                .collection("userDocuments")
                .doc(documentId)
                .set({ processingStatus: "processing", processingProgress: 20 }, { merge: true });
            try {
                const apiKey = process.env.OPENAI_API_KEY || "";
                if (!apiKey)
                    throw new Error("OPENAI_API_KEY is not set");
                const openai = new openai_1.OpenAI({ apiKey });
                const mimeType = String(((_t = documentData === null || documentData === void 0 ? void 0 : documentData.metadata) === null || _t === void 0 ? void 0 : _t.mimeType) || "image/png");
                const base64 = fileBuffer.toString("base64");
                const dataUrl = `data:${mimeType};base64,${base64}`;
                // Use Responses API for vision input
                const prompt = "Extract all legible text from the image. Return plain text only, preserving natural reading order where possible.";
                let ocrText = "";
                try {
                    const resp = await openai.responses.create({
                        model: "gpt-4o-mini",
                        input: [
                            {
                                role: "user",
                                content: [
                                    { type: "input_text", text: prompt },
                                    { type: "input_image", image_url: dataUrl },
                                ],
                            },
                        ],
                    });
                    ocrText =
                        (resp === null || resp === void 0 ? void 0 : resp.output_text) ||
                            ((_x = (_w = (_v = (_u = resp === null || resp === void 0 ? void 0 : resp.output) === null || _u === void 0 ? void 0 : _u[0]) === null || _v === void 0 ? void 0 : _v.content) === null || _w === void 0 ? void 0 : _w[0]) === null || _x === void 0 ? void 0 : _x.text) ||
                            ((_1 = (_0 = (_z = (_y = resp === null || resp === void 0 ? void 0 : resp.data) === null || _y === void 0 ? void 0 : _y[0]) === null || _z === void 0 ? void 0 : _z.content) === null || _0 === void 0 ? void 0 : _0[0]) === null || _1 === void 0 ? void 0 : _1.text) ||
                            "";
                }
                catch (respErr) {
                    firebase_functions_1.logger.warn("Responses vision OCR failed; trying chat fallback", respErr);
                    try {
                        const completion = await openai.chat.completions.create({
                            model: "gpt-4o-mini",
                            messages: [
                                {
                                    role: "user",
                                    content: [
                                        { type: "text", text: prompt },
                                        { type: "image_url", image_url: { url: dataUrl } },
                                    ],
                                },
                            ],
                            max_tokens: 1200,
                            temperature: 0.0,
                        });
                        ocrText = ((_4 = (_3 = (_2 = completion.choices) === null || _2 === void 0 ? void 0 : _2[0]) === null || _3 === void 0 ? void 0 : _3.message) === null || _4 === void 0 ? void 0 : _4.content) || "";
                    }
                    catch (chatErr) {
                        firebase_functions_1.logger.error("OpenAI vision OCR failed", chatErr);
                        throw chatErr;
                    }
                }
                // Clean through TXT pipeline for normalization
                const cleaned = await createServices().documentProcessor.extractTextFromTXT(Buffer.from(String(ocrText || ""), "utf-8"));
                extractedText = cleaned;
            }
            catch (e) {
                firebase_functions_1.logger.error("Image OCR pipeline failed", e);
                throw new Error("Failed to extract text from image");
            }
        }
        else {
            // File-based extraction path
            firebase_functions_1.logger.info("Downloading file from storage...");
            const fileBuffer = await downloadFileFromStorage(documentData.metadata.storagePath);
            if (docType === "pdf") {
                firebase_functions_1.logger.info("Extracting text from PDF...");
                extractedText =
                    await createServices().documentProcessor.extractTextFromPDF(fileBuffer);
            }
            else if (docType === "docx") {
                firebase_functions_1.logger.info("Extracting text from DOCX via Mammoth...");
                extractedText =
                    await createServices().documentProcessor.extractTextFromDOCX(fileBuffer);
            }
            else if (docType === "pptx") {
                firebase_functions_1.logger.info("Extracting text from PPTX...");
                extractedText = await createServices().documentProcessor.extractTextFromPPTX(fileBuffer);
            }
            else if (docType === "text" ||
                String(((_5 = documentData === null || documentData === void 0 ? void 0 : documentData.metadata) === null || _5 === void 0 ? void 0 : _5.mimeType) || "").includes("text") ||
                /\.txt$/i.test(String(((_6 = documentData === null || documentData === void 0 ? void 0 : documentData.metadata) === null || _6 === void 0 ? void 0 : _6.fileName) || ""))) {
                firebase_functions_1.logger.info("Extracting text from TXT...");
                extractedText = await createServices().documentProcessor.extractTextFromTXT(fileBuffer);
            }
            else {
                firebase_functions_1.logger.info(`Unsupported document type for processing: ${docType}`);
                return;
            }
        }
        if (!extractedText || extractedText.length < 10) {
            throw new Error("No meaningful text extracted from document");
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
        // All supported types (pdf, docx, pptx, text, website, youtube): upload text to OpenAI Vector Store
        if ([
            "pdf",
            "docx",
            "pptx",
            "text",
            "website",
            "youtube",
            "audio",
            "image",
        ].includes(docType)) {
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
                processingProgress: docType === "audio" ? 40 : 20,
            }, { merge: true });
            const vsUpload = await openaiVS.uploadTextAsDocument(workingText, {
                userId,
                documentId,
                title: documentData.title,
                fileName: (_7 = documentData.metadata) === null || _7 === void 0 ? void 0 : _7.fileName,
            });
            // Persist the full raw transcript to Cloud Storage to avoid Firestore doc size limits
            const transcriptPath = `transcripts/${userId}/${documentId}.txt`;
            try {
                await storage.bucket().file(transcriptPath).save(workingText, {
                    contentType: "text/plain; charset=utf-8",
                });
                firebase_functions_1.logger.info("Saved transcript to storage", { transcriptPath });
            }
            catch (e) {
                firebase_functions_1.logger.warn("Failed to save transcript to storage", e);
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
                truncated,
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
 * Realtime sync for Notebook (type: "text") documents.
 * - On create: ensure vector store metadata exists; if content present, upload to OpenAI Vector Store.
 * - On update: when content.raw changes, replace the vector store file with new content.
 */
exports.syncNotebookEmbeddings = (0, firestore_1.onDocumentWritten)("documents/{userId}/userDocuments/{documentId}", async (event) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const afterSnap = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after;
    const beforeSnap = (_b = event.data) === null || _b === void 0 ? void 0 : _b.before;
    if (!(afterSnap === null || afterSnap === void 0 ? void 0 : afterSnap.exists))
        return; // ignore deletes
    const { userId, documentId } = event.params;
    const after = afterSnap.data() || {};
    const before = (beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.data()) || {};
    // Only handle text notebook docs (inline editable)
    const type = String((after === null || after === void 0 ? void 0 : after.type) || "").toLowerCase();
    if (type !== "text")
        return;
    const afterRaw = String(((_c = after === null || after === void 0 ? void 0 : after.content) === null || _c === void 0 ? void 0 : _c.raw) || "");
    const beforeRaw = String(((_d = before === null || before === void 0 ? void 0 : before.content) === null || _d === void 0 ? void 0 : _d.raw) || "");
    const created = !(beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.exists) && !!afterSnap.exists;
    const contentChanged = created || afterRaw !== beforeRaw;
    // If nothing meaningful changed, skip
    if (!contentChanged)
        return;
    const docRef = db
        .collection("documents")
        .doc(userId)
        .collection("userDocuments")
        .doc(documentId);
    try {
        const vsId = process.env.OPENAI_VECTOR_STORE_ID || "";
        const openaiVS = new services_1.OpenAIVectorStoreService(vsId);
        // If empty content: ensure vector store id metadata exists; nothing to upload
        if (!afterRaw || afterRaw.trim().length === 0) {
            await docRef.set({
                status: "ready",
                processingStatus: "completed",
                processingCompletedAt: new Date(),
                characterCount: 0,
                chunkCount: firestore_2.FieldValue.delete(),
                "metadata.openaiVector": {
                    vectorStoreId: openaiVS.getVectorStoreId(),
                },
            }, { merge: true });
            return;
        }
        // Upsert into vector store (delete old file if present)
        const existingVS = {
            vectorStoreId: ((_f = (_e = after === null || after === void 0 ? void 0 : after.metadata) === null || _e === void 0 ? void 0 : _e.openaiVector) === null || _f === void 0 ? void 0 : _f.vectorStoreId) ||
                openaiVS.getVectorStoreId(),
            fileId: (_h = (_g = after === null || after === void 0 ? void 0 : after.metadata) === null || _g === void 0 ? void 0 : _g.openaiVector) === null || _h === void 0 ? void 0 : _h.fileId,
        };
        const result = await openaiVS.upsertTextDocument(afterRaw, {
            userId,
            documentId,
            title: String((after === null || after === void 0 ? void 0 : after.title) || "Document"),
            fileName: String(((_j = after === null || after === void 0 ? void 0 : after.metadata) === null || _j === void 0 ? void 0 : _j.fileName) || `${documentId}.txt`),
            existing: existingVS,
        });
        await docRef.set({
            status: "ready",
            processingStatus: "completed",
            processingCompletedAt: new Date(),
            characterCount: afterRaw.length,
            chunkCount: firestore_2.FieldValue.delete(),
            "content.processed": "Indexed to OpenAI Vector Store",
            "metadata.openaiVector": {
                vectorStoreId: result.vectorStoreId,
                fileId: result.fileId,
                vectorStoreFileId: result.vectorStoreFileId,
            },
        }, { merge: true });
    }
    catch (e) {
        firebase_functions_1.logger.warn("syncNotebookEmbeddings failed", { userId, documentId, e });
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
    var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13;
    try {
        const { userId, prompt, language, chatId, docIds, webSearch, thinkMode, docOwnerId } = request.data || {};
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
        // Determine if this is a document-based chat or standalone chat
        const isDocumentBasedChat = Array.isArray(docIds) && docIds.length > 0;
        let chatDocId = chatId;
        let chatCollection;
        if (isDocumentBasedChat) {
            // Document-based chat: create under documents/{docOwnerId}/userDocuments/{documentId}/chats
            const primaryDocId = docIds[0];
            const documentOwnerId = docOwnerId || userId; // Fall back to userId if docOwnerId not provided
            chatCollection = db
                .collection("documents")
                .doc(documentOwnerId)
                .collection("userDocuments")
                .doc(primaryDocId)
                .collection("chats");
        }
        else {
            // Standalone chat: use top-level chats collection
            chatCollection = db.collection("chats");
        }
        if (!chatDocId) {
            const title = prompt.trim().slice(0, 60);
            const chatRef = await chatCollection.add({
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
            await chatCollection.doc(chatDocId).set(Object.assign({ updatedAt: new Date(), language: language || "en", model }, (Array.isArray(docIds) && docIds.length
                ? { contextDocIds: docIds.slice(0, 8) }
                : {})), { merge: true });
        }
        const messagesCol = chatCollection.doc(chatDocId).collection("messages");
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
                const chatSnap = await chatCollection.doc(chatDocId).get();
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
        let metaSnaps = [];
        if (activeDocIds.length) {
            // Inspect whether any of the context docs were indexed in OpenAI Vector Store
            try {
                const documentOwnerId = docOwnerId || userId; // Use docOwnerId if provided, otherwise fall back to userId
                metaSnaps = await Promise.all(activeDocIds.map((id) => db
                    .collection("documents")
                    .doc(documentOwnerId)
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
            // If no vector stores are available, build a lightweight context by reading Firestore content/summary/transcripts
            if (vectorStoreIds.length === 0) {
                try {
                    const pieces = [];
                    const MAX_CONTEXT_CHARS = 12000;
                    let used = 0;
                    for (let i = 0; i < metaSnaps.length; i++) {
                        const s = metaSnaps[i];
                        const d = s.data() || {};
                        let text = d.summary ||
                            ((_e = d.content) === null || _e === void 0 ? void 0 : _e.raw) ||
                            ((_f = d.content) === null || _f === void 0 ? void 0 : _f.processed) ||
                            "";
                        if ((!text || text.length < 120) && ((_g = d === null || d === void 0 ? void 0 : d.metadata) === null || _g === void 0 ? void 0 : _g.transcriptPath)) {
                            try {
                                const [buf] = await storage
                                    .bucket()
                                    .file(String(d.metadata.transcriptPath))
                                    .download();
                                text = buf.toString("utf-8");
                            }
                            catch (_14) {
                                /* ignore */
                            }
                        }
                        if (text) {
                            const clean = String(text).replace(/\s+/g, " ").trim();
                            if (clean) {
                                const snippet = clean.slice(0, 1000);
                                const block = `DOC ${activeDocIds[i]} | ${d.title || "Document"}\n${snippet}`;
                                if (used + block.length > MAX_CONTEXT_CHARS)
                                    break;
                                pieces.push(block);
                                used += block.length;
                            }
                        }
                    }
                    if (pieces.length) {
                        docsContext = `Retrieved document context (no vector store available):\n\n${pieces.join("\n\n---\n\n")}`;
                    }
                }
                catch (fbErr) {
                    firebase_functions_1.logger.warn("Context fallback assembly failed", fbErr);
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
                await chatCollection
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
                    content: `${baseInstruction}\n\nNote: You have access to document content via context. Answer based on the conversation and any provided document context.`,
                };
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    temperature: 0.2,
                    messages: [systemMessage, ...chatMessages.slice(1)],
                    max_tokens: 1200,
                });
                const fullText = ((_k = (_j = (_h = completion.choices) === null || _h === void 0 ? void 0 : _h[0]) === null || _j === void 0 ? void 0 : _j.message) === null || _k === void 0 ? void 0 : _k.content) ||
                    "I'm sorry, I couldn't generate a response.";
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
                    ((_p = (_o = (_m = (_l = resp === null || resp === void 0 ? void 0 : resp.output) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.content) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.text) ||
                    ((_t = (_s = (_r = (_q = resp === null || resp === void 0 ? void 0 : resp.data) === null || _q === void 0 ? void 0 : _q[0]) === null || _r === void 0 ? void 0 : _r.content) === null || _s === void 0 ? void 0 : _s[0]) === null || _t === void 0 ? void 0 : _t.text) ||
                    ((_w = (_v = (_u = resp === null || resp === void 0 ? void 0 : resp.choices) === null || _u === void 0 ? void 0 : _u[0]) === null || _v === void 0 ? void 0 : _v.message) === null || _w === void 0 ? void 0 : _w.content) ||
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
                    ((_0 = (_z = (_y = (_x = resp === null || resp === void 0 ? void 0 : resp.output) === null || _x === void 0 ? void 0 : _x[0]) === null || _y === void 0 ? void 0 : _y.content) === null || _z === void 0 ? void 0 : _z[0]) === null || _0 === void 0 ? void 0 : _0.text) ||
                    ((_4 = (_3 = (_2 = (_1 = resp === null || resp === void 0 ? void 0 : resp.data) === null || _1 === void 0 ? void 0 : _1[0]) === null || _2 === void 0 ? void 0 : _2.content) === null || _3 === void 0 ? void 0 : _3[0]) === null || _4 === void 0 ? void 0 : _4.text) ||
                    ((_7 = (_6 = (_5 = resp === null || resp === void 0 ? void 0 : resp.choices) === null || _5 === void 0 ? void 0 : _5[0]) === null || _6 === void 0 ? void 0 : _6.message) === null || _7 === void 0 ? void 0 : _7.content) ||
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
                    for (var _15 = true, _16 = __asyncValues(stream), _17; _17 = await _16.next(), _a = _17.done, !_a; _15 = true) {
                        _c = _17.value;
                        _15 = false;
                        const part = _c;
                        const delta = ((_10 = (_9 = (_8 = part === null || part === void 0 ? void 0 : part.choices) === null || _8 === void 0 ? void 0 : _8[0]) === null || _9 === void 0 ? void 0 : _9.delta) === null || _10 === void 0 ? void 0 : _10.content) || "";
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
                        if (!_15 && !_a && (_b = _16.return)) await _b.call(_16);
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
                    ((_13 = (_12 = (_11 = completion.choices) === null || _11 === void 0 ? void 0 : _11[0]) === null || _12 === void 0 ? void 0 : _12.message) === null || _13 === void 0 ? void 0 : _13.content) ||
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
            await chatCollection
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
/** Fetch YouTube transcript using Transcript API; returns transcript text and optional metadata title */
async function fetchYouTubeTranscript(videoUrl) {
    var _a, _b;
    const API_KEY = process.env.TRANSCRIPT_API_KEY || "";
    const API_BASE = process.env.TRANSCRIPT_API_BASE ||
        "https://transcriptapi.com/api/v2/youtube/transcript";
    if (!API_KEY)
        throw new Error("Missing Transcript API key in environment");
    const url = `${API_BASE}?video_url=${encodeURIComponent(videoUrl)}&format=json&include_timestamp=true&send_metadata=true`;
    // small retry loop for transient errors / 429
    const attempt = async () => {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                Accept: "application/json",
            },
        });
        if (res.status === 402)
            throw new Error("Transcript API: Payment required (credits or plan inactive)");
        if (res.status === 429)
            throw new Error("Transcript API: Rate limit exceeded, try later.");
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`Transcript API Error (${res.status}): ${errText}`);
        }
        return (await res.json());
    };
    let data;
    try {
        data = await attempt();
    }
    catch (e1) {
        // brief backoff retry once
        await new Promise((r) => setTimeout(r, 800));
        data = await attempt();
    }
    // Expected reference shape: { transcript: [{ text, start?, duration? }], metadata?: { title?: string, ... } }
    // Also support alternate shapes used by some providers.
    const segments = Array.isArray(data === null || data === void 0 ? void 0 : data.transcript)
        ? data.transcript
        : Array.isArray(data === null || data === void 0 ? void 0 : data.segments)
            ? data.segments
            : [];
    let text = "";
    if (segments.length) {
        text = segments
            .map((s) => String((s === null || s === void 0 ? void 0 : s.text) || (s === null || s === void 0 ? void 0 : s.content) || "").trim())
            .filter(Boolean)
            .join(" ");
    }
    else if (typeof (data === null || data === void 0 ? void 0 : data.transcript) === "string") {
        text = data.transcript;
    }
    else if (typeof (data === null || data === void 0 ? void 0 : data.text) === "string") {
        text = data.text;
    }
    else if (typeof ((_a = data === null || data === void 0 ? void 0 : data.result) === null || _a === void 0 ? void 0 : _a.transcript) === "string") {
        text = data.result.transcript;
    }
    text = String(text || "").trim();
    if (!text)
        throw new Error("Transcript API returned empty transcript");
    const title = ((_b = data === null || data === void 0 ? void 0 : data.metadata) === null || _b === void 0 ? void 0 : _b.title) || undefined;
    return { text, title };
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
 * Callable function to fetch full raw document text.
 * Uses stored transcript in Cloud Storage or Firestore content; vector store retrieval
 * is handled in other endpoints (chat/query) via file_search.
 */
exports.getDocumentText = (0, https_1.onCall)({
    enforceAppCheck: false,
}, async (request) => {
    var _a, _b, _c, _d, _e;
    try {
        const { documentId, userId, limitChars } = request.data || {};
        if (!documentId || !userId) {
            throw new Error("Missing required parameters: documentId and userId");
        }
        // Try to read document metadata
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
                title = data === null || data === void 0 ? void 0 : data.title;
                fileName = (_a = data === null || data === void 0 ? void 0 : data.metadata) === null || _a === void 0 ? void 0 : _a.fileName;
            }
        }
        catch (_f) {
            /* ignore */
        }
        let text = "";
        let source = "firestore";
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
                    }
                }
                if (!text) {
                    text =
                        ((_d = data === null || data === void 0 ? void 0 : data.content) === null || _d === void 0 ? void 0 : _d.raw) ||
                            ((_e = data === null || data === void 0 ? void 0 : data.content) === null || _e === void 0 ? void 0 : _e.processed) ||
                            (data === null || data === void 0 ? void 0 : data.summary) ||
                            "";
                }
            }
        }
        catch (_g) {
            /* ignore */
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
                chunkCount: undefined,
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