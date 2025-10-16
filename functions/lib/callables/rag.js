"use strict";
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
exports.queryDocuments = exports.sendChatMessage = void 0;
const https_1 = require("firebase-functions/v2/https");
const openai_1 = __importDefault(require("openai"));
const firebase_1 = require("../config/firebase");
const queryService_1 = require("../services/queryService");
const embeddingService_1 = require("../services/embeddingService");
const pineconeService_1 = require("../services/pineconeService");
exports.sendChatMessage = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    var _a, e_1, _b, _c;
    var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7;
    try {
        const { userId, prompt, language, chatId, docIds, webSearch, thinkMode } = request.data || {};
        if (!userId || !prompt || typeof prompt !== "string")
            throw new Error("Missing required parameters: userId and prompt");
        if (request.auth && request.auth.uid && request.auth.uid !== userId)
            throw new Error("Authenticated user mismatch");
        const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
        const model = webSearch ? "gpt-4.1" : thinkMode ? "o3-mini" : "gpt-4o-mini";
        // Create or fetch chat document
        let chatDocId = chatId;
        if (!chatDocId) {
            const title = prompt.trim().slice(0, 60);
            const chatRef = await firebase_1.db.collection("chats").add({
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
            await firebase_1.db.collection("chats").doc(chatDocId).set(Object.assign({ updatedAt: new Date(), language: language || "en", model }, (Array.isArray(docIds) && docIds.length ? { contextDocIds: docIds.slice(0, 8) } : {})), { merge: true });
        }
        const messagesCol = firebase_1.db.collection("chats").doc(chatDocId).collection("messages");
        // Add user's message if not already last
        try {
            const lastSnap = await messagesCol.orderBy("createdAt", "desc").limit(1).get();
            const last = ((_d = lastSnap.docs[0]) === null || _d === void 0 ? void 0 : _d.data()) || undefined;
            const sameContent = last && String(last.content) === String(prompt);
            const isUser = last && last.role === "user";
            if (!(sameContent && isUser)) {
                await messagesCol.add({ role: "user", content: String(prompt), createdAt: new Date() });
            }
        }
        catch (dupeErr) {
            console.warn("User message duplicate check failed", dupeErr);
        }
        // Load last messages for context
        const recentSnap = await messagesCol.orderBy("createdAt", "asc").limit(20).get();
        const convo = recentSnap.docs.map((d) => d.data());
        // Active context documents
        let activeDocIds = [];
        try {
            if (Array.isArray(docIds) && docIds.length) {
                activeDocIds = docIds.slice(0, 8);
            }
            else {
                const chatSnap = await firebase_1.db.collection("chats").doc(chatDocId).get();
                const data = chatSnap.data();
                if (Array.isArray(data === null || data === void 0 ? void 0 : data.contextDocIds))
                    activeDocIds = data.contextDocIds.slice(0, 8);
            }
        }
        catch (e) {
            console.warn("Could not load contextDocIds", e);
        }
        // Optional RAG retrieval using services
        let docsContext = "";
        if (activeDocIds.length) {
            try {
                const embeddingService = new embeddingService_1.EmbeddingService();
                const pineconeService = new pineconeService_1.PineconeService();
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
                            aggregated.push({ docId: dId, title: m.title || dId, chunk: m.chunk, score: m.score });
                            if (seen.size >= perDoc)
                                break;
                        }
                    }
                    catch (inner) {
                        console.warn("RAG doc retrieval failed", { docId: dId, inner });
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
                console.warn("RAG retrieval failed, falling back to no docsContext", ragErr);
            }
        }
        let baseInstruction = "You are a helpful AI assistant. Prefer grounded answers using provided document context blocks when present. If context insufficient, say so and optionally ask for more info. Keep responses concise and clear. Use markdown when helpful.";
        if (webSearch) {
            baseInstruction +=
                "\n\nWeb browsing is permitted via the web_search tool. Use it when the question requires up-to-date or external information. Summarize findings and cite source domains briefly (e.g., example.com).";
        }
        const sysContent = docsContext ? `${baseInstruction}\n\n${docsContext}` : baseInstruction;
        const sysMsg = { role: "system", content: sysContent };
        const chatMessages = [sysMsg, ...convo.map((m) => ({ role: m.role, content: m.content }))];
        // Assistant placeholder
        const assistantRef = await messagesCol.add({ role: "assistant", content: "", createdAt: new Date(), streaming: true });
        let buffered = "";
        let lastUpdate = Date.now();
        const flush = async (final = false) => {
            try {
                await assistantRef.set({ content: buffered, streaming: final ? false : true, updatedAt: new Date() }, { merge: true });
                await firebase_1.db.collection("chats").doc(chatDocId).set({ updatedAt: new Date() }, { merge: true });
            }
            catch (e) {
                console.warn("Failed to flush streaming token to Firestore", e);
            }
        };
        const streamOut = async (fullText) => {
            try {
                const chunkSize = 48;
                const delayMs = 24;
                buffered = "";
                for (let i = 0; i < fullText.length; i += chunkSize) {
                    buffered += fullText.slice(i, i + chunkSize);
                    await flush(false);
                    await new Promise((r) => setTimeout(r, delayMs));
                }
                await flush(true);
            }
            catch (e) {
                console.warn("streamOut failed; falling back to single flush", e);
                buffered = fullText;
                await flush(true);
            }
        };
        try {
            if (webSearch) {
                // Non-streaming Responses API with web_search tool (gpt-4.1)
                const input = chatMessages.map((m) => ({
                    role: m.role,
                    content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: String(m.content || "") }],
                }));
                const resp = await openai.responses.create({ model, input, tools: [{ type: "web_search" }] });
                const fullText = (resp === null || resp === void 0 ? void 0 : resp.output_text) ||
                    ((_h = (_g = (_f = (_e = resp === null || resp === void 0 ? void 0 : resp.output) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.content) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.text) ||
                    ((_m = (_l = (_k = (_j = resp === null || resp === void 0 ? void 0 : resp.data) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.content) === null || _l === void 0 ? void 0 : _l[0]) === null || _m === void 0 ? void 0 : _m.text) ||
                    ((_q = (_p = (_o = resp === null || resp === void 0 ? void 0 : resp.choices) === null || _o === void 0 ? void 0 : _o[0]) === null || _p === void 0 ? void 0 : _p.message) === null || _q === void 0 ? void 0 : _q.content) ||
                    "I'm sorry, I couldn't generate a response.";
                await streamOut(String(fullText));
            }
            else if (thinkMode) {
                const input = chatMessages.map((m) => ({
                    role: m.role,
                    content: [{ type: m.role === "assistant" ? "output_text" : "input_text", text: String(m.content || "") }],
                }));
                const resp = await openai.responses.create({ model, input });
                const fullText = (resp === null || resp === void 0 ? void 0 : resp.output_text) ||
                    ((_u = (_t = (_s = (_r = resp === null || resp === void 0 ? void 0 : resp.output) === null || _r === void 0 ? void 0 : _r[0]) === null || _s === void 0 ? void 0 : _s.content) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.text) ||
                    ((_y = (_x = (_w = (_v = resp === null || resp === void 0 ? void 0 : resp.data) === null || _v === void 0 ? void 0 : _v[0]) === null || _w === void 0 ? void 0 : _w.content) === null || _x === void 0 ? void 0 : _x[0]) === null || _y === void 0 ? void 0 : _y.text) ||
                    ((_1 = (_0 = (_z = resp === null || resp === void 0 ? void 0 : resp.choices) === null || _z === void 0 ? void 0 : _z[0]) === null || _0 === void 0 ? void 0 : _0.message) === null || _1 === void 0 ? void 0 : _1.content) ||
                    "I'm sorry, I couldn't generate a response.";
                await streamOut(String(fullText));
            }
            else {
                const stream = await openai.chat.completions.create({ model, temperature: thinkMode ? 0.2 : 0.7, messages: chatMessages, stream: true });
                try {
                    for (var _8 = true, _9 = __asyncValues(stream), _10; _10 = await _9.next(), _a = _10.done, !_a; _8 = true) {
                        _c = _10.value;
                        _8 = false;
                        const part = _c;
                        const delta = ((_4 = (_3 = (_2 = part === null || part === void 0 ? void 0 : part.choices) === null || _2 === void 0 ? void 0 : _2[0]) === null || _3 === void 0 ? void 0 : _3.delta) === null || _4 === void 0 ? void 0 : _4.content) || "";
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
                        if (!_8 && !_a && (_b = _9.return)) await _b.call(_9);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                await flush(true);
            }
        }
        catch (genErr) {
            console.error("OpenAI generation failed", genErr);
            try {
                const fallbackModel = webSearch || (typeof model === "string" && model.startsWith("o3")) ? "gpt-4o-mini" : model;
                const completion = await openai.chat.completions.create({ model: fallbackModel, temperature: thinkMode ? 0.2 : 0.7, messages: chatMessages });
                buffered = ((_7 = (_6 = (_5 = completion.choices) === null || _5 === void 0 ? void 0 : _5[0]) === null || _6 === void 0 ? void 0 : _6.message) === null || _7 === void 0 ? void 0 : _7.content) || "I'm sorry, I couldn't generate a response.";
                await flush(true);
            }
            catch (fallbackErr) {
                console.error("OpenAI fallback also failed", fallbackErr);
                buffered = "I'm sorry, an error occurred generating the response.";
                await flush(true);
            }
        }
        if (!chatId) {
            const title = prompt.trim().slice(0, 60);
            await firebase_1.db.collection("chats").doc(chatDocId).set({ title: title || "New Chat" }, { merge: true });
        }
        return { success: true, data: { chatId: chatDocId } };
    }
    catch (error) {
        console.error("Error in sendChatMessage:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
});
exports.queryDocuments = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    try {
        const { question, userId, documentId, topK } = request.data;
        if (!question || !userId)
            throw new Error("Missing required parameters: question and userId");
        const queryService = new queryService_1.QueryService();
        const result = await queryService.queryRAG(question, userId, documentId, topK || 5);
        return { success: true, data: result };
    }
    catch (error) {
        console.error("Error in queryDocuments:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
});
//# sourceMappingURL=rag.js.map