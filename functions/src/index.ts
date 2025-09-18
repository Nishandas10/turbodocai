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

// Secrets: OpenAI API key is accessed via process.env.OPENAI_API_KEY (same as other functions)

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
 * Lightweight callable to create a chat and return chatId immediately.
 * Data: { userId: string, language?: string, title?: string }
 * Returns: { success, data: { chatId } }
 */
export const createChat = onCall(
  { enforceAppCheck: false },
  async (request) => {
    try {
      const { userId, language, title, contextDocIds } = request.data || {};
      if (!userId) throw new Error("Missing required parameter: userId");
      if (request.auth && request.auth.uid && request.auth.uid !== userId) {
        throw new Error("Authenticated user mismatch");
      }

      const chatRef = await db.collection("chats").add({
        userId,
        title: (title || "New Chat").toString().slice(0, 60) || "New Chat",
        language: language || "en",
        model: "gpt-4o-mini",
        contextDocIds: Array.isArray(contextDocIds)
          ? contextDocIds.slice(0, 8)
          : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { success: true, data: { chatId: chatRef.id } };
    } catch (error) {
      logger.error("Error in createChat:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

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
    const afterSnap = event.data?.after;
    const beforeSnap = event.data?.before;
    const documentData = afterSnap?.data();
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
      // Run only on create or when storagePath first appears/changes
      const beforeData = beforeSnap?.exists ? beforeSnap.data() : undefined;
      const created = !beforeSnap?.exists && !!afterSnap?.exists;
      const storagePathAdded =
        !!documentData?.metadata?.storagePath &&
        (!beforeData?.metadata?.storagePath ||
          beforeData?.metadata?.storagePath !==
            documentData?.metadata?.storagePath);

      if (!created && !storagePathAdded) {
        logger.info("Skipping event: not a create or storagePath change", {
          created,
          storagePathAdded,
        });
        return;
      }

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

      // Acquire processing lock via transaction to avoid duplicate runs
      const docRef = db
        .collection("documents")
        .doc(userId)
        .collection("userDocuments")
        .doc(documentId);
      const acquired = await db.runTransaction(async (tx) => {
        const snap = await tx.get(docRef);
        const data = (snap.data() as any) || {};
        if (
          data.processingStatus === "processing" ||
          data.processingStatus === "completed"
        ) {
          return false; // someone else is processing or it's done
        }
        tx.update(docRef, {
          processingStatus: "processing",
          processingStartedAt: new Date(),
          processingLock: {
            event: (event as any)?.id || randomUUID(),
            at: new Date(),
          },
        });
        return true;
      });

      if (!acquired) {
        logger.info("Processing lock not acquired; exiting");
        return;
      }

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
          processingLock: null,
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
          processingLock: null,
        });
    }
  }
);

/**
 * Callable function to create/continue a chat and generate an assistant reply.
 * Data: { userId: string, prompt: string, language?: string, chatId?: string }
 * Returns: { success, data: { chatId, answer } }
 */
export const sendChatMessage = onCall(
  {
    enforceAppCheck: false,
  },
  async (request) => {
    try {
      const { userId, prompt, language, chatId, docIds } = request.data || {};

      if (!userId || !prompt || typeof prompt !== "string") {
        throw new Error("Missing required parameters: userId and prompt");
      }

      // Optional: basic auth consistency check if available
      if (request.auth && request.auth.uid && request.auth.uid !== userId) {
        throw new Error("Authenticated user mismatch");
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      // Create or fetch chat document
      let chatDocId: string = chatId;
      if (!chatDocId) {
        const title = (prompt as string).trim().slice(0, 60);
        const chatRef = await db.collection("chats").add({
          userId,
          title: title || "New Chat",
          language: language || "en",
          model: "gpt-4o-mini",
          contextDocIds: Array.isArray(docIds) ? docIds.slice(0, 8) : [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        chatDocId = chatRef.id;
      } else {
        // Touch updatedAt if continuing
        await db
          .collection("chats")
          .doc(chatDocId)
          .set(
            {
              updatedAt: new Date(),
              language: language || "en",
              ...(Array.isArray(docIds) && docIds.length
                ? { contextDocIds: docIds.slice(0, 8) }
                : {}),
            },
            { merge: true }
          );
      }

      const messagesCol = db
        .collection("chats")
        .doc(chatDocId)
        .collection("messages");

      // Add user's message if client hasn't just added it
      try {
        const lastSnap = await messagesCol
          .orderBy("createdAt", "desc")
          .limit(1)
          .get();
        const last = lastSnap.docs[0]?.data() as any | undefined;
        const sameContent = last && String(last.content) === String(prompt);
        const isUser = last && last.role === "user";
        if (!(sameContent && isUser)) {
          await messagesCol.add({
            role: "user",
            content: String(prompt),
            createdAt: new Date(),
          });
        }
      } catch (dupeErr) {
        logger.warn("User message duplicate check failed", dupeErr);
      }

      // Build the conversation context (last N messages)
      // For simplicity, fetch up to last 20 messages
      const recentSnap = await messagesCol
        .orderBy("createdAt", "asc")
        .limit(20)
        .get();
      const convo = recentSnap.docs.map((d) => d.data() as any);

      // Determine active context document IDs (persisted or new)
      let activeDocIds: string[] = [];
      try {
        if (Array.isArray(docIds) && docIds.length) {
          activeDocIds = docIds.slice(0, 8);
        } else {
          const chatSnap = await db.collection("chats").doc(chatDocId).get();
          const data = chatSnap.data() as any;
          if (Array.isArray(data?.contextDocIds)) {
            activeDocIds = data.contextDocIds.slice(0, 8);
          }
        }
      } catch (e) {
        logger.warn("Could not load contextDocIds", e);
      }

      // RAG retrieval: for each active doc, retrieve top relevant chunks based on prompt embedding
      let docsContext = "";
      if (activeDocIds.length) {
        try {
          const { embeddingService, pineconeService } = createServices();
          // Embed the current user prompt
          const queryEmbedding = await embeddingService.embedQuery(
            String(prompt)
          );
          const perDoc = 3; // top chunks per document
          const aggregated: Array<{
            docId: string;
            title: string;
            chunk: string;
            score: number;
          }> = [];
          for (const dId of activeDocIds) {
            try {
              const matches = await pineconeService.querySimilarChunks(
                queryEmbedding,
                userId,
                perDoc * 2, // over-fetch then filter
                dId
              );
              // Deduplicate by chunkIndex (encoded in id suffix) and take top perDoc
              const seen = new Set<string>();
              for (const m of matches) {
                const idx = m.id.split("_").pop() || m.id;
                if (seen.has(idx)) continue;
                seen.add(idx);
                aggregated.push({
                  docId: dId,
                  title: m.title || dId,
                  chunk: m.chunk,
                  score: m.score,
                });
                if (seen.size >= perDoc) break;
              }
            } catch (inner) {
              logger.warn("RAG doc retrieval failed", { docId: dId, inner });
            }
          }
          // Sort aggregated by score desc and cap total context length
          aggregated.sort((a, b) => b.score - a.score);
          const MAX_CONTEXT_CHARS = 12000;
          const pieces: string[] = [];
          let used = 0;
          for (const a of aggregated) {
            const clean = a.chunk.replace(/\s+/g, " ").trim();
            if (!clean) continue;
            const snippet = clean.slice(0, 1000);
            const block = `DOC ${a.docId} | ${a.title}\n${snippet}`;
            if (used + block.length > MAX_CONTEXT_CHARS) break;
            pieces.push(block);
            used += block.length;
          }
          if (pieces.length) {
            docsContext = `Retrieved document context (do not fabricate beyond this unless using general knowledge cautiously):\n\n${pieces.join(
              "\n\n---\n\n"
            )}`;
          }
        } catch (ragErr) {
          logger.warn(
            "RAG retrieval failed, falling back to no docsContext",
            ragErr
          );
        }
      }

      const baseInstruction =
        "You are a helpful AI assistant. Prefer grounded answers using provided document context blocks when present. If context insufficient, say so and optionally ask for more info. Keep responses concise and clear. Use markdown when helpful.";
      const sysContent = docsContext
        ? `${baseInstruction}\n\n${docsContext}`
        : baseInstruction;
      const sysMsg = { role: "system" as const, content: sysContent };
      const chatMessages = [
        sysMsg,
        ...convo.map((m) => ({ role: m.role, content: m.content })),
      ];

      // Create assistant message placeholder and stream updates
      const assistantRef = await messagesCol.add({
        role: "assistant",
        content: "",
        createdAt: new Date(),
        streaming: true,
      });

      let buffered = "";
      let lastUpdate = Date.now();

      const flush = async (final = false) => {
        try {
          await assistantRef.set(
            {
              content: buffered,
              streaming: final ? false : true,
              updatedAt: new Date(),
            },
            { merge: true }
          );
          await db
            .collection("chats")
            .doc(chatDocId)
            .set({ updatedAt: new Date() }, { merge: true });
        } catch (e) {
          logger.warn("Failed to flush streaming token to Firestore", e);
        }
      };

      try {
        const stream = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.7,
          messages: chatMessages as any,
          stream: true,
        } as any);

        for await (const part of stream as any) {
          const delta = part?.choices?.[0]?.delta?.content || "";
          if (delta) buffered += delta;
          const now = Date.now();
          if (now - lastUpdate > 250) {
            await flush(false);
            lastUpdate = now;
          }
        }
        await flush(true);
      } catch (streamErr) {
        logger.error(
          "OpenAI streaming failed; falling back to non-streaming",
          streamErr
        );
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            messages: chatMessages as any,
          });
          buffered =
            completion.choices?.[0]?.message?.content ||
            "I'm sorry, I couldn't generate a response.";
          await flush(true);
        } catch (fallbackErr) {
          logger.error("OpenAI non-streaming also failed", fallbackErr);
          buffered = "I'm sorry, an error occurred generating the response.";
          await flush(true);
        }
      }

      // Update chat title from first prompt if new
      if (!chatId) {
        const title = (prompt as string).trim().slice(0, 60);
        await db
          .collection("chats")
          .doc(chatDocId)
          .set({ title: title || "New Chat" }, { merge: true });
      }

      return { success: true, data: { chatId: chatDocId } };
    } catch (error) {
      logger.error("Error in sendChatMessage:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
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

// Mind map generation trigger: when a new mind map doc is created with status 'generating'
export const generateMindMap = onDocumentWritten(
  "mindmaps/{mindMapId}",
  async (event) => {
    try {
      const after = event.data?.after?.data() as any;
      const before = event.data?.before?.data() as any | undefined;
      const mindMapId = event.params.mindMapId;
      if (!after) return; // deleted
      if (before && before.structure && before.status === "ready") return; // already processed
      if (after.status !== "generating") return; // only process generating state
      const { prompt, language, userId, mode } = after;
      if (!prompt || !userId) return;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const system = `You create hierarchical JSON mind map structures. Return STRICT JSON only in this shape: {"root": {"title": string, "children": [{"title": string, "children": [...] }]}}. Depth max 6, each node max 6 words. No extraneous fields.`;
      const userPrompt = `Prompt: ${prompt}\nLanguage: ${
        language || "English"
      }\nMode: ${mode}`;
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 800,
        response_format: { type: "json_object" },
      });
      let structure: any = null;
      try {
        const raw = completion.choices[0].message.content || "{}";
        structure = JSON.parse(raw);
      } catch (e) {
        structure = {
          root: { title: after.title || "Mind Map", children: [] },
        };
      }
      await db.collection("mindmaps").doc(mindMapId).set(
        {
          structure,
          status: "ready",
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } catch (err) {
      logger.error("Mind map generation failed", err);
      const mindMapId = event.params.mindMapId;
      await db
        .collection("mindmaps")
        .doc(mindMapId)
        .set(
          {
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
            updatedAt: new Date(),
          },
          { merge: true }
        );
    }
  }
);
