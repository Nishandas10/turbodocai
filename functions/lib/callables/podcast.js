"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePodcast = void 0;
const https_1 = require("firebase-functions/v2/https");
const openai_1 = __importDefault(require("openai"));
const firebase_1 = require("../config/firebase");
exports.generatePodcast = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    var _a;
    try {
        const { documentId, userId, voice, force } = request.data || {};
        if (!documentId || !userId)
            throw new Error("Missing required parameters: documentId and userId");
        const dbRef = firebase_1.db
            .collection("documents")
            .doc(userId)
            .collection("userDocuments")
            .doc(documentId)
            .collection("aiArtifacts")
            .doc("podcast_v1");
        if (!force) {
            const cache = await dbRef.get();
            if (cache.exists) {
                const data = cache.data();
                const audioPath = data === null || data === void 0 ? void 0 : data.audioPath;
                if (audioPath) {
                    const file = firebase_1.storage.bucket().file(audioPath);
                    const [exists] = await file.exists();
                    if (exists) {
                        let token = data === null || data === void 0 ? void 0 : data.downloadToken;
                        const [meta] = await file.getMetadata();
                        const bucketName = firebase_1.storage.bucket().name;
                        const metaToken = ((_a = meta === null || meta === void 0 ? void 0 : meta.metadata) === null || _a === void 0 ? void 0 : _a.firebaseStorageDownloadTokens) || "";
                        if (!token)
                            token = (metaToken === null || metaToken === void 0 ? void 0 : metaToken.split(",")[0]) || undefined;
                        if (!token) {
                            token = crypto.randomUUID();
                            await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: token } });
                        }
                        const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(audioPath)}?alt=media&token=${token}`;
                        return { success: true, data: { audioUrl: mediaUrl, audioPath, voice: (data === null || data === void 0 ? void 0 : data.voice) || "alloy", model: (data === null || data === void 0 ? void 0 : data.model) || "gpt-4o-mini-tts", summary: (data === null || data === void 0 ? void 0 : data.summary) || "" } };
                    }
                }
            }
        }
        // Fetch or generate a summary (lightweight: let client ensure availability or call separate summary function)
        let summary = "";
        try {
            const docSnap = await firebase_1.db.collection("documents").doc(userId).collection("userDocuments").doc(documentId).get();
            if (docSnap.exists) {
                const data = docSnap.data();
                summary = (data === null || data === void 0 ? void 0 : data.summary) || "";
            }
        }
        catch (_b) { }
        const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
        const ttsModel = "gpt-4o-mini-tts";
        const ttsVoice = typeof voice === "string" && voice.trim() ? voice.trim() : "alloy";
        const ttsInput = (summary || "Here is an auto generated podcast for your document summary.").trim().slice(0, 4000);
        const speech = await openai.audio.speech.create({ model: ttsModel, voice: ttsVoice, input: ttsInput });
        const arrayBuf = await speech.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const audioPath = `podcasts/${userId}/${documentId}/${ttsVoice}.mp3`;
        const file = firebase_1.storage.bucket().file(audioPath);
        await file.save(buffer, { contentType: "audio/mpeg", resumable: false });
        const token = crypto.randomUUID();
        await file.setMetadata({ cacheControl: "public, max-age=3600", metadata: { firebaseStorageDownloadTokens: token }, contentType: "audio/mpeg" });
        const bucketName = firebase_1.storage.bucket().name;
        const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(audioPath)}?alt=media&token=${token}`;
        await dbRef.set({ audioPath, voice: ttsVoice, model: ttsModel, summary: ttsInput, downloadToken: token, updatedAt: new Date() }, { merge: true });
        return { success: true, data: { audioUrl: mediaUrl, audioPath, voice: ttsVoice, model: ttsModel, summary: ttsInput } };
    }
    catch (error) {
        console.error("Error in generatePodcast:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
});
//# sourceMappingURL=podcast.js.map