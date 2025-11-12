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
  strictDoc?: boolean; // limit retrieval strictly to the single provided document
}

export interface GenerateSummaryParams {
  documentId: string;
  userId: string;
  maxLength?: number;
}

export interface Flashcard {
  front: string;
  back: string;
  category: string;
}

export interface GenerateFlashcardsParams {
  documentId: string;
  userId: string;
  count?: number;
  forceNew?: boolean; // Bypass cache for fresh generation
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
}

export interface GenerateQuizParams {
  documentId: string;
  userId: string;
  count?: number;
  difficulty?: "mixed" | "easy" | "medium" | "hard";
  forceNew?: boolean; // Bypass cache for fresh generation
}

export interface GetDocumentTextParams {
  documentId: string;
  userId: string;
  limitChars?: number;
}

export interface DocumentTextResponse {
  text: string;
  title?: string;
  fileName?: string;
  chunkCount?: number;
  characterCount: number;
  source: "openai-vector" | "firestore";
  truncated: boolean;
}

export interface GeneratePodcastParams {
  documentId: string;
  userId: string;
  voice?: string;
  force?: boolean;
}

export interface PodcastResponse {
  audioUrl: string;
  audioPath: string;
  voice: string;
  model: string;
  summary: string;
}

// Long-answer evaluation API
export interface EvaluateLongAnswerParams {
  userId: string;
  userAnswer: string;
  referenceAnswer: string;
  minLength?: number; // characters threshold to consider sufficient for a long answer
}
export interface EvaluateLongAnswerResult {
  verdict: "correct" | "incorrect" | "insufficient";
  score: number; // 0-100 semantic coverage
  reasoning: string;
  keyPoints?: string[];
  missingPoints?: string[];
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

/** Generate or retrieve podcast audio for a document summary */
export const generatePodcast = async (
  params: GeneratePodcastParams
): Promise<PodcastResponse> => {
  const fn = httpsCallable(functions, "generatePodcast");
  const result = await fn(params);
  const data = result.data as {
    success: boolean;
    data?: PodcastResponse;
    error?: string;
  };
  if (data.success && data.data) return data.data;
  throw new Error(data.error || "Failed to generate podcast");
};

/** Evaluate a long-form user answer against a reference answer (semantic, not keyword-based) */
export const evaluateLongAnswer = async (
  params: EvaluateLongAnswerParams
): Promise<EvaluateLongAnswerResult> => {
  const fn = httpsCallable(functions, "evaluateLongAnswer");
  const result = await fn(params);
  const data = result.data as {
    success: boolean;
    data?: EvaluateLongAnswerResult;
    error?: string;
  };
  if (data.success && data.data) return data.data;
  throw new Error(data.error || "Failed to evaluate answer");
};

/** Fetch full raw text of a document (from transcript/storage or Firestore; OpenAI vector store is used for retrieval in other endpoints) */
export const getDocumentText = async (
  params: GetDocumentTextParams
): Promise<DocumentTextResponse> => {
  const fn = httpsCallable(functions, "getDocumentText");
  try {
    const result = await fn(params);
    const data = result.data as {
      success: boolean;
      data?: DocumentTextResponse;
      error?: string;
    };
    if (data.success && data.data) return data.data;
    throw new Error(data.error || "Failed to fetch document text");
  } catch (e) {
    console.error("Error fetching document text", e);
    throw e;
  }
};

/** Generate flashcards for a document */
export const generateFlashcards = async (
  params: GenerateFlashcardsParams
): Promise<Flashcard[]> => {
  const fn = httpsCallable(functions, "generateFlashcards");
  try {
    const result = await fn(params);
    const data = result.data as {
      success: boolean;
      data?: { flashcards: Flashcard[] };
      error?: string;
    };
    if (data.success && data.data) return data.data.flashcards || [];
    throw new Error(data.error || "Failed to generate flashcards");
  } catch (e) {
    console.error("Error generating flashcards", e);
    throw e;
  }
};

/** Generate quiz questions for a document */
export const generateQuiz = async (
  params: GenerateQuizParams
): Promise<QuizQuestion[]> => {
  const fn = httpsCallable(functions, "generateQuiz");
  try {
    const result = await fn(params);
    const data = result.data as {
      success: boolean;
      data?: { quiz: QuizQuestion[] };
      error?: string;
    };
    if (data.success && data.data) return data.data.quiz || [];
    throw new Error(data.error || "Failed to generate quiz");
  } catch (e) {
    console.error("Error generating quiz", e);
    throw e;
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
  attempts: number = 8,
  initialDelayMs: number = 1600
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
