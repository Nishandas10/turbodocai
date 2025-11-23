import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { OpenAI, toFile } from "openai";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "crypto";
import { spawn } from "node:child_process";
import {
  DocumentProcessor,
  EmbeddingService,
  QueryService,
  OpenAIVectorStoreService,
  TranslationService,
  OCRService,
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

/**
 * Transcribe an audio buffer using OpenAI using only gpt-4o-mini-transcribe.
 * If the audio duration is >= 1400 seconds OR the raw size exceeds ~24MB, the audio
 * is chunked via ffmpeg and each segment is transcribed sequentially. This removes
 * the previous whisper-1 fallback to avoid long delay switching models.
 */
async function transcribeAudioBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType?: string,
  onProgress?: (p: number) => void | Promise<void>
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
  const openai = new OpenAI({ apiKey });
  const MAX_BYTES = 24 * 1024 * 1024; // keep under server limit (~25MB)
  const MAX_DIRECT_DURATION_SEC = 1400; // >= 1400s triggers chunking

  // Probe duration using ffmpeg. Returns seconds or null if probe fails.
  const getAudioDurationSeconds = async (
    buf: Buffer,
    nameHint: string
  ): Promise<number | null> => {
    let tmpDir: string | null = null;
    try {
      tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "probe-"));
      const inPath = path.join(
        tmpDir,
        nameHint || `probe_${randomUUID()}`.replace(/[^a-zA-Z0-9_.-]/g, "")
      );
      await fsp.writeFile(inPath, buf);
      // Ensure ffmpeg path set (ffprobe often not bundled; we parse ffmpeg output)
      try {
        if (ffmpegStatic) (ffmpeg as any).setFfmpegPath(ffmpegStatic as string);
      } catch {
        /* ignore */
      }
      // Run ffmpeg -i <file> (no output encode) to get stderr with Duration line
      const args = ["-hide_banner", "-i", inPath, "-f", "null", "-"];
      const ff = spawn(ffmpegStatic as string, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stderr = "";
      ff.stderr.on("data", (d) => (stderr += d.toString()));
      await new Promise<void>((resolve) => ff.on("close", () => resolve()));
      const m = stderr.match(/Duration:\s+(\d+):(\d+):(\d+\.\d+)/);
      if (!m) return null;
      const [_, hh, mm, ss] = m;
      const seconds =
        parseInt(hh, 10) * 3600 + parseInt(mm, 10) * 60 + parseFloat(ss);
      if (!Number.isFinite(seconds)) return null;
      return seconds;
    } catch {
      return null;
    } finally {
      if (tmpDir) {
        try {
          await fsp.rm(tmpDir, { recursive: true, force: true });
        } catch {
          /* ignore */
        }
      }
    }
  };

  // Helper to transcribe a single small buffer (<= limit) with simple retry
  const transcribeSmall = async (buf: Buffer, name: string, mt?: string) => {
    const file = await toFile(buf, name || "audio.webm", {
      type: mt || "audio/webm",
    });
    const MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const res: any = await (openai as any).audio.transcriptions.create({
          file,
          model: "gpt-4o-mini-transcribe",
        });
        const text = String((res?.text as string) || "").trim();
        if (text) return text;
        throw new Error("Empty transcription text");
      } catch (err) {
        logger.warn(
          `gpt-4o-mini-transcribe attempt ${attempt} failed`,
          err as any
        );
        if (attempt === MAX_ATTEMPTS) {
          throw new Error("Audio transcription failed after retries");
        }
        // brief jitter (non-blocking setTimeout wrapped in promise)
        await new Promise((r) => setTimeout(r, 500 + attempt * 250));
      }
    }
    throw new Error("Unreachable");
  };

  // Decide if we need chunking based on size OR probed duration
  let needsChunking = buffer.byteLength > MAX_BYTES;
  let durationSec: number | null = null;
  if (!needsChunking) {
    durationSec = await getAudioDurationSeconds(buffer, fileName);
    if (durationSec && durationSec >= MAX_DIRECT_DURATION_SEC) {
      needsChunking = true;
      logger.info("Duration exceeds threshold; using chunked transcription", {
        durationSec,
      });
    }
  } else {
    logger.info("Size exceeds threshold; using chunked transcription", {
      bytes: buffer.byteLength,
    });
  }

  // If direct path allowed
  if (!needsChunking) {
    return transcribeSmall(buffer, fileName, mimeType);
  }

  // Chunk with ffmpeg and transcribe sequentially
  // Ensure ffmpeg binary path set
  try {
    if (ffmpegStatic) (ffmpeg as any).setFfmpegPath(ffmpegStatic as string);
  } catch (e) {
    logger.warn("Failed to set ffmpeg path; proceeding with default PATH", e);
  }

  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "audio-chunks-"));
  const inPath = path.join(tmpDir, fileName || `input_${randomUUID()}`);
  const outDir = path.join(tmpDir, "parts");
  await fsp.mkdir(outDir, { recursive: true });
  await fsp.writeFile(inPath, buffer);

  // Segment to ~15 minute parts, transcode down to 16k mono 32kbps for safety.
  // Rationale: Lower bitrate + mono drastically reduces size while preserving speech clarity for transcription.
  // 15 min chosen to keep typical spoken segments < 10MB. Adjust -segment_time if future limits change.
  const outPattern = path.join(outDir, "part_%03d.mp3");
  await new Promise<void>((resolve, reject) => {
    try {
      (ffmpeg as any)(inPath)
        .audioChannels(1)
        .audioBitrate("32k")
        .audioFrequency(16000)
        .format("segment")
        .outputOptions(["-segment_time 900", "-reset_timestamps 1"])
        .output(outPattern)
        .on("error", (err: any) => reject(err))
        .on("end", () => resolve())
        .run();
    } catch (err) {
      reject(err);
    }
  });

  // Read generated parts
  const files = (await fsp.readdir(outDir))
    .filter((f) => /^part_\d{3}\.mp3$/i.test(f))
    .sort();
  if (!files.length) {
    // Fallback: if segmentation failed, try compressing whole file and split again with shorter duration
    logger.error("ffmpeg segmentation produced no parts");
    throw new Error("Failed to segment audio for transcription");
  }

  let combined = "";
  for (let i = 0; i < files.length; i++) {
    const p = files[i];
    const full = path.join(outDir, p);
    const buf = await fsp.readFile(full);
    const partText = await transcribeSmall(buf, p, "audio/mpeg");
    combined += (combined ? "\n\n" : "") + partText;
    // Report progress (from 0..100)
    const pct = Math.round(((i + 1) / files.length) * 100);
    try {
      if (onProgress) await onProgress(pct);
    } catch {
      /* ignore */
    }
  }

  // Cleanup best-effort
  try {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

  return combined.trim();
}

// Initialize services (they will be created when functions are called)
const createServices = () => {
  const apiKey = process.env.OPENAI_API_KEY || "";
  return {
    documentProcessor: new DocumentProcessor(),
    embeddingService: new EmbeddingService(),
    queryService: new QueryService(),
    translationService: new TranslationService(),
    ocrService: new OCRService(apiKey),
  };
};

