import { onCall } from "firebase-functions/v2/https";
import { QueryService } from "../services/queryService";

export const generateSummary = onCall(
  { enforceAppCheck: false },
  async (request) => {
    try {
      const { documentId, userId, maxLength } = request.data;
      if (!documentId || !userId)
        throw new Error("Missing required parameters: documentId and userId");
      const queryService = new QueryService();
      const summary = await queryService.generateDocumentSummary(
        documentId,
        userId,
        maxLength || 500
      );
      return { success: true, data: { summary } };
    } catch (error) {
      console.error("Error in generateSummary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);
