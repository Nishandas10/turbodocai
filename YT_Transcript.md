/\*\*

- Firebase Function: getTranscript
- Description:
- - Fetches YouTube transcript via TranscriptAPI
- - Caches transcript in Firestore to save credits
-
- Environment Variable:
- - transcriptapi.key = your TranscriptAPI key
-
- Example Usage:
- GET /transcript?video=https://youtu.be/dQw4w9WgXcQ
  \*/

import _ as functions from "firebase-functions";
import _ as admin from "firebase-admin";

admin.initializeApp();

const db = admin.firestore();
const API_BASE = "https://transcriptapi.com/api/v2/youtube/transcript";

interface TranscriptSegment {
text: string;
start?: number;
duration?: number;
}

interface TranscriptResponse {
video_id: string;
language: string;
transcript: TranscriptSegment[];
metadata?: {
title?: string;
author_name?: string;
author_url?: string;
thumbnail_url?: string;
};
}

export const getTranscript = functions.https.onRequest(async (req, res) => {
try {
const videoUrl = req.query.video as string;
if (!videoUrl) {
res.status(400).json({ error: "Missing ?video parameter" });
return;
}

    // Extract YouTube video ID (handle full URL or short URL)
    const videoId = extractVideoId(videoUrl);
    if (!videoId) {
      res.status(422).json({ error: "Invalid YouTube video URL or ID" });
      return;
    }

    const docRef = db.collection("youtube_transcripts").doc(videoId);
    const docSnap = await docRef.get();

    // ✅ Use cached transcript if available
    if (docSnap.exists) {
      const cached = docSnap.data();
      res.status(200).json({
        source: "cache",
        ...cached,
      });
      return;
    }

    // Fetch from TranscriptAPI
    const transcriptData = await fetchTranscriptFromAPI(videoUrl);

    // Save to Firestore cache
    await docRef.set({
      ...transcriptData,
      cached_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    res.status(200).json({
      source: "api",
      ...transcriptData,
    });

} catch (error: any) {
console.error("Transcript fetch failed:", error);
res.status(500).json({ error: error.message || "Internal Server Error" });
}
});

/\*\*

- Fetches YouTube transcript via TranscriptAPI
  \*/
  async function fetchTranscriptFromAPI(videoUrl: string): Promise<TranscriptResponse> {
  const API_KEY =
  process.env.TRANSCRIPT_API_KEY ||
  functions.config().transcriptapi?.key ||
  "";

if (!API_KEY) throw new Error("Missing TranscriptAPI key in environment");

const url = `${API_BASE}?video_url=${encodeURIComponent(
    videoUrl
  )}&format=json&include_timestamp=true&send_metadata=true`;

const res = await fetch(url, {
headers: { Authorization: `Bearer ${API_KEY}` },
});

if (res.status === 402)
throw new Error("Payment Required: Out of credits or inactive plan");
if (res.status === 429)
throw new Error("Rate limit exceeded. Try again later.");
if (!res.ok) {
const errText = await res.text();
throw new Error(`TranscriptAPI Error (${res.status}): ${errText}`);
}

const data = (await res.json()) as TranscriptResponse;
return data;
}

/\*\*

- Extracts YouTube video ID from URL or raw ID
  \*/
  function extractVideoId(input: string): string | null {
  const idPattern = /^[a-zA-Z0-9_-]{11}$/;
  const match =
  input.match(idPattern) ||
  input.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
  input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  return match ? (match[1] || match[0]) : null;
  }