// ===== Topic classification config & helpers =====
// Keep in sync with Explore UI topics (excluding "For You")
const TOPICS: string[] = [
  "Chemistry",
  "Education",
  "Arts, Design & Media",
  "Languages & Literature",
  "History & Archaeology",
  "Philosophy & Ethics",
  "Social & Behavioural Sciences",
  "Journalism & Information",
  "Business Administration",
  "Law & Policy",
  "Biological Sciences",
  "Environmental Sciences",
  "Earth Sciences",
  "Physics",
  "Mathematics & Statistics",
  "Computer Science",
  "AI",
];

// Short descriptions improve embedding separation
const TOPIC_DESCRIPTIONS: Record<string, string> = {
  Chemistry:
    "Chemistry, molecules, reactions, organic, inorganic, physical chemistry, spectroscopy, lab methods",
  Education:
    "Teaching, learning, pedagogy, curriculum, assessment, classrooms, students, teachers",
  "Arts, Design & Media":
    "Art, design, graphic design, UX, UI, film, photography, music, media studies, visual arts",
  "Languages & Literature":
    "Linguistics, grammar, translation, literature analysis, novels, poetry, rhetoric",
  "History & Archaeology":
    "History, historical events, archaeology, ancient civilizations, cultural heritage",
  "Philosophy & Ethics":
    "Philosophy, ethics, morality, epistemology, metaphysics, logic, ethical dilemmas",
  "Social & Behavioural Sciences":
    "Psychology, sociology, anthropology, human behavior, surveys, social science",
  "Journalism & Information":
    "Journalism, news, reporting, information science, libraries, media law, fact-checking",
  "Business Administration":
    "Business, management, marketing, finance, operations, entrepreneurship, strategy",
  "Law & Policy":
    "Law, legal systems, regulation, public policy, governance, compliance, constitutional law",
  "Biological Sciences":
    "Biology, genetics, microbiology, physiology, ecology, evolution, biotechnology",
  "Environmental Sciences":
    "Environment, climate change, sustainability, ecology, conservation, pollution",
  "Earth Sciences":
    "Geology, geophysics, meteorology, oceanography, earth systems, tectonics, minerals",
  Physics:
    "Physics, mechanics, electromagnetism, quantum, thermodynamics, relativity, optics",
  "Mathematics & Statistics":
    "Mathematics, calculus, algebra, probability, statistics, data analysis, theorems",
  "Computer Science":
    "Computer science, algorithms, data structures, programming, systems, databases, software",
  AI: "Artificial intelligence, machine learning, deep learning, neural networks, LLMs, NLP, computer vision",
};

let cachedTopicEmbeddings: { labels: string[]; vectors: number[][] } | null =
  null;

