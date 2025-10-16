"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSummary = void 0;
const https_1 = require("firebase-functions/v2/https");
const queryService_1 = require("../services/queryService");
exports.generateSummary = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    try {
        const { documentId, userId, maxLength } = request.data;
        if (!documentId || !userId)
            throw new Error("Missing required parameters: documentId and userId");
        const queryService = new queryService_1.QueryService();
        const summary = await queryService.generateDocumentSummary(documentId, userId, maxLength || 500);
        return { success: true, data: { summary } };
    }
    catch (error) {
        console.error("Error in generateSummary:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
});
//# sourceMappingURL=summaries.js.map