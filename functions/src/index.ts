import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { OpenAI } from "openai";
import { randomUUID } from "crypto";
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

/**
 * Callable function to generate quiz questions for a document
 */
export const generateQuiz = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      const { documentId, userId, count, difficulty } = request.data || {};
      if (!documentId || !userId) {
        throw new Error("Missing required parameters: documentId and userId");
      }
      const { queryService } = createServices();
      const questions = await queryService.generateQuiz(
        documentId,
        userId,
        count || 10,
        difficulty || "mixed"
      );
      return { success: true, data: { quiz: questions } };
    } catch (error) {
      logger.error("Error in generateQuiz:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

/**
 * Callable function to fetch full raw document text from Pinecone (ordered by chunk index)
 * Falls back to Firestore stored raw content if vectors are not available.
 */
export const getDocumentText = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      const { documentId, userId, limitChars } = request.data || {};
      if (!documentId || !userId) {
        throw new Error("Missing required parameters: documentId and userId");
      }

      const { pineconeService } = createServices();

      // Try to read document metadata (including chunkCount) from Firestore
      let chunkCount = 0;
      let title: string | undefined;
      let fileName: string | undefined;
      try {
        const snap = await db
          .collection("documents")
          .doc(userId)
          .collection("userDocuments")
          .doc(documentId)
          .get();
        if (snap.exists) {
          const data = snap.data() as any;
          chunkCount = Number(data?.chunkCount || 0);
          title = data?.title;
          fileName = data?.metadata?.fileName;
        }
      } catch {
        /* ignore */
      }

      // If chunkCount unknown, attempt a cheap probe
      if (!chunkCount) {
        try {
          const probe = await pineconeService.querySimilarChunks(
            new Array(1024).fill(0),
            userId,
            50,
            documentId
          );
          const indices = probe
            .map((m) => parseInt(String(m.id).split("_").pop() || "0", 10))
            .filter((n) => !isNaN(n));
          if (indices.length) chunkCount = Math.max(...indices) + 1;
        } catch {
          /* ignore */
        }
      }

      let text = "";
      let source: "pinecone" | "firestore" = "pinecone";
      if (chunkCount > 0) {
        const ordered = await pineconeService.fetchDocumentChunks(
          documentId,
          userId,
          chunkCount
        );
        text = ordered.map((c) => c.chunk).join("\n\n");
      }

      // Fallback to Firestore stored raw content
      if (!text || text.length < 10) {
        source = "firestore";
        try {
          const snap = await db
            .collection("documents")
            .doc(userId)
            .collection("userDocuments")
            .doc(documentId)
            .get();
          if (snap.exists) {
            const data = snap.data() as any;
            title = title || data?.title;
            fileName = fileName || data?.metadata?.fileName;
            text =
              data?.content?.raw ||
              data?.content?.processed ||
              data?.summary ||
              "";
          }
        } catch {
          /* ignore */
        }
      }

      const totalChars = text.length;
      const max =
        Number(limitChars) && Number(limitChars) > 0
          ? Number(limitChars)
          : totalChars;
      const sliced = text.slice(0, max);
      const truncated = sliced.length < totalChars;

      return {
        success: true,
        data: {
          text: sliced,
          title,
          fileName,
          chunkCount: chunkCount || undefined,
          characterCount: totalChars,
          source,
          truncated,
        },
      };
    } catch (error) {
      logger.error("Error in getDocumentText:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

/**
 * Callable function: Generate or fetch podcast audio (MP3) for a document's summary using OpenAI TTS.
 * Caches result under documents/{userId}/userDocuments/{documentId}/aiArtifacts/podcast_v1
 * Stores audio at gs://<bucket>/podcasts/{userId}/{documentId}/{voice or default}.mp3
 */
export const generatePodcast = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      const { documentId, userId, voice, force } = request.data || {};
      if (!documentId || !userId) {
        throw new Error("Missing required parameters: documentId and userId");
      }

      const { queryService } = createServices();
      const dbRef = db
        .collection("documents")
        .doc(userId)
        .collection("userDocuments")
        .doc(documentId)
        .collection("aiArtifacts")
        .doc("podcast_v1");

      // Attempt cache
      if (!force) {
        const cache = await dbRef.get();
        if (cache.exists) {
          const data = cache.data() as any;
          const audioPath: string | undefined = data?.audioPath;
          if (audioPath) {
            const file = storage.bucket().file(audioPath);
            const [exists] = await file.exists();
            if (exists) {
              // Build Firebase download token URL
              let token: string | undefined = data?.downloadToken;
              const [meta] = await file.getMetadata();
              const bucketName = storage.bucket().name;
              const metaToken =
                (meta?.metadata?.firebaseStorageDownloadTokens as string) || "";
              if (!token) {
                token = metaToken?.split(",")[0] || undefined;
              }
              if (!token) {
                token = randomUUID();
                await file.setMetadata({
                  metadata: { firebaseStorageDownloadTokens: token },
                });
              }
              const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
                audioPath
              )}?alt=media&token=${token}`;
              return {
                success: true,
                data: {
                  audioUrl: mediaUrl,
                  audioPath,
                  voice: data?.voice || "alloy",
                  model: data?.model || "gpt-4o-mini-tts",
                  summary: data?.summary || "",
                },
              };
            }
          }
        }
      }

      // Fetch summary: prefer stored summary, else generate
      let summary = "";
      try {
        const docSnap = await db
          .collection("documents")
          .doc(userId)
          .collection("userDocuments")
          .doc(documentId)
          .get();
        if (docSnap.exists) {
          const data = docSnap.data() as any;
          summary = (data?.summary as string) || "";
        }
      } catch {
        /* ignore */
      }
      if (!summary || summary.trim().length < 40) {
        summary = await queryService.generateDocumentSummary(
          documentId,
          userId,
          500
        );
      }
      // Limit input length for TTS to keep under model limits
      const ttsInput = summary.trim().slice(0, 4000);

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const ttsModel = "gpt-4o-mini-tts"; // compact, good quality
      const ttsVoice =
        typeof voice === "string" && voice.trim() ? voice.trim() : "alloy";

      // Create speech audio (mp3)
      const speech = await openai.audio.speech.create({
        model: ttsModel,
        voice: ttsVoice as any,
        input: ttsInput,
      });
      const arrayBuf = await speech.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      // Save to Storage
      const audioPath = `podcasts/${userId}/${documentId}/${ttsVoice}.mp3`;
      const file = storage.bucket().file(audioPath);
      await file.save(buffer, { contentType: "audio/mpeg", resumable: false });
      // Set cache control and Firebase download token for public access via URL
      const token = randomUUID();
      await file.setMetadata({
        cacheControl: "public, max-age=3600",
        metadata: { firebaseStorageDownloadTokens: token },
        contentType: "audio/mpeg",
      });
      const bucketName = storage.bucket().name;
      const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
        audioPath
      )}?alt=media&token=${token}`;

      // Cache metadata
      await dbRef.set(
        {
          audioPath,
          voice: ttsVoice,
          model: ttsModel,
          summary: ttsInput,
          downloadToken: token,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      return {
        success: true,
        data: {
          audioUrl: mediaUrl,
          audioPath,
          voice: ttsVoice,
          model: ttsModel,
          summary: ttsInput,
        },
      };
    } catch (error) {
      logger.error("Error in generatePodcast:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);
