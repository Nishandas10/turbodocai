import { onCall } from "firebase-functions/v2/https";
import OpenAI from "openai";
import { storage, db } from "../config/firebase";

export const generatePodcast = onCall(
  { enforceAppCheck: false },
  async (request) => {
    try {
      const { documentId, userId, voice, force } = request.data || {};
      if (!documentId || !userId)
        throw new Error("Missing required parameters: documentId and userId");

      const dbRef = db
        .collection("documents")
        .doc(userId)
        .collection("userDocuments")
        .doc(documentId)
        .collection("aiArtifacts")
        .doc("podcast_v1");

      if (!force) {
        const cache = await dbRef.get();
        if (cache.exists) {
          const data = cache.data() as any;
          const audioPath: string | undefined = data?.audioPath;
          if (audioPath) {
            const file = storage.bucket().file(audioPath);
            const [exists] = await file.exists();
            if (exists) {
              let token: string | undefined = data?.downloadToken;
              const [meta] = await file.getMetadata();
              const bucketName = storage.bucket().name;
              const metaToken =
                (meta?.metadata?.firebaseStorageDownloadTokens as string) || "";
              if (!token) token = metaToken?.split(",")[0] || undefined;
              if (!token) {
                token = crypto.randomUUID();
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

      // Fetch or generate a summary (lightweight: let client ensure availability or call separate summary function)
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
      } catch {}

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const ttsModel = "gpt-4o-mini-tts";
      const ttsVoice =
        typeof voice === "string" && voice.trim() ? voice.trim() : "alloy";
      const ttsInput = (
        summary ||
        "Here is an auto generated podcast for your document summary."
      )
        .trim()
        .slice(0, 4000);

      const speech = await openai.audio.speech.create({
        model: ttsModel,
        voice: ttsVoice as any,
        input: ttsInput,
      });
      const arrayBuf = await speech.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      const audioPath = `podcasts/${userId}/${documentId}/${ttsVoice}.mp3`;
      const file = storage.bucket().file(audioPath);
      await file.save(buffer, { contentType: "audio/mpeg", resumable: false });
      const token = crypto.randomUUID();
      await file.setMetadata({
        cacheControl: "public, max-age=3600",
        metadata: { firebaseStorageDownloadTokens: token },
        contentType: "audio/mpeg",
      });
      const bucketName = storage.bucket().name;
      const mediaUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
        audioPath
      )}?alt=media&token=${token}`;

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
      console.error("Error in generatePodcast:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);
