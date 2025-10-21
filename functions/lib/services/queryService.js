"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryService = void 0;
const openai_1 = require("openai");
const firebase_functions_1 = require("firebase-functions");
const embeddingService_1 = require("./embeddingService");
const pineconeService_1 = require("./pineconeService");
const firestore_1 = require("firebase-admin/firestore");
class QueryService {
    constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY environment variable is not set");
        }
        this.openai = new openai_1.OpenAI({
            apiKey: apiKey,
        });
        this.embeddingService = new embeddingService_1.EmbeddingService();
        this.pineconeService = new pineconeService_1.PineconeService();
    }
    /**
     * Query the RAG system with a question
     */
    async queryRAG(question, userId, documentId, topK = 5) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
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
            // Step 1: Generate embedding for the question
            const queryEmbedding = await this.embeddingService.embedQuery(question);
            // Step 2: Search Pinecone for similar chunks
            const similarChunks = await this.pineconeService.querySimilarChunks(queryEmbedding, userId, topK, documentId);
            if (similarChunks.length === 0) {
                // Prefer vector store fallback when available for this document
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
                            const isDocxPptxTxt = ["docx", "pptx", "text"].includes(String((data === null || data === void 0 ? void 0 : data.type) || "").toLowerCase()) ||
                                String(((_k = data === null || data === void 0 ? void 0 : data.metadata) === null || _k === void 0 ? void 0 : _k.mimeType) || "").includes("word") ||
                                String(((_l = data === null || data === void 0 ? void 0 : data.metadata) === null || _l === void 0 ? void 0 : _l.mimeType) || "").includes("presentation") ||
                                String(((_m = data === null || data === void 0 ? void 0 : data.metadata) === null || _m === void 0 ? void 0 : _m.mimeType) || "").includes("text/plain");
                            if (!vsId &&
                                isDocxPptxTxt &&
                                ((_o = data === null || data === void 0 ? void 0 : data.metadata) === null || _o === void 0 ? void 0 : _o.openaiVector)) {
                                vsId =
                                    process.env.OPENAI_VECTOR_STORE_ID ||
                                        "vs_68f1528dad6c8191bfb8a090e1557a86";
                            }
                            if (vsId) {
                                firebase_functions_1.logger.info("No Pinecone chunks; answering via OpenAI Vector Store", { documentId, vsId });
                                try {
                                    const answer = await this.answerWithOpenAIVectorStore(question, vsId);
                                    return {
                                        answer,
                                        sources: [
                                            {
                                                documentId,
                                                title: data.title || "Document",
                                                fileName: (_p = data === null || data === void 0 ? void 0 : data.metadata) === null || _p === void 0 ? void 0 : _p.fileName,
                                                chunk: "Retrieved via OpenAI Vector Store file search",
                                                score: 1.0,
                                            },
                                        ],
                                        confidence: 80,
                                    };
                                }
                                catch (e) {
                                    firebase_functions_1.logger.warn("Vector store fallback failed, attempting content/summary", e);
                                }
                            }
                            let context = (data.summary ||
                                ((_q = data.content) === null || _q === void 0 ? void 0 : _q.raw) ||
                                ((_r = data.content) === null || _r === void 0 ? void 0 : _r.processed) ||
                                "").slice(0, 24000);
                            if (!context || context.length < 80) {
                                const url = (_s = data.metadata) === null || _s === void 0 ? void 0 : _s.downloadURL;
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
                                const fileName = (_t = data.metadata) === null || _t === void 0 ? void 0 : _t.fileName;
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
            // Step 3: Combine chunks into context
            const context = similarChunks
                .map((chunk) => `[Source: ${chunk.title}] ${chunk.chunk}`)
                .join("\n\n");
            // Step 4: Generate answer using GPT-4o-mini
            const answer = await this.generateAnswer(question, context);
            // Calculate confidence based on similarity scores
            const avgScore = similarChunks.reduce((sum, chunk) => sum + chunk.score, 0) /
                similarChunks.length;
            const confidence = Math.min(avgScore * 100, 95); // Cap at 95%
            return {
                answer,
                sources: similarChunks.map((chunk) => ({
                    documentId: chunk.documentId,
                    title: chunk.title,
                    fileName: chunk.fileName,
                    chunk: chunk.chunk.substring(0, 200) + "...", // Truncate for display
                    score: chunk.score,
                })),
                confidence,
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
        var _a;
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
                const assistantMessage = messages.data.find((msg) => msg.role === "assistant");
                const textContent = assistantMessage === null || assistantMessage === void 0 ? void 0 : assistantMessage.content.find((content) => content.type === "text");
                const summary = ((_a = textContent === null || textContent === void 0 ? void 0 : textContent.text) === null || _a === void 0 ? void 0 : _a.value) || "";
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
     * Generate a summary of a document
     */
    async generateDocumentSummary(documentId, userId, maxLength = 500) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
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
                        try {
                            const summary = await this.summarizeWithOpenAIVectorStore(vsId, maxLength, String((data === null || data === void 0 ? void 0 : data.title) || "Document"));
                            if (summary && summary.trim().length)
                                return summary;
                        }
                        catch (e) {
                            firebase_functions_1.logger.warn("Vector store summarization failed, attempting Firestore raw content fallback", e);
                            // Fallback to Firestore raw content if available
                            const rawText = String(((_c = data === null || data === void 0 ? void 0 : data.content) === null || _c === void 0 ? void 0 : _c.raw) || ((_d = data === null || data === void 0 ? void 0 : data.content) === null || _d === void 0 ? void 0 : _d.processed) || "").slice(0, 24000);
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
                                const txt = ((_g = (_f = (_e = resp.choices) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.message) === null || _g === void 0 ? void 0 : _g.content) || "";
                                if (txt)
                                    return txt;
                            }
                        }
                    }
                }
            }
            catch (vsCheckErr) {
                firebase_functions_1.logger.warn("Vector store check failed; proceeding with Pinecone path", vsCheckErr);
            }
            // First attempt to infer chunkCount from a representative vector (by querying 1 similar vector)
            // Fallback: assume up to 1000 chunks cap
            let chunkCount = 0;
            try {
                const probe = await this.pineconeService.querySimilarChunks(new Array(1024).fill(0), userId, 1, documentId);
                if (probe.length) {
                    // Try to parse highest index by querying a wider set
                    const broader = await this.pineconeService.querySimilarChunks(new Array(1024).fill(0), userId, 50, documentId);
                    const indices = broader
                        .map((m) => parseInt(m.id.split("_").pop() || "0", 10))
                        .filter((n) => !isNaN(n));
                    if (indices.length)
                        chunkCount = Math.max(...indices) + 1;
                }
            }
            catch (e) {
                // ignore
            }
            if (chunkCount === 0)
                chunkCount = 300; // safe default
            // Fetch ordered chunks (limit for summarization efficiency)
            const MAX_CHUNKS_FOR_SUMMARY = 200; // tuneable
            const ordered = await this.pineconeService.fetchDocumentChunks(documentId, userId, chunkCount, MAX_CHUNKS_FOR_SUMMARY);
            if (!ordered.length)
                return "No content available for summary.";
            // Map-Reduce style summarization for very large documents
            const PART_SIZE_CHARS = 6000; // each part fed to model
            const parts = [];
            let buffer = "";
            for (const c of ordered) {
                if (buffer.length + c.chunk.length > PART_SIZE_CHARS) {
                    parts.push(buffer);
                    buffer = "";
                }
                buffer += (buffer ? " " : "") + c.chunk;
            }
            if (buffer)
                parts.push(buffer);
            const intermediateSummaries = [];
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i].substring(0, PART_SIZE_CHARS);
                const resp = await this.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "system",
                            content: `You summarize document sections. Produce a concise bullet summary of the section's key points.`,
                        },
                        {
                            role: "user",
                            content: `Section ${i + 1} of ${parts.length} (truncate if noisy):\n\n${part}`,
                        },
                    ],
                    max_tokens: 300,
                    temperature: 0.2,
                });
                const partial = (_k = (_j = (_h = resp.choices[0]) === null || _h === void 0 ? void 0 : _h.message) === null || _j === void 0 ? void 0 : _j.content) === null || _k === void 0 ? void 0 : _k.trim();
                if (partial)
                    intermediateSummaries.push(partial);
                if (intermediateSummaries.length >= 12)
                    break; // prevent runaway cost
            }
            // Final synthesis
            const synthesisInput = intermediateSummaries
                .join("\n\n")
                .substring(0, 8000);
            const finalResp = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert summarizer. Create beautiful professional summary of the entire document according to the requiremnts, RICH markdown summary (~${maxLength} words).
