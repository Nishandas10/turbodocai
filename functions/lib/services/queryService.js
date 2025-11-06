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
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryService = void 0;
const openai_1 = require("openai");
const firebase_functions_1 = require("firebase-functions");
const firestore_1 = require("firebase-admin/firestore");
class QueryService {
    // Pinecone removed; using OpenAI Vector Store and content fallbacks.
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
     * Query the RAG system with a question
     */
    async queryRAG(question, userId, documentId, topK = 5) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
        try {
            firebase_functions_1.logger.info(`Processing RAG query for user ${userId}: ${question}`);
            // If a specific document is targeted and it has OpenAI Vector Store metadata, use OpenAI file_search
            if (documentId) {
                try {
                    const db = (0, firestore_1.getFirestore)();
                    const snap = await db
                        .collection("documents")
                        .doc(userId)
                        .collection("userDocuments")
                        .doc(documentId)
                        .get();
                    const data = snap.data() || {};
                    let vsId = (_b = (_a = data === null || data === void 0 ? void 0 : data.metadata) === null || _a === void 0 ? void 0 : _a.openaiVector) === null || _b === void 0 ? void 0 : _b.vectorStoreId;
                    const isDocxPptxTxt = ["docx", "pptx", "text"].includes(String((data === null || data === void 0 ? void 0 : data.type) || "").toLowerCase()) ||
                        String(((_c = data === null || data === void 0 ? void 0 : data.metadata) === null || _c === void 0 ? void 0 : _c.mimeType) || "").includes("word") ||
                        String(((_d = data === null || data === void 0 ? void 0 : data.metadata) === null || _d === void 0 ? void 0 : _d.mimeType) || "").includes("presentation") ||
                        String(((_e = data === null || data === void 0 ? void 0 : data.metadata) === null || _e === void 0 ? void 0 : _e.mimeType) || "").includes("text/plain");
                    if (!vsId && isDocxPptxTxt && ((_f = data === null || data === void 0 ? void 0 : data.metadata) === null || _f === void 0 ? void 0 : _f.openaiVector)) {
                        vsId =
                            process.env.OPENAI_VECTOR_STORE_ID ||
                                "vs_68f1528dad6c8191bfb8a090e1557a86";
                    }
                    if (vsId) {
                        firebase_functions_1.logger.info("Routing query to OpenAI Vector Store file_search", {
                            documentId,
                            vsId,
                        });
                        const answer = await this.answerWithOpenAIVectorStore(question, vsId);
                        const title = (data === null || data === void 0 ? void 0 : data.title) || "Document";
                        const fileName = (_g = data === null || data === void 0 ? void 0 : data.metadata) === null || _g === void 0 ? void 0 : _g.fileName;
                        return {
                            answer,
                            sources: [
                                {
                                    documentId,
                                    title,
                                    fileName,
                                    chunk: "Retrieved via OpenAI Vector Store file search",
                                    score: 1.0,
                                },
                            ],
                            confidence: 80,
                        };
                    }
                }
                catch (e) {
                    firebase_functions_1.logger.warn("OpenAI Vector Store routing failed, falling back", e);
                }
            }
            // Prefer vector store if available for this document
            {
                if (documentId) {
                    try {
                        const db = (0, firestore_1.getFirestore)();
                        const snap = await db
                            .collection("documents")
                            .doc(userId)
                            .collection("userDocuments")
                            .doc(documentId)
                            .get();
                        if (snap.exists) {
                            const data = snap.data();
                            let vsId = (_j = (_h = data === null || data === void 0 ? void 0 : data.metadata) === null || _h === void 0 ? void 0 : _h.openaiVector) === null || _j === void 0 ? void 0 : _j.vectorStoreId;
                            if (vsId) {
                                firebase_functions_1.logger.info("Answering via OpenAI Vector Store", {
                                    documentId,
                                    vsId,
                                });
                                try {
                                    const answer = await this.answerWithOpenAIVectorStore(question, vsId);
                                    return {
                                        answer,
                                        sources: [
                                            {
                                                documentId,
                                                title: data.title || "Document",
                                                fileName: (_k = data === null || data === void 0 ? void 0 : data.metadata) === null || _k === void 0 ? void 0 : _k.fileName,
                                                chunk: "Retrieved via OpenAI Vector Store file search",
                                                score: 1.0,
                                            },
                                        ],
                                        confidence: 80,
                                    };
                                }
                                catch (e) {
                                    firebase_functions_1.logger.warn("Vector store answering failed, falling back", e);
                                }
                            }
                            let context = (data.summary ||
                                ((_l = data.content) === null || _l === void 0 ? void 0 : _l.raw) ||
                                ((_m = data.content) === null || _m === void 0 ? void 0 : _m.processed) ||
                                "").slice(0, 24000);
                            if (!context || context.length < 80) {
                                const url = (_o = data.metadata) === null || _o === void 0 ? void 0 : _o.downloadURL;
                                if (url) {
                                    try {
                                        const res = await fetch(url);
                                        if (res.ok) {
                                            const txt = await res.text();
                                            context = (txt || "").slice(0, 24000);
                                        }
                                    }
                                    catch (e) {
                                        firebase_functions_1.logger.warn("queryRAG downloadURL fallback failed", e);
                                    }
                                }
                            }
                            if (context && context.length >= 80) {
                                const answer = await this.generateAnswer(question, context);
                                const sourceTitle = data.title || "Document";
                                const fileName = (_p = data.metadata) === null || _p === void 0 ? void 0 : _p.fileName;
                                return {
                                    answer,
                                    sources: [
                                        {
                                            documentId,
                                            title: sourceTitle,
                                            fileName,
                                            chunk: context.slice(0, 200) +
                                                (context.length > 200 ? "..." : ""),
                                            score: 0.99,
                                        },
                                    ],
                                    confidence: 70,
                                };
                            }
                        }
                    }
                    catch (fbErr) {
                        firebase_functions_1.logger.warn("queryRAG Firestore/content fallback failed", fbErr);
                    }
                }
                // Still nothing useful
                return {
                    answer: "I couldn't find enough context from this document yet. Try again after processing finishes or ensure the document has accessible text.",
                    sources: [],
                    confidence: 0,
                };
            }
            // Multi-doc path not implemented for vector store yet; fall back to insufficient context
            return {
                answer: "I can answer best when a specific document is provided. Please attach a document with vector indexing.",
                sources: [],
                confidence: 0,
            };
        }
        catch (error) {
            firebase_functions_1.logger.error("Error in queryRAG:", error);
            throw new Error("Failed to process query");
        }
    }
    /**
     * Answer a question using OpenAI Assistants API with file_search tool over a vector store id.
     */
    async answerWithOpenAIVectorStore(question, vectorStoreId) {
        var _a;
        try {
            // Create a temporary assistant with file_search enabled on the vector store
            const assistant = await this.openai.beta.assistants.create({
                model: "gpt-4o-mini",
                instructions: "You are a helpful assistant that answers questions based strictly on the provided documents. Use the file_search tool to find relevant information and ground your answers only on retrieved content. If you cannot find the information in the documents, say so clearly.",
                tools: [{ type: "file_search" }],
                tool_resources: {
                    file_search: {
                        vector_store_ids: [vectorStoreId],
                    },
                },
            });
            // Create a thread and add the user's question
            const thread = await this.openai.beta.threads.create({
                messages: [
                    {
                        role: "user",
                        content: question,
                    },
                ],
            });
            // Run the assistant
            const run = await this.openai.beta.threads.runs.create(thread.id, {
                assistant_id: assistant.id,
            });
            // Wait for completion and get the response
            let runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
            while (runStatus.status === "queued" ||
                runStatus.status === "in_progress") {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
            }
            if (runStatus.status === "completed") {
                const messages = await this.openai.beta.threads.messages.list(thread.id);
                const assistantMessage = messages.data.find((msg) => msg.role === "assistant");
                const textContent = assistantMessage === null || assistantMessage === void 0 ? void 0 : assistantMessage.content.find((content) => content.type === "text");
                const answer = ((_a = textContent === null || textContent === void 0 ? void 0 : textContent.text) === null || _a === void 0 ? void 0 : _a.value) || "I couldn't generate an answer.";
                // Clean up temporary assistant
                await this.openai.beta.assistants.del(assistant.id);
                return answer;
            }
            else {
                // Clean up temporary assistant on failure
                await this.openai.beta.assistants.del(assistant.id);
                throw new Error(`Assistant run failed with status: ${runStatus.status}`);
            }
        }
        catch (err) {
            firebase_functions_1.logger.error("answerWithOpenAIVectorStore failed", err);
            throw err;
        }
    }
    /**
     * Generate answer using OpenAI
     */
    async generateAnswer(question, context) {
        var _a, _b;
        try {
            const prompt = this.buildPrompt(question, context);
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are a helpful AI assistant that answers questions based on provided document context. 
            Always base your answers on the given context and cite sources when possible. 
            If the context doesn't contain enough information to answer the question, say so clearly.
            Keep your answers concise but comprehensive.`,
                    },
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                max_tokens: 1000,
                temperature: 0.1,
            });
            return (((_b = (_a = response.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) ||
                "I couldn't generate an answer.");
        }
        catch (error) {
            firebase_functions_1.logger.error("Error generating answer:", error);
            throw new Error("Failed to generate answer");
        }
    }
    /**
     * Build the prompt for the LLM
     */
    buildPrompt(question, context) {
        return `Please answer the following question using only the provided context. If the context doesn't contain enough information to answer the question, please say so.

Context:
${context}

Question: ${question}

Answer:`;
    }
    /**
     * Summarize a document using OpenAI Assistants API with file_search over a vector store.
     * This asks the model to produce a structured markdown summary grounded only on the attached store.
     */
    async summarizeWithOpenAIVectorStore(vectorStoreId, maxLength, title) {
        try {
            const prompt = `Create a professional, well-structured markdown summary (~${maxLength} words) of the attached document titled "${title}" using only retrieved content.\n\nOutput Requirements:\n- Start with a brief overview paragraph.\n- Use clear headings (##, ###), bullets and numbers.\n- Bold important terms.\n- Include a short Key Takeaways section at the end.\n- No code fences.`;
            // Create a temporary assistant with file_search enabled on the vector store
            const assistant = await this.openai.beta.assistants.create({
                model: "gpt-4o-mini",
                instructions: "You are a helpful assistant that creates document summaries based strictly on the provided documents. Use the file_search tool to find relevant information and create comprehensive summaries.",
                tools: [{ type: "file_search" }],
                tool_resources: {
                    file_search: {
                        vector_store_ids: [vectorStoreId],
                    },
                },
            });
            // Create a thread and add the summarization request
            const thread = await this.openai.beta.threads.create({
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
            });
            // Run the assistant
            const run = await this.openai.beta.threads.runs.create(thread.id, {
                assistant_id: assistant.id,
            });
            // Wait for completion and get the response
            let runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
            while (runStatus.status === "queued" ||
                runStatus.status === "in_progress") {
                await new Promise((resolve) => setTimeout(resolve, 1000));
                runStatus = await this.openai.beta.threads.runs.retrieve(thread.id, run.id);
            }
            if (runStatus.status === "completed") {
                const messages = await this.openai.beta.threads.messages.list(thread.id);
                // Find the most recent assistant message that has text content
                let summary = "";
                for (const msg of messages.data) {
                    if (msg.role !== "assistant")
                        continue;
                    const parts = (msg.content || []).filter((c) => { var _a; return (c === null || c === void 0 ? void 0 : c.type) === "text" && ((_a = c === null || c === void 0 ? void 0 : c.text) === null || _a === void 0 ? void 0 : _a.value); });
                    if (parts.length) {
                        summary = parts
                            .map((p) => String(p.text.value || ""))
                            .join("\n")
                            .trim();
                        if (summary)
                            break;
                    }
                }
                // Clean up temporary assistant
                await this.openai.beta.assistants.del(assistant.id);
                return summary.trim();
            }
            else {
                // Clean up temporary assistant on failure
                await this.openai.beta.assistants.del(assistant.id);
                throw new Error(`Assistant run failed with status: ${runStatus.status}`);
            }
        }
        catch (err) {
            firebase_functions_1.logger.error("summarizeWithOpenAIVectorStore failed", err);
            throw err;
        }
    }
    /**
     * Wait up to maxWaitMs for usable raw text to be available either inline (content.raw/processed)
     * or via a transcript saved to Cloud Storage (metadata.transcriptPath).
     */
    async waitForRawText(userId, documentId, maxWaitMs = 60000) {
        var _a, _b, _c;
        const db = (0, firestore_1.getFirestore)();
        const started = Date.now();
        let delay = 800;
        while (Date.now() - started < maxWaitMs) {
            try {
                const snap = await db
                    .collection("documents")
                    .doc(userId)
                    .collection("userDocuments")
                    .doc(documentId)
                    .get();
                if (snap.exists) {
                    const data = snap.data() || {};
                    let rawText = String(((_a = data === null || data === void 0 ? void 0 : data.content) === null || _a === void 0 ? void 0 : _a.raw) || ((_b = data === null || data === void 0 ? void 0 : data.content) === null || _b === void 0 ? void 0 : _b.processed) || "");
                    if (rawText && rawText.trim().length >= 120) {
                        return rawText.slice(0, 18000);
                    }
                    const transcriptPath = (_c = data === null || data === void 0 ? void 0 : data.metadata) === null || _c === void 0 ? void 0 : _c.transcriptPath;
                    if (transcriptPath) {
                        try {
                            const [buf] = await (await Promise.resolve().then(() => __importStar(require("firebase-admin/storage"))))
                                .getStorage()
                                .bucket()
                                .file(transcriptPath)
                                .download();
                            const txt = buf.toString("utf-8");
                            if (txt && txt.trim().length >= 120) {
                                return txt.slice(0, 18000);
                            }
                        }
                        catch (e) {
                            // transcript might not be visible yet; continue retry loop
                            firebase_functions_1.logger.debug("waitForRawText: transcript read not ready, retrying", e);
                        }
                    }
                }
            }
            catch (e) {
                firebase_functions_1.logger.debug("waitForRawText polling failed (continuing)", e);
            }
            await new Promise((r) => setTimeout(r, delay));
            delay = Math.min(3000, Math.floor(delay * 1.5));
        }
        return ""; // caller will handle empty string
    }
    /**
     * Generate a summary of a document
     */
    async generateDocumentSummary(documentId, userId, maxLength = 500) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        try {
            // If the document was indexed into OpenAI Vector Store (DOCX path), use file_search-based summarization
            try {
                const db = (0, firestore_1.getFirestore)();
                const snap = await db
                    .collection("documents")
                    .doc(userId)
                    .collection("userDocuments")
                    .doc(documentId)
                    .get();
                if (snap.exists) {
                    const data = snap.data() || {};
                    const vsId = (_b = (_a = data === null || data === void 0 ? void 0 : data.metadata) === null || _a === void 0 ? void 0 : _a.openaiVector) === null || _b === void 0 ? void 0 : _b.vectorStoreId;
                    if (vsId) {
                        firebase_functions_1.logger.info("Summarizing via OpenAI Vector Store", {
                            documentId,
                            vsId,
                        });
                        // Small retry loop to allow vector store indexing to settle for large files
                        let vsErr = null;
                        for (let attempt = 0; attempt < 2; attempt++) {
                            try {
                                const summary = await this.summarizeWithOpenAIVectorStore(vsId, maxLength, String((data === null || data === void 0 ? void 0 : data.title) || "Document"));
                                if (summary && summary.trim().length)
                                    return summary;
                            }
                            catch (e) {
                                vsErr = e;
                                await new Promise((r) => setTimeout(r, 1500));
                            }
                        }
                        if (vsErr) {
                            firebase_functions_1.logger.warn("Vector store summarization failed, attempting Firestore raw content fallback", vsErr);
                            // Fallback to Firestore raw content if available
                            // Wait briefly for transcript/inline content to become available
                            let rawText = await this.waitForRawText(userId, documentId, 30000);
                            if (rawText && rawText.length > 100) {
                                const prompt = `Summarize the following document into ~${maxLength} words using markdown with headings, bullets, numbered lists, and a Key Takeaways section. Maintain factuality.\n\n${rawText}`;
                                const resp = await this.openai.chat.completions.create({
                                    model: "gpt-4o-mini",
                                    messages: [
                                        {
                                            role: "system",
                                            content: "You are an expert summarizer. Produce clear, well-structured markdown. No code fences.",
                                        },
                                        { role: "user", content: prompt },
                                    ],
                                    max_tokens: Math.ceil(maxLength * 1.6),
                                    temperature: 0.25,
                                });
                                const txt = ((_e = (_d = (_c = resp.choices) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.content) || "";
                                if (txt)
                                    return txt;
                            }
                        }
                    }
                }
            }
            catch (vsCheckErr) {
                firebase_functions_1.logger.warn("Vector store check failed; attempting content fallback", vsCheckErr);
            }
            // Content fallback for summary (with wait):
            const rawText = await this.waitForRawText(userId, documentId, 30000);
            if (!rawText || rawText.length < 80)
                return "No content available for summary.";
            const prompt = `Summarize the following document into ~${maxLength} words using markdown with headings, bullets, numbered lists, and a Key Takeaways section. Maintain factuality.\n\n${rawText}`;
            const resp = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert summarizer. Produce clear, well-structured markdown. No code fences.",
                    },
                    { role: "user", content: prompt },
                ],
                max_tokens: Math.ceil(maxLength * 1.6),
                temperature: 0.25,
            });
            const txt = ((_h = (_g = (_f = resp.choices) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.message) === null || _h === void 0 ? void 0 : _h.content) || "";
            return txt || "Could not generate summary.";
        }
        catch (error) {
            firebase_functions_1.logger.error("Error generating document summary:", error);
            throw new Error("Failed to generate document summary");
        }
    }
    /**
     * Generate study flashcards for a document.
     * Strategy:
     *  - Probe available content for chunkCount (same heuristic as summary)
     *  - Fetch up to MAX_CHUNKS_FOR_FLASHCARDS ordered chunks
     *  - Concatenate & truncate context
     *  - Prompt OpenAI to emit clean JSON ONLY: [{"front":"...","back":"...","category":"..."}, ...]
     */
    async generateFlashcards(documentId, userId, count = 12, forceNew = false) {
        var _a, _b, _c, _d, _e, _f, _g;
        try {
            const db = (0, firestore_1.getFirestore)();
            // Cache lookup first (skip if forceNew is true)
            if (!forceNew) {
                try {
                    const cacheDoc = await db
                        .collection("documents")
                        .doc(userId)
                        .collection("userDocuments")
                        .doc(documentId)
                        .collection("aiArtifacts")
                        .doc("flashcards_v1")
                        .get();
                    if (cacheDoc.exists) {
                        const data = cacheDoc.data();
                        if (data.flashcards && data.flashcards.length) {
                            firebase_functions_1.logger.info("Serving flashcards from cache", {
                                len: data.flashcards.length,
                            });
                            return data.flashcards.slice(0, count);
                        }
                    }
                }
                catch (e) {
                    firebase_functions_1.logger.warn("Flashcard cache read failed", e);
                }
            }
            firebase_functions_1.logger.info("Flashcards generation start", {
                userId,
                documentId,
                requested: count,
            });
            // Read document and build source text
            const docSnap = await db
                .collection("documents")
                .doc(userId)
                .collection("userDocuments")
                .doc(documentId)
                .get();
            if (!docSnap.exists)
                return [];
            const data = docSnap.data();
            let sourceText = (data.summary ||
                ((_a = data.content) === null || _a === void 0 ? void 0 : _a.raw) ||
                ((_b = data.content) === null || _b === void 0 ? void 0 : _b.processed) ||
                "").slice(0, 18000);
            if (!sourceText || sourceText.length < 120) {
                const transcriptPath = (_c = data.metadata) === null || _c === void 0 ? void 0 : _c.transcriptPath;
                if (transcriptPath) {
                    try {
                        const [buf] = await (await Promise.resolve().then(() => __importStar(require("firebase-admin/storage"))))
                            .getStorage()
                            .bucket()
                            .file(transcriptPath)
                            .download();
                        sourceText = buf.toString("utf-8").slice(0, 18000);
                    }
                    catch (_h) {
                        // ignore
                    }
                }
                const url = (_d = data.metadata) === null || _d === void 0 ? void 0 : _d.downloadURL;
                if ((!sourceText || sourceText.length < 120) && url) {
                    try {
                        const res = await fetch(url);
                        if (res.ok) {
                            const txt = await res.text();
                            sourceText = (txt || "").slice(0, 18000);
                        }
                    }
                    catch (fetchErr) {
                        firebase_functions_1.logger.warn("downloadURL fetch failed for flashcards fallback", fetchErr);
                    }
                }
            }
            if (!sourceText || sourceText.length < 120) {
                return [];
            }
            const fcPrompt = `Generate ${count} JSON flashcards from the following text. Return ONLY a JSON array where each item has front, back, and category. Text:\n\n${sourceText}`;
            const resp = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You produce concise educational flashcards as valid JSON array only. Do not include any commentary.",
                    },
                    { role: "user", content: fcPrompt },
                ],
                temperature: 0.4,
                max_tokens: 1400,
            });
            const raw = ((_g = (_f = (_e = resp.choices) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.message) === null || _g === void 0 ? void 0 : _g.content) || "";
            const sIdx = raw.indexOf("[");
            const eIdx = raw.lastIndexOf("]");
            let cards = [];
            if (sIdx !== -1 && eIdx !== -1) {
                try {
                    const parsed = JSON.parse(raw.slice(sIdx, eIdx + 1));
                    cards = parsed
                        .filter((c) => c && c.front && c.back)
                        .slice(0, count)
                        .map((c) => ({
                        front: String(c.front).trim().slice(0, 200),
                        back: String(c.back).trim().slice(0, 400),
                        category: (c.category ? String(c.category) : "Concept")
                            .trim()
                            .slice(0, 40),
                    }));
                }
                catch (parseErr) {
                    firebase_functions_1.logger.warn("Failed to parse flashcards JSON", parseErr);
                }
            }
            firebase_functions_1.logger.info("Flashcards generated", { count: cards.length });
            // Persist cache asynchronously
            if (cards.length) {
                db.collection("documents")
                    .doc(userId)
                    .collection("userDocuments")
                    .doc(documentId)
                    .collection("aiArtifacts")
                    .doc("flashcards_v1")
                    .set({
                    flashcards: cards,
                    updatedAt: new Date(),
                    size: cards.length,
                    model: "gpt-4o-mini",
                    version: 1,
                    fallback: false,
                }, { merge: true })
                    .catch((err) => firebase_functions_1.logger.warn("Failed to cache flashcards", err));
            }
            return cards;
        }
        catch (error) {
            firebase_functions_1.logger.error("Error generating flashcards:", error);
            throw new Error("Failed to generate flashcards");
        }
    }
    /**
     * Generate quiz questions for a document.
     * Similar strategy to flashcards but generates multiple choice questions with explanations.
     */
    async generateQuiz(documentId, userId, count = 10, difficulty = "mixed", forceNew = false) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        try {
            const db = (0, firestore_1.getFirestore)();
            const cacheKey = `quiz_v1_${difficulty}_${count}`;
            // Cache lookup first (skip if forceNew is true)
            if (!forceNew) {
                try {
                    const cacheDoc = await db
                        .collection("documents")
                        .doc(userId)
                        .collection("userDocuments")
                        .doc(documentId)
                        .collection("aiArtifacts")
                        .doc(cacheKey)
                        .get();
                    if (cacheDoc.exists) {
                        const cdata = cacheDoc.data();
                        if (cdata.quiz && cdata.quiz.length) {
                            firebase_functions_1.logger.info("Serving quiz from cache", {
                                len: cdata.quiz.length,
                                difficulty,
                            });
                            return cdata.quiz.slice(0, count);
                        }
                    }
                }
                catch (e) {
                    firebase_functions_1.logger.warn("Quiz cache read failed", e);
                }
            }
            firebase_functions_1.logger.info("Quiz generation start", {
                userId,
                documentId,
                requested: count,
                difficulty,
            });
            // Read document and build source text
            const docSnap = await db
                .collection("documents")
                .doc(userId)
                .collection("userDocuments")
                .doc(documentId)
                .get();
            if (!docSnap.exists)
                return [];
            const data = docSnap.data();
            const preferTranscript = count >= 20;
            let sourceText = "";
            if (preferTranscript && ((_a = data.metadata) === null || _a === void 0 ? void 0 : _a.transcriptPath)) {
                try {
                    const [buf] = await (await Promise.resolve().then(() => __importStar(require("firebase-admin/storage"))))
                        .getStorage()
                        .bucket()
                        .file(data.metadata.transcriptPath)
                        .download();
                    sourceText = buf.toString("utf-8").slice(0, 18000);
                }
                catch (e) {
                    firebase_functions_1.logger.warn("Transcript read failed; falling back to Firestore fields", e);
                }
            }
            if (!sourceText) {
                sourceText = (data.summary ||
                    ((_b = data.content) === null || _b === void 0 ? void 0 : _b.raw) ||
                    ((_c = data.content) === null || _c === void 0 ? void 0 : _c.processed) ||
                    "").slice(0, 18000);
            }
            if ((!sourceText || sourceText.length < 120) &&
                ((_d = data.metadata) === null || _d === void 0 ? void 0 : _d.transcriptPath)) {
                try {
                    const [buf] = await (await Promise.resolve().then(() => __importStar(require("firebase-admin/storage"))))
                        .getStorage()
                        .bucket()
                        .file(data.metadata.transcriptPath)
                        .download();
                    sourceText = buf.toString("utf-8").slice(0, 18000);
                }
                catch (_j) {
                    /* ignore */
                }
            }
            if ((!sourceText || sourceText.length < 120) &&
                ((_e = data.metadata) === null || _e === void 0 ? void 0 : _e.downloadURL)) {
                try {
                    const res = await fetch(data.metadata.downloadURL);
                    if (res.ok) {
                        const txt = await res.text();
                        sourceText = (txt || "").slice(0, 18000);
                    }
                }
                catch (fetchErr) {
                    firebase_functions_1.logger.warn("downloadURL fetch failed for quiz fallback", fetchErr);
                }
            }
            if (!sourceText || sourceText.length < 120)
                return [];
            const quizPrompt = `Generate ${count} multiple-choice quiz questions from the following text. Return ONLY a strict JSON array (no markdown/code fences), where each item has: id, question, options (array of 4 strings), correctAnswer (0-3 index), explanation, category, difficulty (easy/medium/hard). Use valid JSON only: double quotes for strings, no comments, no trailing commas.\n\nText:\n\n${sourceText}`;
            const resp = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You produce educational quiz questions as a strict JSON array only. No commentary, no markdown, no code fences. Do not include trailing commas.",
                    },
                    { role: "user", content: quizPrompt },
                ],
                temperature: count >= 15 ? 0.2 : 0.4,
                max_tokens: Math.min(3500, 120 + count * 130),
            });
            let raw = ((_h = (_g = (_f = resp.choices) === null || _f === void 0 ? void 0 : _f[0]) === null || _g === void 0 ? void 0 : _g.message) === null || _h === void 0 ? void 0 : _h.content) || "";
            const sIdx = raw.indexOf("[");
            const eIdx = raw.lastIndexOf("]");
            let questions = [];
            if (sIdx !== -1 && eIdx !== -1) {
                const rawSlice = raw.slice(sIdx, eIdx + 1);
                const sanitize = (s) => s
                    .replace(/```json|```/g, "")
                    .replace(/[\u201C\u201D]/g, '"')
                    .replace(/[\u2018\u2019]/g, "'")
                    .replace(/,\s*([}\]])/g, "$1");
                try {
                    const parsed = JSON.parse(sanitize(rawSlice));
                    questions = parsed
                        .filter((q) => q &&
                        q.question &&
                        q.options &&
                        Array.isArray(q.options) &&
                        q.options.length === 4)
                        .slice(0, count)
                        .map((q, index) => {
                        var _a;
                        return ({
                            id: String(q.id || index + 1),
                            question: String(q.question).trim().slice(0, 300),
                            options: q.options.map((opt) => String(opt).trim().slice(0, 150)),
                            correctAnswer: Math.max(0, Math.min(3, Number((_a = q.correctAnswer) !== null && _a !== void 0 ? _a : 0))),
                            explanation: String(q.explanation || "")
                                .trim()
                                .slice(0, 400),
                            category: (q.category
                                ? String(q.category)
                                : "General")
                                .trim()
                                .slice(0, 40),
                            difficulty: (["easy", "medium", "hard"].includes(q.difficulty)
                                ? q.difficulty
                                : "medium"),
                        });
                    });
                }
                catch (parseErr) {
                    firebase_functions_1.logger.warn("Failed to parse quiz JSON", parseErr);
                }
            }
            firebase_functions_1.logger.info("Quiz generated", { count: questions.length, difficulty });
            // Persist cache asynchronously
            if (questions.length) {
                db.collection("documents")
                    .doc(userId)
                    .collection("userDocuments")
                    .doc(documentId)
                    .collection("aiArtifacts")
                    .doc(cacheKey)
                    .set({
                    quiz: questions,
                    updatedAt: new Date(),
                    size: questions.length,
                    model: "gpt-4o-mini",
                    version: 1,
                    difficulty,
                    fallback: false,
                }, { merge: true })
                    .catch((err) => firebase_functions_1.logger.warn("Failed to cache quiz", err));
            }
            return questions;
        }
        catch (error) {
            firebase_functions_1.logger.error("Error generating quiz:", error);
            throw new Error("Failed to generate quiz");
        }
    }
}
exports.QueryService = QueryService;
//# sourceMappingURL=queryService.js.map