import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import {
  DocumentProcessor,
  EmbeddingService,
  PineconeService,
  QueryService,
} from "./services";

// Initialize Firebase Admin
const app = initializeApp();

// Set global options
setGlobalOptions({
  maxInstances: 5,
  concurrency: 1, // Ensure only one execution per instance to cap memory usage
  region: "us-central1",
  memory: "4GiB", // Maximum memory allocation
  timeoutSeconds: 540,
});

const db = getFirestore(app);
const storage = getStorage();

// Initialize services (they will be created when functions are called)
const createServices = () => {
  return {
    documentProcessor: new DocumentProcessor(),
    embeddingService: new EmbeddingService(),
    pineconeService: new PineconeService(),
    queryService: new QueryService(),
  };
};

/**
 * Cloud Function triggered when a document is created or updated in Firestore
 * Processes PDF files through the RAG pipeline:
 * 1. Download file from Storage
 * 2. Extract text using pdf-parse
 * 3. Chunk the text
 * 4. Generate embeddings
 * 5. Store in Pinecone
 */
export const processDocument = onDocumentWritten(
  "documents/{userId}/userDocuments/{documentId}",
  async (event) => {
    const documentData = event.data?.after.data();
    const { userId, documentId } = event.params;

    if (!documentData) {
      logger.error("No document data found");
      return;
    }

    logger.info(`Processing document ${documentId} for user ${userId}`);
    logger.info(`Document data:`, {
      type: documentData.type,
      storagePath: documentData.metadata?.storagePath,
      title: documentData.title,
    });

    try {
      // Initialize services
      const { documentProcessor, embeddingService, pineconeService } =
        createServices();

      // Only process if it's a PDF and has a storage path
      if (documentData.type !== "pdf") {
        logger.info(
          `Skipping processing - not a PDF document, type: ${documentData.type}`
        );
        return;
      }

      if (!documentData.metadata?.storagePath) {
        logger.info(
          `PDF document ${documentId} doesn't have storagePath yet, will process when storage info is updated`
        );
        return;
      }

      // Skip if already processed
      if (
        documentData.processingStatus === "completed" ||
        documentData.processingStatus === "processing"
      ) {
        logger.info(
          `Document ${documentId} already processed or currently processing, skipping`
        );
        return;
      }

      // Update document status to processing
      await db
        .collection("documents")
        .doc(userId)
        .collection("userDocuments")
        .doc(documentId)
        .update({
          processingStatus: "processing",
          processingStartedAt: new Date(),
        });

      // Step 1: Download file from Firebase Storage
      logger.info("Downloading file from storage...");
      const fileBuffer = await downloadFileFromStorage(
        documentData.metadata.storagePath
      );

      // Step 2: Extract text from PDF
      logger.info("Extracting text from PDF...");
      const extractedText = await documentProcessor.extractTextFromPDF(
        fileBuffer
      );

      if (!extractedText || extractedText.length < 10) {
        throw new Error("No meaningful text extracted from PDF");
      }

      // Guard against extremely large documents (hard cap 2.5M chars)
      const MAX_CHARS = 2_500_000;
      let truncated = false;
      let workingText = extractedText;
      if (workingText.length > MAX_CHARS) {
        workingText = workingText.slice(0, MAX_CHARS);
        truncated = true;
        logger.warn(
          `Document text truncated to ${MAX_CHARS} characters to conserve memory`
        );
      }

      // Streaming chunk generation to avoid holding all chunks
      function* generateChunks(text: string, chunkSize = 300, overlap = 20) {
        const words = text.split(/\s+/);
        let start = 0;
        while (start < words.length) {
          const end = Math.min(start + chunkSize, words.length);
          const chunk = words.slice(start, end).join(" ").trim();
          if (chunk) yield chunk;
          start = end - overlap;
          if (start < 0) start = 0;
          if (start >= end) start = end; // safety
        }
      }

      logger.info("Beginning streaming chunk processing...");
      let chunkCount = 0;
      const memLog = () => {
        const mu = process.memoryUsage();
        logger.info("Memory usage", {
          rss: mu.rss,
          heapUsed: mu.heapUsed,
          heapTotal: mu.heapTotal,
          external: mu.external,
        });
      };

      let processedChars = 0;
      const totalChars = workingText.length;
      for (const chunk of generateChunks(workingText, 300, 20)) {
        const i = chunkCount;
        chunkCount++;
        if (chunkCount === 1)
          logger.info("First chunk length", { len: chunk.length });
        if (chunkCount % 25 === 0)
          logger.info(`Processed ${chunkCount} chunks so far`);
        try {
          const embedding = await embeddingService.embedChunks([chunk]);
          await pineconeService.storeEmbeddings(
            [chunk],
            embedding,
            documentId,
            userId,
            {
              title: documentData.title,
              fileName: documentData.metadata?.fileName,
            },
            i
          );
        } catch (chunkError) {
          logger.error(`Error processing chunk ${chunkCount}`, chunkError);
        }
        processedChars += chunk.length;
        // Periodic progress update (every 25 chunks) capped below 100 until completion
        if (chunkCount % 25 === 0) {
          const progressPct = Math.min(
            99,
            Math.round((processedChars / totalChars) * 100)
          );
          try {
            await db
              .collection("documents")
              .doc(userId)
              .collection("userDocuments")
              .doc(documentId)
              .set(
                {
                  processingProgress: progressPct,
                  processingStatus: "processing",
                  chunkCount,
                },
                { merge: true }
              );
          } catch (progressErr) {
            logger.warn("Progress update failed", progressErr);
          }
        }
        if (global.gc) global.gc();
        if (chunkCount % 10 === 0) memLog();
        // Tiny delay to yield event loop & allow GC
        await new Promise((r) => setTimeout(r, 40));
      }

      // Update document with processed content and status
      await db
        .collection("documents")
        .doc(userId)
        .collection("userDocuments")
        .doc(documentId)
        .update({
          "content.raw": workingText.slice(0, 1_000_000),
          "content.processed": `Indexed ${chunkCount} chunks${
            truncated ? " (truncated)" : ""
          }`,
          processingStatus: "completed",
          processingCompletedAt: new Date(),
          chunkCount,
          characterCount: workingText.length,
          truncated,
          processingProgress: 100,
        });

      logger.info(
        `Successfully processed document ${documentId} with ${chunkCount} chunks`
      );
    } catch (error) {
      logger.error(`Error processing document ${documentId}:`, error);

      // Update document status to failed
      await db
        .collection("documents")
        .doc(userId)
        .collection("userDocuments")
        .doc(documentId)
        .update({
          processingStatus: "failed",
          processingError:
            error instanceof Error ? error.message : "Unknown error",
          processingFailedAt: new Date(),
        });
    }
  }
);