Output Requirements:
- Start with a paragraph summary summarizing the document
- Use hierarchical headings (##, ###) to group concepts.
- Use a mix of paragraphs, bullet lists and numbered lists for key points and procedures.
- Bold important terms and labels (e.g., **Definition:**) and optionally append 1 relevant emoji per major heading (no more than 1 emoji per heading).
- Include a short "Key Takeaways" section near the end as a bulleted list.
- Avoid redundancy and filler. No preamble like 'Here is the summary'.
- Do NOT wrap the entire response in code fences.
Return valid markdown only.`,
                    },
                    {
                        role: "user",
                        content: synthesisInput,
                    },
                ],
                max_tokens: Math.ceil(maxLength * 1.6),
                temperature: 0.25,
            });
            return (((_m = (_l = finalResp.choices[0]) === null || _l === void 0 ? void 0 : _l.message) === null || _m === void 0 ? void 0 : _m.content) || "Could not generate summary.");
        }
        catch (error) {
            firebase_functions_1.logger.error("Error generating document summary:", error);
            throw new Error("Failed to generate document summary");
        }
    }
    /**
     * Generate study flashcards for a document.
     * Strategy:
     *  - Probe Pinecone for chunkCount (same heuristic as summary)
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
            // Estimate chunk count (reuse probe logic)
            let chunkCount = 0;
            try {
                const probe = await this.pineconeService.querySimilarChunks(new Array(1024).fill(0), userId, 1, documentId);
                if (probe.length) {
                    const broader = await this.pineconeService.querySimilarChunks(new Array(1024).fill(0), userId, 50, documentId);
                    const indices = broader
                        .map((m) => parseInt(m.id.split("_").pop() || "0", 10))
                        .filter((n) => !isNaN(n));
                    if (indices.length)
                        chunkCount = Math.max(...indices) + 1;
                }
            }
            catch (e) {
                // ignore probe failures
            }
            if (chunkCount === 0)
                chunkCount = 300;
            const MAX_CHUNKS_FOR_FLASHCARDS = 120; // tuneable cost/performance knob
            const ordered = await this.pineconeService.fetchDocumentChunks(documentId, userId, chunkCount, MAX_CHUNKS_FOR_FLASHCARDS);
            if (!ordered.length) {
                firebase_functions_1.logger.warn("No vectors found for document. Falling back to Firestore raw content", { documentId });
                try {
                    const docSnap = await db
                        .collection("documents")
                        .doc(userId)
                        .collection("userDocuments")
                        .doc(documentId)
                        .get();
                    if (docSnap.exists) {
                        const data = docSnap.data();
                        let sourceText = (data.summary ||
                            ((_a = data.content) === null || _a === void 0 ? void 0 : _a.raw) ||
                            ((_b = data.content) === null || _b === void 0 ? void 0 : _b.processed) ||
                            "").slice(0, 18000);
                        // If Firestore content is missing, try to fetch from downloadURL as a final fallback
                        if (!sourceText || sourceText.length < 120) {
                            const url = (_c = data.metadata) === null || _c === void 0 ? void 0 : _c.downloadURL;
                            if (url) {
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
                        if (sourceText.length > 120) {
                            const fcPrompt = `Generate ${count} JSON flashcards from the following text. Same JSON array spec as before (front, back, category). Text:\n\n${sourceText}`;
                            const resp = await this.openai.chat.completions.create({
                                model: "gpt-4o-mini",
                                messages: [
                                    {
                                        role: "system",
                                        content: "You produce concise educational flashcards as valid JSON array only.",
                                    },
                                    { role: "user", content: fcPrompt },
                                ],
                                temperature: 0.4,
                                max_tokens: 1400,
                            });
                            const rawAlt = ((_e = (_d = resp.choices[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.content) || "";
                            const start = rawAlt.indexOf("[");
                            const end = rawAlt.lastIndexOf("]");
                            if (start !== -1 && end !== -1) {
                                try {
                                    const parsedAlt = JSON.parse(rawAlt.slice(start, end + 1));
                                    const cardsAlt = parsedAlt
                                        .filter((c) => c && c.front && c.back)
                                        .slice(0, count)
                                        .map((c) => ({
                                        front: String(c.front).trim().slice(0, 200),
                                        back: String(c.back).trim().slice(0, 600),
                                        category: (c.category ? String(c.category) : "Concept")
                                            .trim()
                                            .slice(0, 40),
                                    }));
                                    if (cardsAlt.length) {
                                        firebase_functions_1.logger.info("Flashcards generated via raw-content fallback", { len: cardsAlt.length });
                                        // cache
                                        db.collection("documents")
                                            .doc(userId)
                                            .collection("userDocuments")
                                            .doc(documentId)
                                            .collection("aiArtifacts")
                                            .doc("flashcards_v1")
                                            .set({
                                            flashcards: cardsAlt,
                                            updatedAt: new Date(),
                                            fallback: true,
                                        }, { merge: true })
                                            .catch((err) => firebase_functions_1.logger.warn("Cache write fail (fallback)", err));
                                        return cardsAlt;
                                    }
                                }
                                catch (e) {
                                    firebase_functions_1.logger.warn("Fallback flashcard parse failed", e);
                                }
                            }
                        }
                    }
                }
                catch (rawErr) {
                    firebase_functions_1.logger.warn("Raw content fallback failed", rawErr);
                }
                return [];
            }
            // Build context (limit to ~24k chars to control tokens)
            const rawContext = ordered.map((c) => c.chunk).join("\n\n");
            const context = rawContext.slice(0, 24000);
            firebase_functions_1.logger.info("Flashcards doc stats", {
                estimatedChunks: chunkCount,
                usedVectors: ordered.length,
                contextChars: context.length,
            });
            const systemPrompt = `You are an expert educator generating high-quality spaced-repetition flashcards from source material. Guidelines:\n- Produce exactly ${count} diverse flashcards unless material is too small (then produce as many as reasonable, minimum 3).\n- Vary categories among Definition, Concept, Process, Fact, Application, Comparison, Cause/Effect, Example.\n- FRONT should be a concise question (max 110 chars) or cloze deletion using {{blank}}.\n- BACK should be a clear, factual answer (1-3 sentences or bullet list <= 220 chars).\n- Avoid trivia; focus on core ideas, relationships, and important details.\n- If original text contains another language, keep answer in that language but translate key term in parentheses if helpful.\n- Output ONLY raw JSON array, no commentary, no code fences.`;
            const userPrompt = `Source Content (truncated):\n${context}\n\nGenerate flashcards now.`;
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.35,
                max_tokens: 1600,
            });
            const raw = ((_g = (_f = response.choices[0]) === null || _f === void 0 ? void 0 : _f.message) === null || _g === void 0 ? void 0 : _g.content) || "";
            let jsonText = raw.trim();
            // Attempt to salvage JSON if model added prose
            const firstBracket = jsonText.indexOf("[");
            const lastBracket = jsonText.lastIndexOf("]");
            if (firstBracket !== -1 && lastBracket !== -1) {
                jsonText = jsonText.slice(firstBracket, lastBracket + 1);
            }
            let parsed = [];
            try {
                parsed = JSON.parse(jsonText);
            }
            catch (e) {
                firebase_functions_1.logger.warn("Flashcard JSON parse failed", { raw: raw.slice(0, 500) });
                return [];
            }
            // Normalize & validate
            const cards = parsed
                .filter((c) => typeof c === "object" &&
                c !== null &&
                typeof c.front === "string" &&
                typeof c.back === "string")
                .slice(0, count)
                .map((c) => ({
                front: String(c.front)
                    .trim()
                    .slice(0, 200),
                back: String(c.back)
                    .trim()
                    .slice(0, 600),
                category: (c.category
                    ? String(c.category)
                    : "Concept")
                    .trim()
                    .slice(0, 40),
            }));
            firebase_functions_1.logger.info("Flashcards generated (vector pathway)", {
                count: cards.length,
            });
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
        var _a, _b, _c, _d, _e, _f;
        try {
            const db = (0, firestore_1.getFirestore)();
            // Cache lookup first (skip if forceNew is true)
            const cacheKey = `quiz_v1_${difficulty}_${count}`;
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
                        const data = cacheDoc.data();
                        if (data.quiz && data.quiz.length) {
                            firebase_functions_1.logger.info("Serving quiz from cache", {
                                len: data.quiz.length,
                                difficulty,
                            });
                            return data.quiz.slice(0, count);
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
            // Estimate chunk count (reuse probe logic from flashcards)
            let chunkCount = 0;
            try {
                const probe = await this.pineconeService.querySimilarChunks(new Array(1024).fill(0), userId, 1, documentId);
                if (probe.length) {
                    const broader = await this.pineconeService.querySimilarChunks(new Array(1024).fill(0), userId, 50, documentId);
                    const indices = broader
                        .map((m) => parseInt(m.id.split("_").pop() || "0", 10))
                        .filter((n) => !isNaN(n));
                    if (indices.length)
                        chunkCount = Math.max(...indices) + 1;
                }
            }
            catch (e) {
                // ignore probe failures
            }
            if (chunkCount === 0)
                chunkCount = 300;
            const MAX_CHUNKS_FOR_QUIZ = 100; // tuneable cost/performance knob
            const ordered = await this.pineconeService.fetchDocumentChunks(documentId, userId, chunkCount, MAX_CHUNKS_FOR_QUIZ);
            if (!ordered.length) {
                firebase_functions_1.logger.warn("No vectors found for document. Falling back to Firestore raw content", { documentId });
                try {
                    const docSnap = await db
                        .collection("documents")
                        .doc(userId)
                        .collection("userDocuments")
                        .doc(documentId)
                        .get();
                    if (docSnap.exists) {
                        const data = docSnap.data();
                        const sourceText = (data.summary ||
                            ((_a = data.content) === null || _a === void 0 ? void 0 : _a.raw) ||
                            ((_b = data.content) === null || _b === void 0 ? void 0 : _b.processed) ||
                            "").slice(0, 18000);
                        if (sourceText.length > 120) {
                            const quizPrompt = `Generate ${count} multiple-choice quiz questions from the following text. Return as JSON array with id, question, options (4 choices), correctAnswer (0-3 index), explanation, category, and difficulty. Text:\n\n${sourceText}`;
                            const resp = await this.openai.chat.completions.create({
                                model: "gpt-4o-mini",
                                messages: [
                                    {
                                        role: "system",
                                        content: "You produce educational quiz questions as valid JSON array only. Each question should have 4 options with one correct answer.",
                                    },
                                    { role: "user", content: quizPrompt },
                                ],
                                temperature: 0.4,
                                max_tokens: 2000,
                            });
                            const rawAlt = ((_d = (_c = resp.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || "";
                            const start = rawAlt.indexOf("[");
                            const end = rawAlt.lastIndexOf("]");
                            if (start !== -1 && end !== -1) {
                                try {
                                    const parsedAlt = JSON.parse(rawAlt.slice(start, end + 1));
                                    const questionsAlt = parsedAlt
                                        .filter((q) => q &&
                                        q.question &&
                                        q.options &&
                                        Array.isArray(q.options) &&
                                        q.options.length === 4)
                                        .slice(0, count)
                                        .map((q, index) => ({
                                        id: String(index + 1),
                                        question: String(q.question).trim().slice(0, 300),
                                        options: q.options.map((opt) => String(opt).trim().slice(0, 150)),
                                        correctAnswer: Math.max(0, Math.min(3, parseInt(q.correctAnswer) || 0)),
                                        explanation: String(q.explanation || "")
                                            .trim()
                                            .slice(0, 400),
                                        category: (q.category ? String(q.category) : "General")
                                            .trim()
                                            .slice(0, 40),
                                        difficulty: (["easy", "medium", "hard"].includes(q.difficulty)
                                            ? q.difficulty
                                            : "medium"),
                                    }));
                                    if (questionsAlt.length) {
                                        firebase_functions_1.logger.info("Quiz generated via raw-content fallback", {
                                            len: questionsAlt.length,
                                        });
                                        // cache
                                        db.collection("documents")
                                            .doc(userId)
                                            .collection("userDocuments")
                                            .doc(documentId)
                                            .collection("aiArtifacts")
                                            .doc(cacheKey)
                                            .set({
                                            quiz: questionsAlt,
                                            updatedAt: new Date(),
                                            fallback: true,
                                        }, { merge: true })
                                            .catch((err) => firebase_functions_1.logger.warn("Cache write fail (fallback)", err));
                                        return questionsAlt;
                                    }
                                }
                                catch (e) {
                                    firebase_functions_1.logger.warn("Fallback quiz parse failed", e);
                                }
                            }
                        }
                    }
                }
                catch (rawErr) {
                    firebase_functions_1.logger.warn("Raw content fallback failed", rawErr);
                }
                return [];
            }
            // Build context (limit to ~20k chars to control tokens)
            const rawContext = ordered.map((c) => c.chunk).join("\n\n");
            const context = rawContext.slice(0, 20000);
            firebase_functions_1.logger.info("Quiz doc stats", {
                estimatedChunks: chunkCount,
                usedVectors: ordered.length,
                contextChars: context.length,
            });
            const difficultyInstruction = difficulty === "mixed"
                ? "Mix difficulty levels (easy, medium, hard) across questions."
                : `Focus on ${difficulty} difficulty level questions.`;
            const systemPrompt = `You are an expert educator generating high-quality multiple-choice quiz questions from source material. Guidelines:\n- Produce exactly ${count} diverse quiz questions unless material is too small (then produce as many as reasonable, minimum 3).\n- Each question must have exactly 4 options (A, B, C, D) with only one correct answer.\n- Vary categories among Definition, Concept, Process, Fact, Application, Analysis, Synthesis, Evaluation.\n- ${difficultyInstruction}\n- Questions should be clear and unambiguous (max 200 chars).\n- Options should be plausible but only one correct (max 120 chars each).\n- Explanations should clarify why the answer is correct and others are wrong (max 300 chars).\n- Avoid trivial questions; focus on understanding, application, and critical thinking.\n- Output ONLY raw JSON array, no commentary, no code fences.\n- Format: [{"id":"1","question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","category":"...","difficulty":"easy|medium|hard"}]`;
            const userPrompt = `Source Content (truncated):\n${context}\n\nGenerate quiz questions now.`;
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.3,
                max_tokens: 2200,
            });
            const raw = ((_f = (_e = response.choices[0]) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.content) || "";
            let jsonText = raw.trim();
            // Attempt to salvage JSON if model added prose
            const firstBracket = jsonText.indexOf("[");
            const lastBracket = jsonText.lastIndexOf("]");
            if (firstBracket !== -1 && lastBracket !== -1) {
                jsonText = jsonText.slice(firstBracket, lastBracket + 1);
            }
            let parsed = [];
            try {
                parsed = JSON.parse(jsonText);
            }
            catch (e) {
                firebase_functions_1.logger.warn("Quiz JSON parse failed", { raw: raw.slice(0, 500) });
                return [];
            }
            // Normalize & validate
            const questions = parsed
                .filter((q) => typeof q === "object" &&
                q !== null &&
                typeof q.question === "string" &&
                Array.isArray(q.options) &&
                q.options.length === 4 &&
                typeof q.correctAnswer === "number" &&
                q.correctAnswer >= 0 &&
                q.correctAnswer <= 3)
                .slice(0, count)
                .map((q, index) => ({
                id: String(q.id || index + 1),
                question: String(q.question)
                    .trim()
                    .slice(0, 300),
                options: q.options.map((opt) => String(opt).trim().slice(0, 150)),
                correctAnswer: Math.max(0, Math.min(3, Number(q.correctAnswer))),
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
            }));
            firebase_functions_1.logger.info("Quiz generated (vector pathway)", {
                count: questions.length,
            });
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