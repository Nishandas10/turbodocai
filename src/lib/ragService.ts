import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { doc, onSnapshot, getDoc } from "firebase/firestore";
import { updateDocumentSummary } from "./firestore";
import { db } from "./firebase";

export interface QueryResult {
  answer: string;
  sources: Array<{
    documentId: string;
    title: string;
    fileName?: string;
    chunk: string;
    score: number;
  }>;
  confidence: number;
}

export interface QueryDocumentsParams {
  question: string;
  userId: string;
  documentId?: string;
  topK?: number;
}

export interface GenerateSummaryParams {
  documentId: string;
  userId: string;
  maxLength?: number;
}

/**
 * Query documents using the RAG system
 */
export const queryDocuments = async (
  params: QueryDocumentsParams
): Promise<QueryResult> => {
  const queryDocumentsFunction = httpsCallable(functions, "queryDocuments");

  try {
    const result = await queryDocumentsFunction(params);
    const data = result.data as {
      success: boolean;
      data?: QueryResult;
      error?: string;
    };

    if (data.success && data.data) {
      return data.data;
    } else {
      throw new Error(data.error || "Failed to query documents");
    }
  } catch (error) {
    console.error("Error querying documents:", error);
    throw error;
  }
};

/**
 * Generate a summary for a document
 */
export const generateDocumentSummary = async (
  params: GenerateSummaryParams
): Promise<string> => {
  const generateSummaryFunction = httpsCallable(functions, "generateSummary");

  try {
    const result = await generateSummaryFunction(params);
    const data = result.data as {
      success: boolean;
      data?: { summary: string };
      error?: string;
    };

    if (data.success && data.data) {
      return data.data.summary;
    } else {
      throw new Error(data.error || "Failed to generate summary");
    }
  } catch (error) {
    console.error("Error generating summary:", error);
    throw error;
  }
};

/**
 * Check document processing status
 */
export const checkProcessingStatus = async (
  documentId: string,
  userId: string
): Promise<{
  status: "pending" | "processing" | "completed" | "failed" | "ready";
  error?: string;
  progress?: number;
}> => {
  const ref = doc(db, "documents", userId, "userDocuments", documentId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { status: "failed", error: "not_found" };
  interface DocData {
    processingStatus?: string;
    status?: string;
    processingProgress?: number;
    error?: string;
  }
  const data = snap.data() as DocData;
  // Map legacy field names if any
  const status = (data.processingStatus || data.status || "pending") as
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "ready";
  const progress = data.processingProgress || undefined;
  return { status, progress };
};

/**
 * Wait for document processing to complete
 */
export const waitForProcessing = async (
  documentId: string,
  userId: string,
  onProgress?: (status: string, progress?: number) => void
): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const ref = doc(db, "documents", userId, "userDocuments", documentId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          unsub();
          reject(new Error("Document deleted"));
          return;
        }
        interface DocData {
          processingStatus?: string;
          status?: string;
          processingProgress?: number;
          error?: string;
        }
        const data = snap.data() as DocData;
        const status = (data.processingStatus || data.status || "pending") as
          | "pending"
          | "processing"
          | "completed"
          | "failed"
          | "ready";
        const progress = data.processingProgress;
        onProgress?.(status, progress);
        if (status === "completed" || status === "ready") {
          unsub();
          resolve(true);
        } else if (status === "failed") {
          unsub();
          reject(new Error(data.error || "Processing failed"));
        }
      },
      (err) => {
        unsub();
        reject(err);
      }
    );
  });
};

/** Helper to wait then fetch summary automatically */
export const waitAndGenerateSummary = async (
  documentId: string,
  userId: string,
  onProgress?: (status: string, progress?: number) => void,
  maxLength: number = 350
): Promise<string> => {
  await waitForProcessing(documentId, userId, onProgress);
  return generateDocumentSummaryWithRetry(documentId, userId, maxLength);
};

export const generateDocumentSummaryWithRetry = async (
  documentId: string,
  userId: string,
  maxLength: number = 350,
  attempts: number = 5,
  initialDelayMs: number = 800
): Promise<string> => {
  let delay = initialDelayMs;
  let last = "";
  for (let i = 0; i < attempts; i++) {
    try {
      last = await generateDocumentSummary({ documentId, userId, maxLength });
      const placeholder =
        /No content available for summary|Could not generate summary/i.test(
          last
        );
      const tooShort = last.trim().length < 40;
      if (!placeholder && !tooShort) {
        try {
          await updateDocumentSummary(documentId, userId, last);
        } catch (e) {
          console.warn("Persist summary failed:", e);
        }
        return last;
      }
    } catch {
      /* ignore and retry */
    }
    if (i < attempts - 1) {
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 1.6, 4000);
    }
  }
  return last; // may still be placeholder; not persisted
};