function cosineSim(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const va = a[i];
    const vb = b[i];
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function getTopicEmbeddings(embeddingService: EmbeddingService) {
  if (cachedTopicEmbeddings) return cachedTopicEmbeddings;
  try {
    const inputs = TOPICS.map((t) => `${t}: ${TOPIC_DESCRIPTIONS[t] || t}`);
    const vectors = await embeddingService.embedChunks(inputs);
    cachedTopicEmbeddings = { labels: TOPICS.slice(), vectors };
    return cachedTopicEmbeddings;
  } catch (err) {
    logger.warn(
      "Failed to precompute topic embeddings; classification disabled",
      err as any
    );
    cachedTopicEmbeddings = { labels: TOPICS.slice(), vectors: [] };
    return cachedTopicEmbeddings;
  }
}

function selectDocTextForClassification(data: Record<string, any>): string {
  const title = String(data.title || "").slice(0, 200);
  const summary = String(data.summary || "").slice(0, 4000);
  const processed = String(data.content?.processed || "").slice(0, 4000);
  const raw = String(data.content?.raw || "").slice(0, 4000);
  const meta = [data.type, data.metadata?.fileName, data.metadata?.mimeType]
    .filter(Boolean)
    .join(" ");
  const base = [title, summary, processed, raw, meta]
    .filter(Boolean)
    .join("\n");
  return base || title || meta || "";
}

async function classifyTopics(
  data: Record<string, any>,
  embeddingService: EmbeddingService
): Promise<string[]> {
  try {
    const text = selectDocTextForClassification(data);
    // Be stricter: require a reasonable amount of text before classifying
    if (!text || text.length < 120) return [];
    const topicEmb = await getTopicEmbeddings(embeddingService);
    if (!topicEmb.vectors.length) return [];
    const docVec = await embeddingService.embedQuery(text);
    const scores = topicEmb.vectors.map((v, i) => ({
      label: topicEmb.labels[i],
      score: cosineSim(docVec, v),
    }));
    // Stricter policy: sort, apply higher threshold, and keep at most 1 tag
    scores.sort((a, b) => b.score - a.score);
    const threshold = 0.45; // stricter similarity requirement
    const top = scores.filter((s) => s.score >= threshold).slice(0, 1);
    // No fallback: if nothing crosses threshold, return no tags
    if (top.length) return top.map((t) => t.label);
    return [];
  } catch (err) {
    logger.warn("Topic classification failed", err as any);
    return [];
  }
}

function mergeTags(existing: any, computed: string[]): string[] {
  const base = Array.isArray(existing) ? existing.map(String) : [];
  const set = new Set<string>(base);
  for (const t of computed) set.add(t);
  // Remove undesired system tags
  set.delete("uploaded");
  return Array.from(set);
}

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

      // Increment analytics for chats used
      try {
        await db
          .collection("user_analytics")
          .doc(userId)
          .set(
            {
              aiChatsUsed: FieldValue.increment(1),
              lastActiveDate: new Date(),
            },
            { merge: true }
          );
      } catch (e) {
        logger.warn("Failed to increment aiChatsUsed", e as any);
      }

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
 * Resolve a user by email. Returns minimal info to support sharing invites.
 * Request: { email: string }
 * Response: { success: boolean, data?: { userId: string, displayName?: string, photoURL?: string }, error?: string }
 */
export const resolveUserByEmail = onCall(
  { enforceAppCheck: false },
  async (request) => {
    try {
      const { email } = request.data || {};
      if (!request.auth) throw new Error("Authentication required");
      if (!email || typeof email !== "string") throw new Error("Missing email");
      const norm = String(email).toLowerCase().trim();
      const snap = await db
        .collection("users")
        .where("email", "==", norm)
        .limit(1)
        .get();
      if (snap.empty) return { success: true, data: null };
      const d = snap.docs[0];
      const data = d.data() as any;
      return {
        success: true,
        data: {
          userId: d.id,
          displayName: data?.displayName || "",
          photoURL: data?.photoURL || "",
        },
      };
    } catch (err) {
      logger.error("resolveUserByEmail error", err as any);
      return {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }
);

/**
 * Cloud Function triggered when a document is created or updated in Firestore
 * Processes documents through the RAG pipeline (OpenAI Vector Store only):
 * - For PDF/DOC/DOCX/PPTX/TXT: Extract text, then upload full text to OpenAI Vector Store
 *   (OpenAI handles chunking + embeddings). No Pinecone is used anywhere.
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

      // Initialize services (will be instantiated as needed below)

      // Determine type early for branching
      const docType = String(documentData.type || "").toLowerCase();

      // Only proceed when we have a storage path, unless this is a website or youtube URL doc
      if (
        !["website", "youtube", "audio"].includes(docType) &&
        !documentData.metadata?.storagePath
      ) {
        logger.info(
          `Document ${documentId} doesn't have storagePath yet, will process when storage info is updated`
        );
        return;
      }

      // For audio docs specifically, wait until storagePath is populated (creation fires before upload finishes)
      if (docType === "audio" && !documentData.metadata?.storagePath) {
        logger.info(
          `Audio document ${documentId} has no storagePath yet, will retry on storagePath update`
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

      let extractedText = "";
      // Track language detection/translation for metadata
      let detectedLanguage: string = "und";
      let wasTranslated = false;
      if (docType === "website") {
        // Webpage extraction path: use metadata.url
        const url = String(
          documentData?.metadata?.url || documentData?.content?.raw || ""
        );
        if (!url) throw new Error("Website document missing URL");
        logger.info("Extracting article from website URL...");
        const result = await (
          createServices().documentProcessor as any
        ).extractTextFromURL(url);
        extractedText = result.text || "";
        // Optional: update title if missing and extractor provided one
        if (
          result.title &&
          (!documentData.title ||
            String(documentData.title).toLowerCase().includes("website -"))
        ) {
          try {
            await db
              .collection("documents")
              .doc(userId)
              .collection("userDocuments")
              .doc(documentId)
              .set(
                { title: String(result.title).slice(0, 140) },
                { merge: true }
              );
          } catch {
            /* ignore */
          }
        }
      } else if (docType === "youtube") {
        // YouTube transcript path: use metadata.url
        const videoUrl = String(
          documentData?.metadata?.url || documentData?.content?.raw || ""
        ).trim();
        if (!videoUrl) throw new Error("YouTube document missing URL");
        logger.info("Fetching transcript via Transcript API...");

        const { text: transcriptText, title: apiTitle } =
          await fetchYouTubeTranscript(videoUrl);
        // Clean text using TXT pipeline cleaner
        const buffer = Buffer.from(transcriptText, "utf-8");
        extractedText = await (
          createServices().documentProcessor as any
        ).extractTextFromTXT(buffer);

        // Ensure English for downstream RAG: detect language and translate if needed
        try {
          const ensured =
            await createServices().translationService.ensureEnglish(
              extractedText
            );
          detectedLanguage = ensured.detectedLang || "und";
          wasTranslated = ensured.translated && ensured.detectedLang !== "en";
          extractedText = ensured.englishText || extractedText;
          logger.info("YouTube transcript language handling", {
            detectedLanguage,
            wasTranslated,
            length: extractedText.length,
          });
        } catch (e) {
          logger.warn(
            "Language detection/translation failed; using original text",
            e as any
          );
        }
        // Optionally update document title if API provided one and current title is generic
        if (apiTitle) {
          const currentTitle = String(documentData.title || "");
          const looksGeneric =
            /YouTube\s*Video/i.test(currentTitle) || !currentTitle.trim();
          if (looksGeneric) {
            try {
              await db
                .collection("documents")
                .doc(userId)
                .collection("userDocuments")
                .doc(documentId)
                .set(
                  { title: String(apiTitle).slice(0, 140) },
                  { merge: true }
                );
            } catch {
              /* ignore */
            }
          }
        }
      } else if (docType === "audio") {
        // Audio transcription path: download audio and transcribe via OpenAI
        const storagePath = String(documentData.metadata?.storagePath || "");
        if (!storagePath) throw new Error("Audio document missing storagePath");
        logger.info("Downloading audio file from storage for transcription...");
        const fileBuffer = await downloadFileFromStorage(storagePath);

        // Update progress early
        await db
          .collection("documents")
          .doc(userId)
          .collection("userDocuments")
          .doc(documentId)
          .set(
            { processingStatus: "processing", processingProgress: 10 },
            { merge: true }
          );

        // Determine filename and mime type hints
        const fileName = String(
          documentData?.metadata?.fileName || `${documentId}.webm`
        );
        const mimeType = String(
          documentData?.metadata?.mimeType || "audio/webm"
        );

        logger.info("Transcribing audio via OpenAI", {
          model: "gpt-4o-mini-transcribe",
        });
        const rawTranscript = await transcribeAudioBuffer(
          fileBuffer,
          fileName,
          mimeType,
          async (pct) => {
            // Map chunking progress (0-100) into overall doc processing progress window 10-40
            const mapped = 10 + Math.round((pct / 100) * 30);
            try {
              await db
                .collection("documents")
                .doc(userId)
                .collection("userDocuments")
                .doc(documentId)
                .set({ processingProgress: mapped }, { merge: true });
            } catch (e) {
              logger.warn("Failed to update chunk transcription progress", e);
            }
          }
        );

        // Clean text through TXT cleaner
        const cleaned = await (
          createServices().documentProcessor as any
        ).extractTextFromTXT(Buffer.from(rawTranscript || "", "utf-8"));
        extractedText = cleaned;
      } else if (docType === "image") {
        // OCR path using OpenAI Vision (gpt-4o-mini)
        const storagePath = String(documentData.metadata?.storagePath || "");
        if (!storagePath) throw new Error("Image document missing storagePath");
        logger.info("Downloading image file from storage for OCR...");
        const fileBuffer = await downloadFileFromStorage(storagePath);

        // Progress update
        await db
          .collection("documents")
          .doc(userId)
          .collection("userDocuments")
          .doc(documentId)
          .set(
            { processingStatus: "processing", processingProgress: 20 },
            { merge: true }
          );

        try {
          const apiKey = process.env.OPENAI_API_KEY || "";
          if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
          const openai = new OpenAI({ apiKey });
          const mimeType = String(
            documentData?.metadata?.mimeType || "image/png"
          );
          const base64 = fileBuffer.toString("base64");
          const dataUrl = `data:${mimeType};base64,${base64}`;

          // Use Responses API for vision input
          const prompt =
            "Extract all legible text from the image. Return plain text only, preserving natural reading order where possible.";
          let ocrText = "";
          try {
            const resp: any = await (openai as any).responses.create({
              model: "gpt-4o-mini",
              input: [
                {
                  role: "user",
                  content: [
                    { type: "input_text", text: prompt },
                    { type: "input_image", image_url: dataUrl },
                  ],
                },
              ],
            });
            ocrText =
              resp?.output_text ||
              resp?.output?.[0]?.content?.[0]?.text ||
              resp?.data?.[0]?.content?.[0]?.text ||
              "";
          } catch (respErr) {
            logger.warn(
              "Responses vision OCR failed; trying chat fallback",
              respErr
            );
            try {
              const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini" as any,
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: prompt } as any,
                      { type: "image_url", image_url: { url: dataUrl } } as any,
                    ],
                  } as any,
                ],
                max_tokens: 1200,
                temperature: 0.0,
              } as any);
              ocrText = completion.choices?.[0]?.message?.content || "";
            } catch (chatErr) {
              logger.error("OpenAI vision OCR failed", chatErr as any);
              throw chatErr;
            }
          }

          // Clean through TXT pipeline for normalization
          const cleaned = await (
            createServices().documentProcessor as any
          ).extractTextFromTXT(Buffer.from(String(ocrText || ""), "utf-8"));
          extractedText = cleaned;
        } catch (e) {
          logger.error("Image OCR pipeline failed", e as any);
          throw new Error("Failed to extract text from image");
        }
      } else {
        // File-based extraction path
        logger.info("Downloading file from storage...");
        const fileBuffer = await downloadFileFromStorage(
          documentData.metadata.storagePath
        );

        if (docType === "pdf") {
          logger.info("Extracting text from PDF...");

          // First, try regular PDF text extraction
          const pdfResult = await (
            createServices().documentProcessor as any
          ).extractTextFromPDFWithMetadata(fileBuffer);

          // Check if the PDF is scanned/handwritten
          const isScanned =
            createServices().documentProcessor.isScannedOrHandwritten(
              pdfResult.text,
              pdfResult.pageCount
            );

          if (isScanned) {
            logger.info(
              "PDF detected as scanned/handwritten. Using OCR pipeline..."
            );

            // Update progress to indicate OCR processing
            await db
              .collection("documents")
              .doc(userId)
              .collection("userDocuments")
              .doc(documentId)
              .set(
                {
                  processingStatus: "processing",
                  processingProgress: 25,
                  processingMessage: "Performing OCR on scanned document...",
                },
                { merge: true }
              );

            // Use OCR service to extract text from scanned PDF
            extractedText =
              await createServices().ocrService.extractTextFromScannedPDFChunked(
                fileBuffer,
                async (progress) => {
                  // Map OCR progress (0-100) to overall document processing progress (25-60)
                  const mapped = 25 + Math.round((progress / 100) * 35);
                  try {
                    await db
                      .collection("documents")
                      .doc(userId)
                      .collection("userDocuments")
                      .doc(documentId)
                      .set(
                        {
                          processingProgress: mapped,
                          processingMessage: `OCR processing: ${progress}% complete`,
                        },
                        { merge: true }
                      );
                  } catch (e) {
                    logger.warn("Failed to update OCR progress", e);
                  }
                },
                5 // Process 5 pages at a time
              );

            logger.info(
              `OCR extraction completed: ${extractedText.length} characters`
            );
          } else {
            // Use regular text extraction for text-based PDFs
            extractedText = pdfResult.text;
            logger.info(
              `Regular PDF text extraction: ${extractedText.length} characters`
            );
          }
        } else if (docType === "docx") {
          logger.info("Extracting text from DOCX via Mammoth...");
          extractedText =
            await createServices().documentProcessor.extractTextFromDOCX(
              fileBuffer
            );
        } else if (docType === "pptx") {
          logger.info("Extracting text from PPTX...");
          extractedText = await (
            createServices().documentProcessor as any
          ).extractTextFromPPTX(fileBuffer);
        } else if (
          docType === "text" ||
          String(documentData?.metadata?.mimeType || "").includes("text") ||
          /\.txt$/i.test(String(documentData?.metadata?.fileName || ""))
        ) {
          logger.info("Extracting text from TXT...");
          extractedText = await (
            createServices().documentProcessor as any
          ).extractTextFromTXT(fileBuffer);
        } else {
          logger.info(`Unsupported document type for processing: ${docType}`);
          return;
        }
      }

      if (!extractedText || extractedText.length < 10) {
        throw new Error("No meaningful text extracted from document");
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

      // All supported types (pdf, docx, pptx, text, website, youtube): upload text to OpenAI Vector Store
      if (
        [
          "pdf",
          "docx",
          "pptx",
          "text",
          "website",
          "youtube",
          "audio",
          "image",
        ].includes(docType)
      ) {
        const vsId = process.env.OPENAI_VECTOR_STORE_ID || "";
        const openaiVS = new OpenAIVectorStoreService(vsId);
        // Update progress early
        await db
          .collection("documents")
          .doc(userId)
          .collection("userDocuments")
          .doc(documentId)
          .set(
            {
              processingStatus: "processing",
              processingProgress: docType === "audio" ? 40 : 20,
            },
            { merge: true }
          );

        const vsUpload = await openaiVS.uploadTextAsDocument(workingText, {
          userId,
          documentId,
          title: documentData.title,
          fileName: documentData.metadata?.fileName,
        });

        // Persist the full raw transcript to Cloud Storage to avoid Firestore doc size limits
        const transcriptPath = `transcripts/${userId}/${documentId}.txt`;
        try {
          await storage.bucket().file(transcriptPath).save(workingText, {
            contentType: "text/plain; charset=utf-8",
          });
          logger.info("Saved transcript to storage", { transcriptPath });
        } catch (e) {
          logger.warn("Failed to save transcript to storage", e as any);
        }

        // Update Firestore with processed content and status
        await db
          .collection("documents")
          .doc(userId)
          .collection("userDocuments")
          .doc(documentId)
          .update({
            // Keep a smaller inline preview to stay well under Firestore limits
            "content.raw": workingText.slice(0, 200_000),
            "content.processed": wasTranslated
              ? `Indexed to OpenAI Vector Store (EN)`
              : `Indexed to OpenAI Vector Store`,
            "metadata.openaiVector": {
              vectorStoreId: openaiVS.getVectorStoreId(),
              fileId: vsUpload.fileId,
              vectorStoreFileId: vsUpload.vectorStoreFileId,
            },
            // Save language/translation flags for UI & analytics
            "metadata.originalLanguage": detectedLanguage,
            "metadata.translatedToEnglish": wasTranslated,
            // Store transcript file path for full-text retrieval in UI
            "metadata.transcriptPath": transcriptPath,
            processingStatus: "completed",
            processingCompletedAt: new Date(),
            // Remove chunkCount field if present; cannot set undefined in Firestore update
            chunkCount: FieldValue.delete(),
            characterCount: workingText.length,
            truncated,
            processingProgress: 100,
            processingLock: null,
          });

        logger.info(
          `Successfully processed ${docType.toUpperCase()} document ${documentId} into OpenAI Vector Store`
        );
      }
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
 * Realtime sync for Notebook (type: "text") documents.
 * - On create: ensure vector store metadata exists; if content present, upload to OpenAI Vector Store.
 * - On update: when content.raw changes, replace the vector store file with new content.
 */
export const syncNotebookEmbeddings = onDocumentWritten(
  "documents/{userId}/userDocuments/{documentId}",
  async (event) => {
    const afterSnap = event.data?.after;
    const beforeSnap = event.data?.before;
    if (!afterSnap?.exists) return; // ignore deletes

    const { userId, documentId } = event.params as {
      userId: string;
      documentId: string;
    };
    const after = (afterSnap.data() as any) || {};
    const before = (beforeSnap?.data() as any) || {};

    // Only handle text notebook docs (inline editable)
    const type = String(after?.type || "").toLowerCase();
    if (type !== "text") return;

    const afterRaw = String(after?.content?.raw || "");
    const beforeRaw = String(before?.content?.raw || "");
    const created = !beforeSnap?.exists && !!afterSnap.exists;
    const contentChanged = created || afterRaw !== beforeRaw;

    // If nothing meaningful changed, skip
    if (!contentChanged) return;

    const docRef = db
      .collection("documents")
      .doc(userId)
      .collection("userDocuments")
      .doc(documentId);

    try {
      const vsId = process.env.OPENAI_VECTOR_STORE_ID || "";
      const openaiVS = new OpenAIVectorStoreService(vsId);

      // If empty content: ensure vector store id metadata exists; nothing to upload
      if (!afterRaw || afterRaw.trim().length === 0) {
        await docRef.set(
          {
            status: "ready",
            processingStatus: "completed",
            processingCompletedAt: new Date(),
            characterCount: 0,
            chunkCount: FieldValue.delete(),
            "metadata.openaiVector": {
              vectorStoreId: openaiVS.getVectorStoreId(),
            },
          },
          { merge: true }
        );
        return;
      }

      // Upsert into vector store (delete old file if present)
      const existingVS = {
        vectorStoreId:
          (after?.metadata?.openaiVector?.vectorStoreId as string) ||
          openaiVS.getVectorStoreId(),
        fileId: after?.metadata?.openaiVector?.fileId as string | undefined,
      };
      const result = await openaiVS.upsertTextDocument(afterRaw, {
        userId,
        documentId,
        title: String(after?.title || "Document"),
        fileName: String(after?.metadata?.fileName || `${documentId}.txt`),
        existing: existingVS,
      });

      await docRef.set(
        {
          status: "ready",
          processingStatus: "completed",
          processingCompletedAt: new Date(),
          characterCount: afterRaw.length,
          chunkCount: FieldValue.delete(),
          "content.processed": "Indexed to OpenAI Vector Store",
          "metadata.openaiVector": {
            vectorStoreId: result.vectorStoreId,
            fileId: result.fileId,
            vectorStoreFileId: result.vectorStoreFileId,
          },
        },
        { merge: true }
      );
    } catch (e) {
      logger.warn("syncNotebookEmbeddings failed", { userId, documentId, e });
    }
  }
);

/**
 * Mirror nested user document to top-level /userDocuments for public Explore.
 * Doc id format: `${ownerId}_${documentId}` to keep unique and traceable.
 * On delete, remove mirror.
 */
// Single handler: mirror on create, delete on delete, and only update isPublic on updates
export const syncAllDocuments = onDocumentWritten(
  "documents/{userId}/userDocuments/{documentId}",
  async (event) => {
    const beforeSnap = event.data?.before;
    const afterSnap = event.data?.after;
    const { userId, documentId } = event.params as {
      userId: string;
      documentId: string;
    };

    const mirrorId = `${userId}_${documentId}`;
    const allRef = db.collection("allDocuments").doc(mirrorId);

    // Delete mirror when source is deleted
    if (!afterSnap?.exists && beforeSnap?.exists) {
      try {
        await allRef.delete();
        logger.info("Deleted mirror in allDocuments", { mirrorId });
      } catch (err) {
        logger.warn("Failed to delete mirror doc in allDocuments", {
          mirrorId,
          err,
        });
      }
      return;
    }

    // Create mirror on new document
    if (!beforeSnap?.exists && afterSnap?.exists) {
      const data = afterSnap.data() as Record<string, any> | undefined;
      if (!data) return;
      try {
        // Attempt to classify topics using embeddings
        const { embeddingService } = createServices();
        const topics = await classifyTopics(data, embeddingService);
        // Compute a single keyword embedding for later discovery
        let keywordEmbedding: number[] | undefined = undefined;
        try {
          const text = selectDocTextForClassification(data);
          if (text && text.length > 10) {
            keywordEmbedding = await embeddingService.embedQuery(text);
          }
        } catch (e) {
          logger.warn("keywordEmbedding generation failed (create)", e as any);
        }
        const payload = {
          ...data,
          tags: mergeTags(data.tags, topics),
          ...(keywordEmbedding ? { keywordEmbedding } : {}),
          updatedAt: new Date(),
        } as Record<string, any>;
        await allRef.set(payload, { merge: false });
        logger.info("Created mirror in allDocuments (with topics)", {
          mirrorId,
          topics,
        });
      } catch (err) {
        logger.error("Failed to create mirror doc in allDocuments", {
          mirrorId,
          err,
        });
      }
      return;
    }

    // Update mirror on key changes: isPublic toggles OR processing completed (to reclassify with full text)
    if (beforeSnap?.exists && afterSnap?.exists) {
      const before = (beforeSnap.data() as any) || {};
      const after = (afterSnap.data() as any) || {};
      const beforePublic = !!before.isPublic;
      const afterPublic = !!after.isPublic;
      const processingCompletedNow =
        before.processingStatus !== "completed" &&
        after.processingStatus === "completed";
      const titleChanged =
        String(before.title || "") !== String(after.title || "");
      const summaryChanged =
        String(before.summary || "") !== String(after.summary || "");
      const contentRawChanged =
        String(before.content?.raw || "") !== String(after.content?.raw || "");
      const shouldReclassify =
        processingCompletedNow ||
        titleChanged ||
        summaryChanged ||
        contentRawChanged;

      if (!shouldReclassify && beforePublic === afterPublic) return;

      try {
        const mirrorSnap = await allRef.get();
        const mirrorExists = mirrorSnap.exists;

        // Prepare payload
        let payload: Record<string, any> = { updatedAt: new Date() };

        // Always sync isPublic changes
        if (beforePublic !== afterPublic) {
          payload.isPublic = afterPublic;
        }

        // If we have meaningful content updates, recompute topics
        if (shouldReclassify) {
          try {
            const { embeddingService } = createServices();
            const topics = await classifyTopics(after, embeddingService);
            payload.tags = mergeTags(
              mirrorExists ? (mirrorSnap.data() as any)?.tags : after.tags,
              topics
            );
            // Recompute keyword embedding for updated content
            try {
              const text = selectDocTextForClassification(after);
              if (text && text.length > 10) {
                payload.keywordEmbedding = await embeddingService.embedQuery(
                  text
                );
              }
            } catch (e) {
              logger.warn("keywordEmbedding generation failed (update)", {
                mirrorId,
                e,
              });
            }
            logger.info("Reclassified topics for mirror", { mirrorId, topics });
          } catch (e) {
            logger.warn("Reclassification failed", { mirrorId, e });
          }
        }

        if (!mirrorExists) {
          await allRef.set({ ...after, ...payload }, { merge: false });
          logger.info("Backfilled mirror in allDocuments on update", {
            mirrorId,
          });
        } else if (Object.keys(payload).length > 0) {
          await allRef.set(payload, { merge: true });
          logger.info("Updated mirror in allDocuments", {
            mirrorId,
            fields: Object.keys(payload),
          });
        }
      } catch (err) {
        logger.error("Failed to update mirror in allDocuments", {
          mirrorId,
          err,
        });
      }
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
      const {
        userId,
        prompt,
        language,
        chatId,
        docIds,
        webSearch,
        thinkMode,
        docOwnerId,
      } = request.data || {};

      if (!userId || !prompt || typeof prompt !== "string") {
        throw new Error("Missing required parameters: userId and prompt");
      }

      if (request.auth && request.auth.uid && request.auth.uid !== userId) {
        throw new Error("Authenticated user mismatch");
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model = webSearch
        ? "gpt-4.1"
        : thinkMode
        ? "o3-mini"
        : "gpt-4o-mini";

      // Determine if this is a document-based chat or standalone chat
      // Important: Only treat as document-based when an explicit docOwnerId is provided
      // (DocumentChat flow). ChatPage may pass docIds as context but should remain in top-level chats.
      const isDocumentBasedChat =
        !!docOwnerId && Array.isArray(docIds) && docIds.length > 0;
      let chatDocId: string = chatId;
      let chatCollection: any;

      if (isDocumentBasedChat) {
        // Document-based chat: create under documents/{docOwnerId}/userDocuments/{documentId}/chats
        const primaryDocId = docIds[0];
        const documentOwnerId = docOwnerId || userId; // Fall back to userId if docOwnerId not provided
        chatCollection = db
          .collection("documents")
          .doc(documentOwnerId)
          .collection("userDocuments")
          .doc(primaryDocId)
          .collection("chats");
      } else {
        // Standalone chat: use top-level chats collection
        chatCollection = db.collection("chats");
      }

      if (!chatDocId) {
        const title = (prompt as string).trim().slice(0, 60);
        const chatRef = await chatCollection.add({
          userId,
          title: title || "New Chat",
          language: language || "en",
          model,
          contextDocIds: Array.isArray(docIds) ? docIds.slice(0, 8) : [],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        chatDocId = chatRef.id;

        // Increment analytics for chats used (new chat created)
        try {
          await db
            .collection("user_analytics")
            .doc(userId)
            .set(
              {
                aiChatsUsed: FieldValue.increment(1),
                lastActiveDate: new Date(),
              },
              { merge: true }
            );
        } catch (e) {
          logger.warn(
            "Failed to increment aiChatsUsed (prompt handler)",
            e as any
          );
        }
      } else {
        await chatCollection.doc(chatDocId).set(
          {
            updatedAt: new Date(),
            language: language || "en",
            model,
            ...(Array.isArray(docIds) && docIds.length
              ? { contextDocIds: docIds.slice(0, 8) }
              : {}),
          },
          { merge: true }
        );
      }

      const messagesCol = chatCollection.doc(chatDocId).collection("messages");

      // Add user's message if not already last
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

      // Load last messages for context
      const recentSnap = await messagesCol
        .orderBy("createdAt", "asc")
        .limit(20)
        .get();
      const convo = recentSnap.docs.map((d: any) => d.data());

      // Active context documents
      let activeDocIds: string[] = [];
      try {
        if (Array.isArray(docIds) && docIds.length) {
          activeDocIds = docIds.slice(0, 8);
        } else {
          const chatSnap = await chatCollection.doc(chatDocId).get();
          const data = chatSnap.data() as any;
          if (Array.isArray(data?.contextDocIds))
            activeDocIds = data.contextDocIds.slice(0, 8);
        }
      } catch (e) {
        logger.warn("Could not load contextDocIds", e);
      }

      // Optional RAG retrieval
      let docsContext = "";
      let vectorStoreIds: string[] = [];
      let vectorFileIds: string[] = [];
      let metaSnaps: any[] = [];
      if (activeDocIds.length) {
        logger.info("Processing document context", {
          activeDocIds,
          docOwnerId: docOwnerId || "not provided",
          userId,
        });

        // Inspect whether any of the context docs were indexed in OpenAI Vector Store
        try {
          const documentOwnerId = docOwnerId || userId; // Use docOwnerId if provided, otherwise fall back to userId
          metaSnaps = await Promise.all(
            activeDocIds.map((id) =>
              db
                .collection("documents")
                .doc(documentOwnerId)
                .collection("userDocuments")
                .doc(id)
                .get()
            )
          );

          logger.info("Retrieved document metadata", {
            docCount: metaSnaps.length,
            docsExist: metaSnaps.map((s) => ({ id: s.id, exists: s.exists })),
          });

          const metaDatas = metaSnaps.map((s) => (s.data() as any) || {});
          vectorStoreIds = Array.from(
            new Set(
              metaDatas
                .map((d) => d?.metadata?.openaiVector?.vectorStoreId)
                .filter(Boolean) as string[]
            )
          );
          vectorFileIds = metaDatas
            .map((d) => d?.metadata?.openaiVector?.fileId)
            .filter(Boolean) as string[];

          logger.info("Vector store analysis", {
            vectorStoreIds,
            vectorStoreCount: vectorStoreIds.length,
            vectorFileIdsCount: vectorFileIds.length,
          });
        } catch (e) {
          logger.warn("Failed to read doc metadata for vector store IDs", e);
        }
        // If no vector stores are available, build a lightweight context by reading Firestore content/summary/transcripts
        if (vectorStoreIds.length === 0) {
          try {
            const pieces: string[] = [];
            const MAX_CONTEXT_CHARS = 12000;
            let used = 0;
            for (let i = 0; i < metaSnaps.length; i++) {
              const s = metaSnaps[i];
              const d = (s.data() as any) || {};
              let text =
                (d.summary as string) ||
                (d.content?.raw as string) ||
                (d.content?.processed as string) ||
                "";
              if ((!text || text.length < 120) && d?.metadata?.transcriptPath) {
                try {
                  const [buf] = await storage
                    .bucket()
                    .file(String(d.metadata.transcriptPath))
                    .download();
                  text = buf.toString("utf-8");
                } catch {
                  /* ignore */
                }
              }
              if (text) {
                const clean = String(text).replace(/\s+/g, " ").trim();
                if (clean) {
                  const snippet = clean.slice(0, 1000);
                  const block = `DOC ${activeDocIds[i]} | ${
                    d.title || "Document"
                  }\n${snippet}`;
                  if (used + block.length > MAX_CONTEXT_CHARS) break;
                  pieces.push(block);
                  used += block.length;
                }
              }
            }
            if (pieces.length) {
              docsContext = `Retrieved document context (no vector store available):\n\n${pieces.join(
                "\n\n---\n\n"
              )}`;
              logger.info("Built fallback context", {
                pieceCount: pieces.length,
                totalChars: docsContext.length,
              });
            } else {
              logger.warn("No fallback context could be built from documents");
            }
          } catch (fbErr) {
            logger.warn("Context fallback assembly failed", fbErr);
          }
        }
      }

      let baseInstruction =
        "You are a helpful AI assistant. When a vector store is attached, you MUST ground answers strictly on retrieved files via the file_search tool. When only plain context blocks are provided, prefer grounded answers using those. If context is insufficient, say so and optionally ask for more info. Keep responses concise and clear. Use markdown when helpful.";
      if (webSearch) {
        baseInstruction +=
          "\n\nWeb browsing is permitted via the web_search tool. Use it when the question requires up-to-date or external information. Summarize findings and cite source domains briefly (e.g., example.com).";
      }
      const sysContent = docsContext
        ? `${baseInstruction}\n\n${docsContext}`
        : baseInstruction;
      const sysMsg = { role: "system" as const, content: sysContent };
      const chatMessages = [
        sysMsg,
        ...convo.map((m: any) => ({ role: m.role, content: m.content })),
      ];

      // Assistant placeholder
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
          await chatCollection
            .doc(chatDocId)
            .set({ updatedAt: new Date() }, { merge: true });
        } catch (e) {
          logger.warn("Failed to flush streaming token to Firestore", e);
        }
      };
      const streamOut = async (fullText: string) => {
        try {
          const chunkSize = 48; // characters per flush
          const delayMs = 24; // pacing for smoother UI
          buffered = "";
          for (let i = 0; i < fullText.length; i += chunkSize) {
            buffered += fullText.slice(i, i + chunkSize);
            await flush(false);
            await new Promise((r) => setTimeout(r, delayMs));
          }
          await flush(true);
        } catch (e) {
          logger.warn("streamOut failed; falling back to single flush", e);
          buffered = fullText;
          await flush(true);
        }
      };

      try {
        // Prefer OpenAI file_search when vector stores are in context
        if (vectorStoreIds.length) {
          const chosenVectorModel = thinkMode ? "o3-mini" : "gpt-4o-mini";
          logger.info("Using vector store file_search", {
            vectorStoreIds,
            thinkMode,
            chosenVectorModel,
          });

          // Attempt to create assistant with desired model; fall back if tooling unsupported
          let assistant: any;
          try {
            assistant = await openai.beta.assistants.create({
              name: thinkMode
                ? "Document Reasoning Assistant"
                : "Document Assistant",
              instructions: baseInstruction,
              tools: [{ type: "file_search" }],
              model: chosenVectorModel,
              temperature: thinkMode ? 0.2 : 0.2,
            });
          } catch (toolErr) {
            logger.warn(
              "Primary assistant creation failed; falling back to gpt-4o-mini",
              toolErr as any
            );
            assistant = await openai.beta.assistants.create({
              name: "Document Assistant (Fallback)",
              instructions: baseInstruction,
              tools: [{ type: "file_search" }],
              model: "gpt-4o-mini",
              temperature: 0.2,
            });
          }

          // Create thread with conversation history
          const thread = await openai.beta.threads.create({
            messages: convo.map((m: any) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: String(m.content || ""),
            })),
          });

          // Add the current user message, attaching only the selected file IDs to restrict search scope
          const attachments =
            vectorFileIds && vectorFileIds.length
              ? vectorFileIds.map((fid) => ({
                  file_id: fid,
                  tools: [{ type: "file_search" }],
                }))
              : undefined;
          await openai.beta.threads.messages.create(thread.id, {
            role: "user",
            content: String(prompt),
            // @ts-ignore - beta types may not include attachments yet
            attachments,
          } as any);

          // Run the assistant
          const run = await openai.beta.threads.runs.create(thread.id, {
            assistant_id: assistant.id,
          });

          // Poll for completion
          let runStatus = await openai.beta.threads.runs.retrieve(
            thread.id,
            run.id
          );
          while (
            runStatus.status === "in_progress" ||
            runStatus.status === "queued"
          ) {
            await new Promise((r) => setTimeout(r, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(
              thread.id,
              run.id
            );
          }

          if (runStatus.status === "completed") {
            // Get the assistant's response
            const messages = await openai.beta.threads.messages.list(thread.id);
            const lastMessage = messages.data[0];
            const textContent = lastMessage.content.find(
              (c) => c.type === "text"
            );
            const fullText =
              textContent?.type === "text"
                ? textContent.text.value
                : "I couldn't generate a response.";
            await streamOut(String(fullText));
          } else {
            logger.error("Assistant run failed", {
              status: runStatus.status,
              lastError: runStatus.last_error,
            });
            throw new Error(
              `Assistant run failed with status: ${runStatus.status}`
            );
          }

          // Clean up the temporary assistant
          try {
            await openai.beta.assistants.del(assistant.id);
          } catch {}
          // Note: threads are automatically cleaned up by OpenAI
        } else if (webSearch) {
          // Non-streaming Responses API with web_search tool (gpt-4.1)
          const input = chatMessages.map((m) => ({
            role: (m as any).role,
            content: [
              {
                type:
                  (m as any).role === "assistant"
                    ? "output_text"
                    : "input_text",
                text: String((m as any).content || ""),
              },
            ],
          }));
          const resp: any = await (openai as any).responses.create({
            model,
            input,
            tools: [{ type: "web_search" }],
          });
          const fullText =
            resp?.output_text ||
            resp?.output?.[0]?.content?.[0]?.text ||
            resp?.data?.[0]?.content?.[0]?.text ||
            resp?.choices?.[0]?.message?.content ||
            "I'm sorry, I couldn't generate a response.";
          await streamOut(String(fullText));
        } else if (thinkMode) {
          // Non-streaming Responses API for reasoning model o3-mini
          const input = chatMessages.map((m) => ({
            role: (m as any).role,
            content: [
              {
                type:
                  (m as any).role === "assistant"
                    ? "output_text"
                    : "input_text",
                text: String((m as any).content || ""),
              },
            ],
          }));
          const resp: any = await (openai as any).responses.create({
            model,
            input,
          });
          const fullText =
            resp?.output_text ||
            resp?.output?.[0]?.content?.[0]?.text ||
            resp?.data?.[0]?.content?.[0]?.text ||
            resp?.choices?.[0]?.message?.content ||
            "I'm sorry, I couldn't generate a response.";
          await streamOut(String(fullText));
        } else {
          // Normal streaming path
          const stream = await openai.chat.completions.create({
            model,
            temperature: thinkMode ? 0.2 : 0.7,
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
        }
      } catch (genErr) {
        logger.error("OpenAI generation failed", genErr);
        try {
          const fallbackModel =
            webSearch || (typeof model === "string" && model.startsWith("o3"))
              ? "gpt-4o-mini"
              : model;
          const completion = await openai.chat.completions.create({
            model: fallbackModel as any,
            temperature: thinkMode ? 0.2 : 0.7,
            messages: chatMessages as any,
          } as any);
          buffered =
            completion.choices?.[0]?.message?.content ||
            "I'm sorry, I couldn't generate a response.";
          await flush(true);
        } catch (fallbackErr) {
          logger.error("OpenAI fallback also failed", fallbackErr);
          buffered = "I'm sorry, an error occurred generating the response.";
          await flush(true);
        }
      }

      if (!chatId) {
        const title = (prompt as string).trim().slice(0, 60);
        await chatCollection
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

// Web search now uses OpenAI Responses API (gpt-4.1 tools-web-search); no third-party providers.

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

/** Fetch YouTube transcript using Transcript API; returns transcript text and optional metadata title */
async function fetchYouTubeTranscript(
  videoUrl: string
): Promise<{ text: string; title?: string }> {
  const API_KEY = process.env.TRANSCRIPT_API_KEY || "";
  const API_BASE =
    process.env.TRANSCRIPT_API_BASE ||
    "https://transcriptapi.com/api/v2/youtube/transcript";
  if (!API_KEY) throw new Error("Missing Transcript API key in environment");

  const url = `${API_BASE}?video_url=${encodeURIComponent(
    videoUrl
  )}&format=json&include_timestamp=true&send_metadata=true`;

  // small retry loop for transient errors / 429
  const attempt = async () => {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        Accept: "application/json",
      },
    });
    if (res.status === 402)
      throw new Error(
        "Transcript API: Payment required (credits or plan inactive)"
      );
    if (res.status === 429)
      throw new Error("Transcript API: Rate limit exceeded, try later.");
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Transcript API Error (${res.status}): ${errText}`);
    }
    return (await res.json()) as any;
  };

  let data: any;
  try {
    data = await attempt();
  } catch (e1) {
    // brief backoff retry once
    await new Promise((r) => setTimeout(r, 800));
    data = await attempt();
  }

  // Expected reference shape: { transcript: [{ text, start?, duration? }], metadata?: { title?: string, ... } }
  // Also support alternate shapes used by some providers.
  const segments: any[] = Array.isArray(data?.transcript)
    ? data.transcript
    : Array.isArray(data?.segments)
    ? data.segments
    : [];
  let text = "";
  if (segments.length) {
    text = segments
      .map((s: any) => String(s?.text || s?.content || "").trim())
      .filter(Boolean)
      .join(" ");
  } else if (typeof data?.transcript === "string") {
    text = data.transcript;
  } else if (typeof data?.text === "string") {
    text = data.text;
  } else if (typeof data?.result?.transcript === "string") {
    text = data.result.transcript;
  }
  text = String(text || "").trim();
  if (!text) throw new Error("Transcript API returned empty transcript");

  const title: string | undefined =
    (data?.metadata?.title as string | undefined) || undefined;
  return { text, title };
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
 * Recommend public docs similar to a user's document using keyword embeddings.
 * Input: { userId: string, documentId: string, limit?: number }
 * Returns: ranked list of { id, title, ownerId, tags, score }
 */
// recommendPublicDocs removed with Explore deprecation

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
      const { documentId, userId, count, forceNew } = request.data || {};
      if (!documentId || !userId) {
        throw new Error("Missing required parameters: documentId and userId");
      }
      const { queryService } = createServices();
      const cards = await queryService.generateFlashcards(
        documentId,
        userId,
        count || 12,
        forceNew
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
      const { documentId, userId, count, difficulty, forceNew } =
        request.data || {};
      if (!documentId || !userId) {
        throw new Error("Missing required parameters: documentId and userId");
      }
      const { queryService } = createServices();
      const questions = await queryService.generateQuiz(
        documentId,
        userId,
        count || 10,
        difficulty || "mixed",
        forceNew
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
 * Callable function: Semantically evaluate a student's long-form answer against a reference.
 * Uses OpenAI gpt-4o-mini with strict JSON output. Treats varied grammar/style as correct if core logic matches.
 * Input: { userId: string, userAnswer: string, referenceAnswer: string, minLength?: number }
 * Returns: { verdict: 'correct'|'incorrect'|'insufficient', score: 0-100, reasoning: string, keyPoints?: string[], missingPoints?: string[] }
 */
export const evaluateLongAnswer = onCall(
  { enforceAppCheck: false },
  async (request) => {
    try {
      const { userId, userAnswer, referenceAnswer, minLength } =
        request.data || {};
      if (!userId || !userAnswer || !referenceAnswer) {
        throw new Error(
          "Missing required parameters: userId, userAnswer, referenceAnswer"
        );
      }
      if (request.auth && request.auth.uid && request.auth.uid !== userId) {
        throw new Error("Authenticated user mismatch");
      }

      const minChars = Math.max(40, Math.min(2000, Number(minLength) || 120));
      const trimmed = String(userAnswer).trim();
      if (trimmed.length < minChars) {
        return {
          success: true,
          data: {
            verdict: "insufficient",
            score: 0,
            reasoning: `Answer too brief for a long question (min ~${minChars} characters). Provide more detail and key steps.`,
            keyPoints: [],
            missingPoints: [],
          },
        };
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const system =
        "You are a fair, strict grader for long-form answers. Grade SEMANTICALLY: consider meaning, core logic, and conceptual correctness — not phrasing or style. An answer is CORRECT if it captures the essential ideas, steps, and reasoning even with different wording. Mark INCORRECT if key logic is wrong or major concepts are missing. Mark INSUFFICIENT if the response is too short or vague for a long question. Respond ONLY with strict JSON.";
      const schemaHint =
        '{"verdict":"correct|incorrect|insufficient","score":0-100,"reasoning":"short explanation","keyPoints":["..."],"missingPoints":["..."]}';
      const userMsg = `Reference Answer:\n${String(
        referenceAnswer
      )}\n\nStudent Answer:\n${trimmed}\n\nReturn JSON in this shape: ${schemaHint}. Score reflects semantic coverage (not style).`;

      let parsed: any = {
        verdict: "incorrect",
        score: 0,
        reasoning: "Failed to parse model output",
        keyPoints: [],
        missingPoints: [],
      };

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini" as any,
          temperature: 0.0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userMsg },
          ],
          response_format: { type: "json_object" } as any,
          max_tokens: 350,
        } as any);
        const raw = completion.choices?.[0]?.message?.content || "{}";
        parsed = JSON.parse(raw);
      } catch (llmErr) {
        logger.warn(
          "evaluateLongAnswer: JSON mode failed, retrying fallback",
          llmErr
        );
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini" as any,
            temperature: 0.0,
            messages: [
              { role: "system", content: system },
              {
                role: "user",
                content: userMsg + "\nReturn compact JSON only.",
              },
            ],
            max_tokens: 350,
          } as any);
          const text = completion.choices?.[0]?.message?.content || "{}";
          const match = text.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(match ? match[0] : text);
        } catch (fallbackErr) {
          logger.error(
            "evaluateLongAnswer: fallback parse failed",
            fallbackErr
          );
        }
      }

      let verdict: string = String(
        parsed?.verdict || "incorrect"
      ).toLowerCase();
      if (!["correct", "incorrect", "insufficient"].includes(verdict))
        verdict = "incorrect";
      let score = Math.max(0, Math.min(100, Number(parsed?.score || 0)));
      const reasoning = String(parsed?.reasoning || "");
      const keyPoints = Array.isArray(parsed?.keyPoints)
        ? parsed.keyPoints.map(String)
        : [];
      const missingPoints = Array.isArray(parsed?.missingPoints)
        ? parsed.missingPoints.map(String)
        : [];

      // If the model marked correct but the answer is still extremely brief, downgrade to insufficient.
      if (verdict === "correct" && trimmed.length < minChars) {
        verdict = "insufficient";
        score = Math.min(score, 50);
      }

      return {
        success: true,
        data: { verdict, score, reasoning, keyPoints, missingPoints },
      };
    } catch (error) {
      logger.error("Error in evaluateLongAnswer:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

/**
 * Callable function to fetch full raw document text.
 * Uses stored transcript in Cloud Storage or Firestore content; vector store retrieval
 * is handled in other endpoints (chat/query) via file_search.
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

      // Try to read document metadata
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
          title = data?.title;
          fileName = data?.metadata?.fileName;
        }
      } catch {
        /* ignore */
      }
      let text = "";
      let source: "firestore" = "firestore";
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
          const transcriptPath = data?.metadata?.transcriptPath as
            | string
            | undefined;
          if (transcriptPath) {
            try {
              const [buf] = await storage
                .bucket()
                .file(transcriptPath)
                .download();
              text = buf.toString("utf-8");
            } catch (e) {
              logger.warn("Failed to read transcript from storage", {
                transcriptPath,
                e,
              });
            }
          }
          if (!text) {
            text =
              data?.content?.raw ||
              data?.content?.processed ||
              data?.summary ||
              "";
          }
        }
      } catch {
        /* ignore */
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
          chunkCount: undefined,
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
