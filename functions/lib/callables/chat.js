"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createChat = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../config/firebase");
exports.createChat = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    try {
        const { userId, language, title, contextDocIds } = request.data || {};
        if (!userId)
            throw new Error("Missing required parameter: userId");
        if (request.auth && request.auth.uid && request.auth.uid !== userId) {
            throw new Error("Authenticated user mismatch");
        }
        const chatRef = await firebase_1.db.collection("chats").add({
            userId,
            title: (title || "New Chat").toString().slice(0, 60) || "New Chat",
            language: language || "en",
            model: "gpt-4o-mini",
            contextDocIds: Array.isArray(contextDocIds) ? contextDocIds.slice(0, 8) : [],
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        return { success: true, data: { chatId: chatRef.id } };
    }
    catch (error) {
        console.error("Error in createChat:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
});
//# sourceMappingURL=chat.js.map