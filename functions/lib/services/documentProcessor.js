"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentProcessor = void 0;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
const jszip_1 = __importDefault(require("jszip"));
const firebase_functions_1 = require("firebase-functions");
class DocumentProcessor {
    /**
     * Extract text from PDF buffer using pdf-parse
     */
    async extractTextFromPDF(buffer) {
        try {
            const data = await (0, pdf_parse_1.default)(buffer);
            firebase_functions_1.logger.info(`Extracted text from PDF: ${data.numpages} pages, ${data.text.length} characters`);
            // Clean up the text
            const cleanedText = this.cleanExtractedText(data.text);
            return cleanedText;
        }
        catch (error) {
            firebase_functions_1.logger.error("Error extracting text from PDF:", error);
            throw new Error("Failed to extract text from PDF");
        }
    }
    /**
     * Extract text from DOCX buffer using mammoth
     */
    async extractTextFromDOCX(buffer) {
        var _a;
        try {
            const result = await mammoth_1.default.extractRawText({ buffer });
            const text = result.value || "";
            firebase_functions_1.logger.info(`Extracted text from DOCX: ${text.length} characters, messages: ${((_a = result === null || result === void 0 ? void 0 : result.messages) === null || _a === void 0 ? void 0 : _a.length) || 0}`);
            return this.cleanExtractedText(text);
        }
        catch (error) {
            firebase_functions_1.logger.error("Error extracting text from DOCX:", error);
            throw new Error("Failed to extract text from DOCX");
        }
    }
    /**
     * Dispatch extraction by mime/extension hint
     */
    async extractText(buffer, type) {
        if (type === "pdf")
            return this.extractTextFromPDF(buffer);
        if (type === "docx")
            return this.extractTextFromDOCX(buffer);
        throw new Error(`Unsupported document type for extraction: ${type}`);
    }
    /**
     * Extract text from PPTX buffer using pptx-parser + JSZip.
     * Adds slide boundaries like `--- Slide 3 ---` to preserve structure.
     */
    async extractTextFromPPTX(buffer) {
        try {
            const zip = await jszip_1.default.loadAsync(buffer);
            // ppt/slides/slideN.xml files contain slide text runs
            const slides = [];
            for (const path of Object.keys(zip.files)) {
                const m = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
                if (!m)
                    continue;
                const idx = Number(m[1]);
                const xml = await zip.files[path].async("string");
                slides.push({ index: idx, text: xml });
            }
            slides.sort((a, b) => a.index - b.index);
            // Extract plain text from slide XML (<a:t>text</a:t> nodes)
            const extractFromXml = (xml) => {
                const texts = [];
                const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
                let m;
                while ((m = regex.exec(xml)) !== null) {
                    const raw = m[1]
                        .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
                        .replace(/&amp;/g, "&")
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'");
                    texts.push(raw);
                }
                return texts.join(" ");
            };
            const parts = [];
            for (const s of slides) {
                try {
                    const txt = extractFromXml(s.text) || "";
                    let cleaned = txt
                        .replace(/\s+/g, " ") // collapse whitespace
                        .replace(/\bSlide\s+\d+\b/gi, "") // drop literal slide labels if present
                        .replace(/©\s*\d{4}.+?$/gm, "") // common footer patterns (best-effort)
                        .trim();
                    // Merge very short lines by normalizing spaces already; keep paragraph breaks minimal
                    if (cleaned) {
                        parts.push(`--- Slide ${s.index} ---\n${cleaned}`);
                    }
                }
                catch (e) {
                    firebase_functions_1.logger.warn("pptx slide parse failed", { slide: s.index, e });
                }
            }
            const joined = parts.join("\n\n");
            const finalText = this.cleanExtractedText(joined);
            firebase_functions_1.logger.info(`Extracted text from PPTX: ${finalText.length} characters, slides: ${slides.length}`);
            return finalText;
        }
        catch (error) {
            firebase_functions_1.logger.error("Error extracting text from PPTX:", error);
            throw new Error("Failed to extract text from PPTX");
        }
    }
    /**
     * Clean extracted text by removing excessive whitespace and formatting
     */
    cleanExtractedText(text) {
        return (text
            // Remove excessive whitespace
            .replace(/\s+/g, " ")
            // Remove page breaks and form feeds
            .replace(/\f/g, " ")
            // Remove excessive newlines
            .replace(/\n\s*\n/g, "\n")
            // Trim whitespace
            .trim());
    }
    /**
     * Chunk text into smaller pieces with overlap
     * @param text - The text to chunk
     * @param chunkSize - Size of each chunk in words
     * @param overlap - Number of overlapping words between chunks
     */
    chunkText(text, chunkSize = 800, overlap = 100) {
        const words = text.split(/\s+/);
        const chunks = [];
        let start = 0;
        while (start < words.length) {
            const end = Math.min(start + chunkSize, words.length);
            const chunk = words.slice(start, end).join(" ");
            if (chunk.trim().length > 0) {
                chunks.push(chunk.trim());
            }
            // Move start position with overlap
            start = end - overlap;
            // Prevent infinite loop if overlap is too large
            if (start <= 0 && end >= words.length) {
                break;
            }
            if (start >= end) {
                start = end;
            }
        }
        firebase_functions_1.logger.info(`Created ${chunks.length} chunks from ${words.length} words`);
        return chunks;
    }
    /**
     * Get text statistics
     */
    getTextStats(text) {
        return {
            characterCount: text.length,
            wordCount: text.split(/\s+/).length,
            paragraphCount: text.split(/\n\s*\n/).length,
        };
    }
}
exports.DocumentProcessor = DocumentProcessor;
//# sourceMappingURL=documentProcessor.js.map