/**
 * Download file from Firebase Storage
 */
async function downloadFileFromStorage(storagePath: string): Promise<Buffer> {
  try {
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);

    const [fileBuffer] = await file.download();
    return fileBuffer;
  } catch (error) {
    logger.error("Error downloading file from storage:", error);
    throw new Error("Failed to download file from storage");
  }
}

/**
 * Callable function to query documents using RAG
 */
export const queryDocuments = onCall(
  {
    enforceAppCheck: false, // Set to true in production
  },
  async (request) => {
    try {
      const { question, userId, documentId, topK } = request.data;

      if (!question || !userId) {
        throw new Error("Missing required parameters: question and userId");
      }

      // Initialize services
      const { queryService } = createServices();

      const result = await queryService.queryRAG(
        question,
        userId,
        documentId,
        topK || 5
      );

      return { success: true, data: result };
    } catch (error) {
      logger.error("Error in queryDocuments:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

/**
 * Callable function to generate document summary
 */
export const generateSummary = onCall(
  {
    enforceAppCheck: false, // Set to true in production
  },
  async (request) => {
    try {
      const { documentId, userId, maxLength } = request.data;

      if (!documentId || !userId) {
        throw new Error("Missing required parameters: documentId and userId");
      }

      // Initialize services
      const { queryService } = createServices();

      const summary = await queryService.generateDocumentSummary(
        documentId,
        userId,
        maxLength || 500
      );

      return { success: true, data: { summary } };
    } catch (error) {
      logger.error("Error in generateSummary:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

/**
 * Callable function to generate flashcards for a document
 */
export const generateFlashcards = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      const { documentId, userId, count } = request.data || {};
      if (!documentId || !userId) {
        throw new Error("Missing required parameters: documentId and userId");
      }
      const { queryService } = createServices();
      const cards = await queryService.generateFlashcards(
        documentId,
        userId,
        count || 12
      );
      return { success: true, data: { flashcards: cards } };
    } catch (error) {
      logger.error("Error in generateFlashcards:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);
