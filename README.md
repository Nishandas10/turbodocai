This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## YouTube RAG pipeline

- Submit a YouTube URL via the UI (YouTube modal). This creates a Firestore document of type `youtube` with the URL.
- A Cloud Function fetches the transcript using the Transcript API and stores the full text at `transcripts/{userId}/{documentId}.txt` in Firebase Storage.
- The transcript text is uploaded to the OpenAI Vector Store for retrieval-augmented QA and summaries.
- You can then use existing actions to generate on demand:
  - Summaries
  - Chat with the video (RAG)
  - Podcasts (TTS summary)
  - Flashcards
  - Quiz questions

Environment variables:

```
TRANSCRIPT_API_KEY=... # required
# Optional override (defaults to https://api.transcriptapi.com/v1/youtube/transcript)
TRANSCRIPT_API_BASE=https://your-transcript-api-base
```

## Image OCR + RAG Pipeline

You can upload images or take camera snapshots. These are stored under:

```
users/{userId}/images/{documentId}.{ext}
users/{userId}/images/snapshots/{documentId}.jpg (camera snapshots)
```

Flow:

1. Client creates Firestore doc with `type: "image"` via `uploadImageFile` or `uploadCameraSnapshot` (see `src/lib/fileUploadService.ts`).
2. After upload, `metadata.storagePath` is set; the `processDocument` Cloud Function detects a new image document.
3. The function downloads the image and performs OCR using OpenAI `gpt-4o-mini` vision (Responses API with chat completion fallback).
4. Extracted text is cleaned and saved:

- Full text stored at `transcripts/{userId}/{documentId}.txt` in Firebase Storage.
- A preview (first 200k chars) stored inline in Firestore `content.raw`.
- Vector indexing: the entire OCR text is uploaded as a single file to the configured OpenAI Vector Store. Metadata stored at `metadata.openaiVector`.

5. Once processing completes (`processingStatus: "completed"`), you can:

- Chat with the image text (`sendChatMessage` with the documentId in `contextDocIds`).
- Generate a summary, flashcards, quiz, or a podcast using existing callable functions.

No separate OCR service or dependency is required; OpenAI vision handles extraction. If OCR fails, the document is marked `processingStatus: failed` with `processingError` for user feedback.

## Audio transcription pipeline

You can upload audio files. These are stored under user document storage paths and picked up by the `processDocument` Cloud Function with `type: "audio"`.

Behavior:

- Uses OpenAI `gpt-4o-mini-transcribe` exclusively. The prior fallback to `whisper-1` has been removed to avoid minute-long delays when switching models.
- Duration-aware chunking: if the input is longer than 1400 seconds (~23m 20s) or the raw upload exceeds ~24MB, the function transparently chunks the audio with ffmpeg (mono, 16kHz, 32kbps; ~15-minute segments) and transcribes sequentially. Progress updates are reflected in Firestore `processingProgress`.
- The concatenated transcript is cleaned via the TXT pipeline and persisted the same way as other text sources.

Notes:

- ffmpeg is bundled via `ffmpeg-static`. If probing or segmentation fails, the function surfaces an error and marks the document as failed.
