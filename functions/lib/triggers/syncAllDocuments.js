"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncAllDocuments = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_1 = require("../config/firebase");
const embeddingService_1 = require("../services/embeddingService");
const topics_1 = require("../utils/topics");
const similarity_1 = require("../utils/similarity");
const text_1 = require("../utils/text");
let cachedTopicEmbeddings = null;
async function getTopicEmbeddings(embeddingService) {
    if (cachedTopicEmbeddings)
        return cachedTopicEmbeddings;
    try {
        const inputs = topics_1.TOPICS.map((t) => `${t}: ${topics_1.TOPIC_DESCRIPTIONS[t] || t}`);
        const vectors = await embeddingService.embedChunks(inputs);
        cachedTopicEmbeddings = { labels: topics_1.TOPICS.slice(), vectors };
        return cachedTopicEmbeddings;
    }
    catch (err) {
        console.warn("Failed to precompute topic embeddings; classification disabled", err);
        cachedTopicEmbeddings = { labels: topics_1.TOPICS.slice(), vectors: [] };
        return cachedTopicEmbeddings;
    }
}
async function classifyTopics(data, embeddingService) {
    try {
        const text = (0, text_1.selectDocTextForClassification)(data);
        if (!text || text.length < 10)
            return [];
        const topicEmb = await getTopicEmbeddings(embeddingService);
        if (!topicEmb.vectors.length)
            return [];
        const docVec = await embeddingService.embedQuery(text);
        const scores = topicEmb.vectors.map((v, i) => ({ label: topicEmb.labels[i], score: (0, similarity_1.cosineSim)(docVec, v) }));
        scores.sort((a, b) => b.score - a.score);
        const threshold = 0.25;
        const top = scores.filter((s) => s.score >= threshold).slice(0, 3);
        if (top.length)
            return top.map((t) => t.label);
        return scores.slice(0, 1).map((s) => s.label);
    }
    catch (err) {
        console.warn("Topic classification failed", err);
        return [];
    }
}
exports.syncAllDocuments = (0, firestore_1.onDocumentWritten)("documents/{userId}/userDocuments/{documentId}", async (event) => {
    var _a, _b, _c, _d, _e;
    const beforeSnap = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before;
    const afterSnap = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after;
    const { userId, documentId } = event.params;
    const mirrorId = `${userId}_${documentId}`;
    const allRef = firebase_1.db.collection("allDocuments").doc(mirrorId);
    if (!(afterSnap === null || afterSnap === void 0 ? void 0 : afterSnap.exists) && (beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.exists)) {
        try {
            await allRef.delete();
        }
        catch (_f) { }
        return;
    }
    if (!(beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.exists) && (afterSnap === null || afterSnap === void 0 ? void 0 : afterSnap.exists)) {
        const data = afterSnap.data() || undefined;
        if (!data)
            return;
        try {
            const embeddingService = new embeddingService_1.EmbeddingService();
            const topics = await classifyTopics(data, embeddingService);
            let keywordEmbedding = undefined;
            try {
                const text = (0, text_1.selectDocTextForClassification)(data);
                if (text && text.length > 10) {
                    keywordEmbedding = await embeddingService.embedQuery(text);
                }
            }
            catch (_g) { }
            const payload = Object.assign(Object.assign(Object.assign(Object.assign({}, data), { tags: (0, text_1.mergeTags)(data.tags, topics) }), (keywordEmbedding ? { keywordEmbedding } : {})), { updatedAt: new Date() });
            await allRef.set(payload, { merge: false });
        }
        catch (err) {
            console.error("Failed to create mirror doc in allDocuments", { mirrorId, err });
        }
        return;
    }
    if ((beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.exists) && (afterSnap === null || afterSnap === void 0 ? void 0 : afterSnap.exists)) {
        const before = beforeSnap.data() || {};
        const after = afterSnap.data() || {};
        const beforePublic = !!before.isPublic;
        const afterPublic = !!after.isPublic;
        const processingCompletedNow = before.processingStatus !== "completed" && after.processingStatus === "completed";
        const titleChanged = String(before.title || "") !== String(after.title || "");
        const summaryChanged = String(before.summary || "") !== String(after.summary || "");
        const contentRawChanged = String(((_c = before.content) === null || _c === void 0 ? void 0 : _c.raw) || "") !== String(((_d = after.content) === null || _d === void 0 ? void 0 : _d.raw) || "");
        const shouldReclassify = processingCompletedNow || titleChanged || summaryChanged || contentRawChanged;
        if (!shouldReclassify && beforePublic === afterPublic)
            return;
        try {
            const mirrorSnap = await allRef.get();
            const mirrorExists = mirrorSnap.exists;
            let payload = { updatedAt: new Date() };
            if (beforePublic !== afterPublic)
                payload.isPublic = afterPublic;
            if (shouldReclassify) {
                try {
                    const embeddingService = new embeddingService_1.EmbeddingService();
                    const topics = await classifyTopics(after, embeddingService);
                    payload.tags = (0, text_1.mergeTags)(mirrorExists ? (_e = mirrorSnap.data()) === null || _e === void 0 ? void 0 : _e.tags : after.tags, topics);
                    try {
                        const text = (0, text_1.selectDocTextForClassification)(after);
                        if (text && text.length > 10) {
                            payload.keywordEmbedding = await embeddingService.embedQuery(text);
                        }
                    }
                    catch (_h) { }
                }
                catch (_j) { }
            }
            if (!mirrorExists)
                await allRef.set(Object.assign(Object.assign({}, after), payload), { merge: false });
            else if (Object.keys(payload).length > 0)
                await allRef.set(payload, { merge: true });
        }
        catch (err) {
            console.error("Failed to update mirror in allDocuments", { mirrorId, err });
        }
    }
});
//# sourceMappingURL=syncAllDocuments.js.map