import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db, storage } from "../config/firebase";
import { DocumentProcessor } from "../services/documentProcessor";
import { EmbeddingService } from "../services/embeddingService";
import { PineconeService } from "../services/pineconeService";

export const processDocument = onDocumentWritten(
  "documents/{userId}/userDocuments/{documentId}",
  async (event) => {
    const afterSnap = event.data?.after;
    const beforeSnap = event.data?.before;
    const documentData = afterSnap?.data() as any;
    const { userId, documentId } = event.params as {
      userId: string;
      documentId: string;
    };

    if (!documentData) return;

    try {
      const beforeData = beforeSnap?.exists
        ? (beforeSnap.data() as any)
        : undefined;
      const created = !beforeSnap?.exists && !!afterSnap?.exists;
      const storagePathAdded =
        !!documentData?.metadata?.storagePath &&
        (!beforeData?.metadata?.storagePath ||
          beforeData?.metadata?.storagePath !==
            documentData?.metadata?.storagePath);
      if (!created && !storagePathAdded) return;

      const documentProcessor = new DocumentProcessor();
      const embeddingService = new EmbeddingService();
      const pineconeService = new PineconeService();

      if (documentData.type !== "pdf") return;
      if (!documentData.metadata?.storagePath) return;
      if (
        documentData.processingStatus === "completed" ||
        documentData.processingStatus === "processing"
      )
        return;

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
        )
          return false;
        tx.update(docRef, {
          processingStatus: "processing",
          processingStartedAt: new Date(),
          processingLock: {
            event: (event as any)?.id || crypto.randomUUID(),
            at: new Date(),
          },
        });
        return true;
      });
      if (!acquired) return;

      const fileBuffer = await downloadFileFromStorage(
        documentData.metadata.storagePath
      );
      const extractedText = await documentProcessor.extractTextFromPDF(
        fileBuffer
      );
      if (!extractedText || extractedText.length < 10)
        throw new Error("No meaningful text extracted from PDF");

      const MAX_CHARS = 2_500_000;
      let truncated = false;
      let workingText = extractedText;
      if (workingText.length > MAX_CHARS) {
        workingText = workingText.slice(0, MAX_CHARS);
        truncated = true;
      }

      function* generateChunks(text: string, chunkSize = 300, overlap = 20) {
        const words = text.split(/\s+/);
        let start = 0;
        while (start < words.length) {
          const end = Math.min(start + chunkSize, words.length);
          const chunk = words.slice(start, end).join(" ").trim();
          if (chunk) yield chunk;
          start = end - overlap;
          if (start < 0) start = 0;
          if (start >= end) start = end;
        }
      }

      let chunkCount = 0;
      let processedChars = 0;
      const totalChars = workingText.length;
      for (const chunk of generateChunks(workingText, 300, 20)) {
        const i = chunkCount;
        chunkCount++;
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
          console.error(`Error processing chunk ${chunkCount}`, chunkError);
        }
        processedChars += chunk.length;
        if (chunkCount % 25 === 0) {
          const progressPct = Math.min(
            99,
            Math.round((processedChars / totalChars) * 100)
          );
          try {
            await docRef.set(
              {
                processingProgress: progressPct,
                processingStatus: "processing",
                chunkCount,
              },
              { merge: true }
            );
          } catch {}
        }
        if (chunkCount % 10 === 0 && (global as any).gc) (global as any).gc();
        await new Promise((r) => setTimeout(r, 40));
      }

      await docRef.update({
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
    } catch (error) {
      console.error(
        `Error processing document ${event.params.documentId}:`,
        error
      );
      await db
        .collection("documents")
        .doc(event.params.userId)
        .collection("userDocuments")
        .doc(event.params.documentId)
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

async function downloadFileFromStorage(storagePath: string): Promise<Buffer> {
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);
  const [fileBuffer] = await file.download();
  return fileBuffer;
}
