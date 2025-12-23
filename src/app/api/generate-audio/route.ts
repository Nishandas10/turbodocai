import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GenerateAudioRequestBody = {
  /** Full podcast script (plain text). */
  script: string;
  /** Optional stable key for caching/reuse on client. */
  key?: string;
};

function getAiStudioApiKey(): string {
  // Common env var names; keep compatibility with existing repo.
  const key =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ??
    process.env.GEMINI_API_KEY ??
    process.env.GOOGLE_API_KEY;
  if (!key) {
    throw new Error(
      "Missing Gemini API key. Set GOOGLE_GENERATIVE_AI_API_KEY in your environment."
    );
  }
  return key;
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { mimeType?: string; data?: string };
        text?: string;
      }>;
    };
  }>;
  promptFeedback?: unknown;
};

function parseMimeParams(mime: string): {
  type: string;
  params: Record<string, string>;
} {
  const [typePart, ...rest] = mime.split(";").map((s) => s.trim());
  const params: Record<string, string> = {};
  for (const p of rest) {
    const [k, v] = p.split("=").map((s) => s.trim());
    if (k && v) params[k.toLowerCase()] = v;
  }
  return { type: typePart.toLowerCase(), params };
}

function pcm16ToWavBuffer(
  pcm: Buffer,
  opts: { sampleRate: number; channels: number }
): Buffer {
  // Minimal WAV (RIFF) wrapper for PCM16 LE.
  const sampleRate = opts.sampleRate;
  const channels = opts.channels;
  const bitsPerSample = 16;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);

  const dataSize = pcm.length;
  const riffSize = 36 + dataSize;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(riffSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // Audio format 1=PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

function hasMultiSpeakerLabels(text: string): boolean {
  // Minimal heuristic: both speakers appear at least once.
  // Multi-speaker mode requires that speaker names in the prompt match speechConfig speakers.
  return (
    /(^|\n)\s*Speaker 1\s*:/i.test(text) && /(^|\n)\s*Speaker 2\s*:/i.test(text)
  );
}

function normalizeScriptForTts(scriptChunk: string): string {
  // If the script doesn't already contain multi-speaker labels, treat it as narration.
  // IMPORTANT: Do not ask the model to rewrite/convert content; TTS models must only synthesize.
  return (scriptChunk ?? "").trim();
}

async function ttsChunkToAudio(
  scriptChunk: string,
  opts: { languageCode?: string; useMultiSpeaker?: boolean }
): Promise<{ bytes: Buffer; mimeType: string }> {
  const apiKey = getAiStudioApiKey();
  const model = "gemini-2.5-flash-preview-tts";

  // Gemini REST: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;

  const normalized = normalizeScriptForTts(scriptChunk);

  // For multi-speaker, the transcript MUST already contain speaker labels
  // matching the configured speaker names.
  const allowMultiSpeaker = opts.useMultiSpeaker ?? false;
  const useMultiSpeaker =
    allowMultiSpeaker && hasMultiSpeakerLabels(normalized);

  const languageCode = opts.languageCode ?? "en-US";

  const speechConfig = useMultiSpeaker
    ? {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: [
            {
              speaker: "Speaker 1",
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Kore" },
              },
            },
            {
              speaker: "Speaker 2",
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: "Puck" },
              },
            },
          ],
        },
        languageCode,
      }
    : {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" },
        },
        languageCode,
      };

  // TTS-only instruction: never ask the model to transform the text.
  // The error you're seeing (400) occurs when the TTS model thinks it's asked to generate text.
  const prompt =
    `Text-to-speech only. Output AUDIO only. Do NOT generate any text.\n` +
    `Speak exactly the following transcript.\n\n` +
    normalized;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error("[TTS] Error response body:", txt);
    // Bubble the upstream error JSON from Gemini when available.
    throw new Error(`Gemini TTS request failed (${res.status}). ${txt}`.trim());
  }

  const data = (await res.json()) as GeminiGenerateContentResponse;

  const inline = data?.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData
  )?.inlineData;
  const b64 = inline?.data;
  const mime = (inline?.mimeType ?? "").trim();

  if (!b64) {
    console.error("[TTS] No audio data in response!");
    console.error(
      "[TTS] Full response structure:",
      JSON.stringify(data, null, 2)
    );
    throw new Error(
      "Gemini TTS did not return audio inlineData. Check prompt/speechConfig/model availability."
    );
  }

  if (mime && !mime.toLowerCase().startsWith("audio/")) {
    console.error("[TTS] Unexpected MIME type:", mime);
    throw new Error(`Unexpected audio mimeType: ${mime}`);
  }

  const raw = Buffer.from(b64, "base64");

  // Gemini TTS currently returns PCM (audio/L16;codec=pcm;rate=24000) for this model.
  // Browsers can't play raw L16 PCM, so we wrap it into a WAV container.
  const normalizedMime = mime ? parseMimeParams(mime).type : "";
  if (normalizedMime === "audio/l16") {
    const { params } = parseMimeParams(mime);
    const rate = Number(params["rate"] ?? "24000") || 24000;
    const wav = pcm16ToWavBuffer(raw, { sampleRate: rate, channels: 1 });
    return { bytes: wav, mimeType: "audio/wav" };
  }

  // If the API ever returns MP3 (audio/mpeg), pass it through.
  return { bytes: raw, mimeType: mime || "application/octet-stream" };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateAudioRequestBody;
    const script = (body?.script ?? "").toString();

    if (!script.trim()) {
      return NextResponse.json(
        { success: false, error: "Missing script" },
        { status: 400 }
      );
    }

    // Single-call generation: request one audio file for the entire script.
    // This avoids invalid MP3 streams created by naive concatenation.
    const audio = await ttsChunkToAudio(script, {
      languageCode: "en-US",
      useMultiSpeaker: true,
    });

    // NextResponse expects a Web BodyInit type; use Uint8Array to avoid TS mismatch with Node Buffer.
    return new NextResponse(new Uint8Array(audio.bytes), {
      status: 200,
      headers: {
        "Content-Type": audio.mimeType,
        "Content-Length": audio.bytes.length.toString(),
        "Cache-Control": "no-store",
        // Helps browsers stream playback.
        "Accept-Ranges": "bytes",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
