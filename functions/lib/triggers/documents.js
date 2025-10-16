"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDocument = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firebase_1 = require("../config/firebase");
const documentProcessor_1 = require("../services/documentProcessor");
const embeddingService_1 = require("../services/embeddingService");
const pineconeService_1 = require("../services/pineconeService");
exports.processDocument = (0, firestore_1.onDocumentWritten)("documents/{userId}/userDocuments/{documentId}", async (event) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const afterSnap = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after;
    const beforeSnap = (_b = event.data) === null || _b === void 0 ? void 0 : _b.before;
    const documentData = afterSnap === null || afterSnap === void 0 ? void 0 : afterSnap.data();
    const { userId, documentId } = event.params;
    if (!documentData)
        return;
    try {
        const beforeData = (beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.exists) ? beforeSnap.data() : undefined;
        const created = !(beforeSnap === null || beforeSnap === void 0 ? void 0 : beforeSnap.exists) && !!(afterSnap === null || afterSnap === void 0 ? void 0 : afterSnap.exists);
        const storagePathAdded = !!((_c = documentData === null || documentData === void 0 ? void 0 : documentData.metadata) === null || _c === void 0 ? void 0 : _c.storagePath) && (!((_d = beforeData === null || beforeData === void 0 ? void 0 : beforeData.metadata) === null || _d === void 0 ? void 0 : _d.storagePath) || ((_e = beforeData === null || beforeData === void 0 ? void 0 : beforeData.metadata) === null || _e === void 0 ? void 0 : _e.storagePath) !== ((_f = documentData === null || documentData === void 0 ? void 0 : documentData.metadata) === null || _f === void 0 ? void 0 : _f.storagePath));
        if (!created && !storagePathAdded)
            return;
        const documentProcessor = new documentProcessor_1.DocumentProcessor();
        const embeddingService = new embeddingService_1.EmbeddingService();
        const pineconeService = new pineconeService_1.PineconeService();
        if (documentData.type !== "pdf")
            return;
        if (!((_g = documentData.metadata) === null || _g === void 0 ? void 0 : _g.storagePath))
            return;
        if (documentData.processingStatus === "completed" || documentData.processingStatus === "processing")
            return;
        const docRef = firebase_1.db.collection("documents").doc(userId).collection("userDocuments").doc(documentId);
        const acquired = await firebase_1.db.runTransaction(async (tx) => {
            const snap = await tx.get(docRef);
            const data = snap.data() || {};
            if (data.processingStatus === "processing" || data.processingStatus === "completed")
                return false;
            tx.update(docRef, { processingStatus: "processing", processingStartedAt: new Date(), processingLock: { event: (event === null || event === void 0 ? void 0 : event.id) || crypto.randomUUID(), at: new Date() } });
            return true;
        });
        if (!acquired)
            return;
        const fileBuffer = await downloadFileFromStorage(documentData.metadata.storagePath);
        const extractedText = await documentProcessor.extractTextFromPDF(fileBuffer);
        if (!extractedText || extractedText.length < 10)
            throw new Error("No meaningful text extracted from PDF");
        const MAX_CHARS = 2500000;
        let truncated = false;
        let workingText = extractedText;
        if (workingText.length > MAX_CHARS) {
            workingText = workingText.slice(0, MAX_CHARS);
            truncated = true;
        }
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
                    start = end;
            }
        }
        let chunkCount = 0;
        let processedChars = 0;
        const totalChars = workingText.length;
        for (const chunk of generateChunks(workingText, 300, 20)) {
            const i = chunkCount;
            chunkCount++;
            try {
                const embedding = await embeddingService.embedChunks([chunk]);
                await pineconeService.storeEmbeddings([chunk], embedding, documentId, userId, { title: documentData.title, fileName: (_h = documentData.metadata) === null || _h === void 0 ? void 0 : _h.fileName }, i);
            }
            catch (chunkError) {
                console.error(`Error processing chunk ${chunkCount}`, chunkError);
            }
            processedChars += chunk.length;
            if (chunkCount % 25 === 0) {
                const progressPct = Math.min(99, Math.round((processedChars / totalChars) * 100));
                try {
                    await docRef.set({ processingProgress: progressPct, processingStatus: "processing", chunkCount }, { merge: true });
                }
                catch (_j) { }
            }
            if (chunkCount % 10 === 0 && global.gc)
                global.gc();
            await new Promise((r) => setTimeout(r, 40));
        }
        await docRef.update({
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
    }
    catch (error) {
        console.error(`Error processing document ${event.params.documentId}:`, error);
        await firebase_1.db
            .collection("documents")
            .doc(event.params.userId)
            .collection("userDocuments")
            .doc(event.params.documentId)
            .update({ processingStatus: "failed", processingError: error instanceof Error ? error.message : "Unknown error", processingFailedAt: new Date(), processingLock: null });
    }
});
async function downloadFileFromStorage(storagePath) {
    const bucket = firebase_1.storage.bucket();
    const file = bucket.file(storagePath);
    const [fileBuffer] = await file.download();
    return fileBuffer;
}
//# sourceMappingURL=documents.js.map