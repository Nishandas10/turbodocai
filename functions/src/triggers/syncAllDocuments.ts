import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { db } from "../config/firebase";
import { EmbeddingService } from "../services/embeddingService";
import { TOPICS, TOPIC_DESCRIPTIONS } from "../utils/topics";
import { cosineSim } from "../utils/similarity";
import { selectDocTextForClassification, mergeTags } from "../utils/text";

let cachedTopicEmbeddings: { labels: string[]; vectors: number[][] } | null =
  null;

async function getTopicEmbeddings(embeddingService: EmbeddingService) {
  if (cachedTopicEmbeddings) return cachedTopicEmbeddings;
  try {
    const inputs = TOPICS.map((t) => `${t}: ${TOPIC_DESCRIPTIONS[t] || t}`);
    const vectors = await embeddingService.embedChunks(inputs);
    cachedTopicEmbeddings = { labels: TOPICS.slice(), vectors };
    return cachedTopicEmbeddings;
  } catch (err) {
    console.warn(
      "Failed to precompute topic embeddings; classification disabled",
      err
    );
    cachedTopicEmbeddings = { labels: TOPICS.slice(), vectors: [] };
    return cachedTopicEmbeddings;
  }
}

async function classifyTopics(
  data: Record<string, any>,
  embeddingService: EmbeddingService
): Promise<string[]> {
  try {
    const text = selectDocTextForClassification(data);
    if (!text || text.length < 10) return [];
    const topicEmb = await getTopicEmbeddings(embeddingService);
    if (!topicEmb.vectors.length) return [];
    const docVec = await embeddingService.embedQuery(text);
    const scores = topicEmb.vectors.map((v, i) => ({
      label: topicEmb.labels[i],
      score: cosineSim(docVec, v),
    }));
    scores.sort((a, b) => b.score - a.score);
    const threshold = 0.25;
    const top = scores.filter((s) => s.score >= threshold).slice(0, 3);
    if (top.length) return top.map((t) => t.label);
    return scores.slice(0, 1).map((s) => s.label);
  } catch (err) {
    console.warn("Topic classification failed", err);
    return [];
  }
}

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

    if (!afterSnap?.exists && beforeSnap?.exists) {
      try {
        await allRef.delete();
      } catch {}
      return;
    }

    if (!beforeSnap?.exists && afterSnap?.exists) {
      const data = (afterSnap.data() as Record<string, any>) || undefined;
      if (!data) return;
      try {
        const embeddingService = new EmbeddingService();
        const topics = await classifyTopics(data, embeddingService);
        let keywordEmbedding: number[] | undefined = undefined;
        try {
          const text = selectDocTextForClassification(data);
          if (text && text.length > 10) {
            keywordEmbedding = await embeddingService.embedQuery(text);
          }
        } catch {}
        const payload = {
          ...data,
          tags: mergeTags(data.tags, topics),
          ...(keywordEmbedding ? { keywordEmbedding } : {}),
          updatedAt: new Date(),
        } as Record<string, any>;
        await allRef.set(payload, { merge: false });
      } catch (err) {
        console.error("Failed to create mirror doc in allDocuments", {
          mirrorId,
          err,
        });
      }
      return;
    }

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
        let payload: Record<string, any> = { updatedAt: new Date() };
        if (beforePublic !== afterPublic) payload.isPublic = afterPublic;
        if (shouldReclassify) {
          try {
            const embeddingService = new EmbeddingService();
            const topics = await classifyTopics(after, embeddingService);
            payload.tags = mergeTags(
              mirrorExists ? (mirrorSnap.data() as any)?.tags : after.tags,
              topics
            );
            try {
              const text = selectDocTextForClassification(after);
              if (text && text.length > 10) {
                payload.keywordEmbedding = await embeddingService.embedQuery(
                  text
                );
              }
            } catch {}
          } catch {}
        }
        if (!mirrorExists)
          await allRef.set({ ...after, ...payload }, { merge: false });
        else if (Object.keys(payload).length > 0)
          await allRef.set(payload, { merge: true });
      } catch (err) {
        console.error("Failed to update mirror in allDocuments", {
          mirrorId,
          err,
        });
      }
    }
  }
);
