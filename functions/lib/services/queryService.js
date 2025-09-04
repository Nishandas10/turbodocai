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
        try {
            firebase_functions_1.logger.info(`Processing RAG query for user ${userId}: ${question}`);
            // Step 1: Generate embedding for the question
            const queryEmbedding = await this.embeddingService.embedQuery(question);
            // Step 2: Search Pinecone for similar chunks
            const similarChunks = await this.pineconeService.querySimilarChunks(queryEmbedding, userId, topK, documentId);
            if (similarChunks.length === 0) {
                return {
                    answer: "I couldn't find any relevant information to answer your question. Please make sure you have uploaded and processed documents.",
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
                    chunk: chunk.chunk.substring(0, 200) + "...",
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
     * Generate a summary of a document
     */
    async generateDocumentSummary(documentId, userId, maxLength = 500) {
        var _a, _b, _c, _d, _e;
        try {
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
                const partial = (_c = (_b = (_a = resp.choices[0]) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.trim();
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
                        content: `You are an expert summarizer. Merge bullet summaries into a single cohesive summary (~${maxLength} words). Emphasize core concepts, structure logically, avoid redundancy.`,
                    },
                    {
                        role: "user",
                        content: synthesisInput,
                    },
                ],
                max_tokens: Math.ceil(maxLength * 1.6),
                temperature: 0.25,
            });
            return (((_e = (_d = finalResp.choices[0]) === null || _d === void 0 ? void 0 : _d.message) === null || _e === void 0 ? void 0 : _e.content) || "Could not generate summary.");
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
    async generateFlashcards(documentId, userId, count = 12) {
        var _a, _b, _c, _d, _e, _f;
        try {
            const db = (0, firestore_1.getFirestore)();
            // Cache lookup first
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
                        const sourceText = (data.summary ||
                            ((_a = data.content) === null || _a === void 0 ? void 0 : _a.raw) ||
                            ((_b = data.content) === null || _b === void 0 ? void 0 : _b.processed) ||
                            "").slice(0, 18000);
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
                            const rawAlt = ((_d = (_c = resp.choices[0]) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.content) || "";
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
}
exports.QueryService = QueryService;
//# sourceMappingURL=queryService.js.map