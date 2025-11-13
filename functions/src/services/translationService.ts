import { OpenAI } from "openai";
import { logger } from "firebase-functions";

/** Lightweight language detection + English normalizer for large texts.
 * - Detects language using franc-min (iso639-3)
 * - If not English, translates in chunks via OpenAI gpt-4o-mini
 */
export class TranslationService {
  private openai: OpenAI;
  private maxChunkWords: number;
  private chunkOverlapWords: number;

  constructor(opts?: { maxChunkWords?: number; chunkOverlapWords?: number }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      throw new Error("OPENAI_API_KEY environment variable is not set");
    this.openai = new OpenAI({ apiKey });
    this.maxChunkWords = opts?.maxChunkWords ?? 1200; // ~1-2k tokens each
    this.chunkOverlapWords = opts?.chunkOverlapWords ?? 80;
  }

  /** Detect language using franc-min (ESM-only). Uses dynamic import to work in CJS. Returns iso639-1 if known, else iso639-3 code. */
  async detectLanguage(
    text: string
  ): Promise<{ lang: string; confidence: number }> {
    try {
      const sample = String(text || "").slice(0, 2000); // speed + enough signal
      if (!sample.trim()) return { lang: "und", confidence: 0 };
      const mod: any = await import("franc-min");
      const franc = mod.franc || mod.default || mod;
      const iso3 = franc(sample); // 'eng', 'spa', 'und'
      const iso1 = this.iso3to1(iso3);
      return {
        lang: iso1 || iso3 || "und",
        confidence: iso3 === "und" ? 0 : 0.9,
      };
    } catch (e) {
      logger.warn("detectLanguage failed; defaulting to 'und'", e as any);
      return { lang: "und", confidence: 0 };
    }
  }

  /** Ensure English text: if detected language is English, returns original; otherwise translates in chunks. */
  async ensureEnglish(text: string): Promise<{
    englishText: string;
    detectedLang: string;
    translated: boolean;
  }> {
    const { lang } = await this.detectLanguage(text);
    if (lang === "en") {
      return { englishText: text, detectedLang: "en", translated: false };
    }

    // Translate in chunks to stay under token limits and reduce cost
    const chunks = this.chunkByWords(
      text,
      this.maxChunkWords,
      this.chunkOverlapWords
    );
    logger.info("Translating transcript chunks", {
      chunks: chunks.length,
      lang,
    });

    const translatedParts: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const part = chunks[i];
      try {
        const out = await this.translateToEnglish(part);
        translatedParts.push(out);
        // brief pacing to respect rate limits; cheap and avoids concurrency spikes
        if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 150));
      } catch (err) {
        logger.warn("Chunk translation failed, keeping original chunk", {
          index: i,
          err,
        });
        // Fallback: keep original chunk to avoid losing content
        translatedParts.push(part);
      }
    }

    // Merge and lightly de-duplicate overlap by favoring translated content
    const englishText = this.mergeChunks(translatedParts);
    return { englishText, detectedLang: lang, translated: true };
  }

  /** Translate a single chunk to English using gpt-4o-mini. */
  private async translateToEnglish(text: string): Promise<string> {
    const prompt = `Translate the following transcript into natural English. Preserve the meaning and as much structure as possible. Return only the translated English text with no commentary.\n\n${text}`;
    const resp = await this.openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional translator. Be faithful to the original meaning, concise, and keep paragraph breaks. Do not add explanations.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.1,
      max_tokens: 1200,
    });
    const out = resp.choices?.[0]?.message?.content || "";
    return String(out).trim();
  }

  /** Simple word-based chunker for large text. */
  private chunkByWords(text: string, size: number, overlap: number): string[] {
    const words = String(text || "").split(/\s+/);
    const chunks: string[] = [];
    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + size, words.length);
      const chunk = words.slice(start, end).join(" ").trim();
      if (chunk) chunks.push(chunk);
      if (end >= words.length) break;
      start = Math.max(0, end - overlap);
      if (start >= end) break;
    }
    return chunks;
  }

  /** Merge chunks by joining with double newlines; callers already keep overlaps small */
  private mergeChunks(parts: string[]): string {
    return parts.join("\n\n");
  }

  /** Minimal iso639-3 -> iso639-1 mapping for common languages */
  private iso3to1(iso3?: string | null): string | undefined {
    const m: Record<string, string> = {
      eng: "en",
      spa: "es",
      fra: "fr",
      fre: "fr",
      deu: "de",
      ger: "de",
      ita: "it",
      por: "pt",
      rus: "ru",
      zho: "zh",
      cmn: "zh",
      jpn: "ja",
      hin: "hi",
      ara: "ar",
      ben: "bn",
      urd: "ur",
      tam: "ta",
      tel: "te",
      mar: "mr",
      guj: "gu",
      mal: "ml",
      pan: "pa",
      vie: "vi",
      kor: "ko",
      tur: "tr",
      ukr: "uk",
      pol: "pl",
      ind: "id",
      nld: "nl",
      swe: "sv",
      fin: "fi",
      nor: "no",
      Dan: "da",
    };
    const k = String(iso3 || "").toLowerCase();
    return m[k];
  }
}
