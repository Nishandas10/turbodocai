"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationService = void 0;
const openai_1 = require("openai");
const firebase_functions_1 = require("firebase-functions");
/** Lightweight language detection + English normalizer for large texts.
 * - Detects language using franc-min (iso639-3)
 * - If not English, translates in chunks via OpenAI gpt-4o-mini
 */
class TranslationService {
    constructor(opts) {
        var _a, _b;
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey)
            throw new Error("OPENAI_API_KEY environment variable is not set");
        this.openai = new openai_1.OpenAI({ apiKey });
        this.maxChunkWords = (_a = opts === null || opts === void 0 ? void 0 : opts.maxChunkWords) !== null && _a !== void 0 ? _a : 1200; // ~1-2k tokens each
        this.chunkOverlapWords = (_b = opts === null || opts === void 0 ? void 0 : opts.chunkOverlapWords) !== null && _b !== void 0 ? _b : 80;
    }
    /** Detect language using franc-min (ESM-only). Uses dynamic import to work in CJS. Returns iso639-1 if known, else iso639-3 code. */
    async detectLanguage(text) {
        try {
            const sample = String(text || "").slice(0, 2000); // speed + enough signal
            if (!sample.trim())
                return { lang: "und", confidence: 0 };
            const mod = await Promise.resolve().then(() => __importStar(require("franc-min")));
            const franc = mod.franc || mod.default || mod;
            const iso3 = franc(sample); // 'eng', 'spa', 'und'
            const iso1 = this.iso3to1(iso3);
            return {
                lang: iso1 || iso3 || "und",
                confidence: iso3 === "und" ? 0 : 0.9,
            };
        }
        catch (e) {
            firebase_functions_1.logger.warn("detectLanguage failed; defaulting to 'und'", e);
            return { lang: "und", confidence: 0 };
        }
    }
    /** Ensure English text: if detected language is English, returns original; otherwise translates in chunks. */
    async ensureEnglish(text) {
        const { lang } = await this.detectLanguage(text);
        if (lang === "en") {
            return { englishText: text, detectedLang: "en", translated: false };
        }
        // Translate in chunks to stay under token limits and reduce cost
        const chunks = this.chunkByWords(text, this.maxChunkWords, this.chunkOverlapWords);
        firebase_functions_1.logger.info("Translating transcript chunks", {
            chunks: chunks.length,
            lang,
        });
        const translatedParts = [];
        for (let i = 0; i < chunks.length; i++) {
            const part = chunks[i];
            try {
                const out = await this.translateToEnglish(part);
                translatedParts.push(out);
                // brief pacing to respect rate limits; cheap and avoids concurrency spikes
                if (i < chunks.length - 1)
                    await new Promise((r) => setTimeout(r, 150));
            }
            catch (err) {
                firebase_functions_1.logger.warn("Chunk translation failed, keeping original chunk", {
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
    async translateToEnglish(text) {
        var _a, _b, _c;
        const prompt = `Translate the following transcript into natural English. Preserve the meaning and as much structure as possible. Return only the translated English text with no commentary.\n\n${text}`;
        const resp = await this.openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are a professional translator. Be faithful to the original meaning, concise, and keep paragraph breaks. Do not add explanations.",
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.1,
            max_tokens: 1200,
        });
        const out = ((_c = (_b = (_a = resp.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || "";
        return String(out).trim();
    }
    /** Simple word-based chunker for large text. */
    chunkByWords(text, size, overlap) {
        const words = String(text || "").split(/\s+/);
        const chunks = [];
        let start = 0;
        while (start < words.length) {
            const end = Math.min(start + size, words.length);
            const chunk = words.slice(start, end).join(" ").trim();
            if (chunk)
                chunks.push(chunk);
            if (end >= words.length)
                break;
            start = Math.max(0, end - overlap);
            if (start >= end)
                break;
        }
        return chunks;
    }
    /** Merge chunks by joining with double newlines; callers already keep overlaps small */
    mergeChunks(parts) {
        return parts.join("\n\n");
    }
    /** Minimal iso639-3 -> iso639-1 mapping for common languages */
    iso3to1(iso3) {
        const m = {
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
exports.TranslationService = TranslationService;
//# sourceMappingURL=translationService.js.map