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
const article_extractor_1 = require("@extractus/article-extractor");
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
     * Extract text and metadata from PDF using pdf-parse
     * Returns both the extracted text and page count for scanned PDF detection
     */
    async extractTextFromPDFWithMetadata(buffer) {
        try {
            const data = await (0, pdf_parse_1.default)(buffer);
            firebase_functions_1.logger.info(`Extracted text from PDF: ${data.numpages} pages, ${data.text.length} characters`);
            // Clean up the text
            const cleanedText = this.cleanExtractedText(data.text);
            return {
                text: cleanedText,
                pageCount: data.numpages,
            };
        }
        catch (error) {
            firebase_functions_1.logger.error("Error extracting text from PDF:", error);
            throw new Error("Failed to extract text from PDF");
        }
    }
    /**
     * Check if a PDF is likely scanned/handwritten by analyzing the text extraction quality
     * @param extractedText - Text extracted via pdf-parse
     * @param pageCount - Number of pages in the PDF
     * @returns true if the PDF appears to be scanned/handwritten
     */
    isScannedOrHandwritten(extractedText, pageCount) {
        // If extracted text is too short relative to page count, likely scanned
        const avgCharsPerPage = extractedText.length / pageCount;
        // Typical text-based PDFs have at least 500-1000 chars per page
        // Scanned PDFs will have very little to no text
        const MIN_CHARS_PER_PAGE = 100;
        if (avgCharsPerPage < MIN_CHARS_PER_PAGE) {
            firebase_functions_1.logger.info(`PDF appears to be scanned: ${avgCharsPerPage.toFixed(0)} chars/page (threshold: ${MIN_CHARS_PER_PAGE})`);
            return true;
        }
        // Check for common OCR artifacts or gibberish
        const hasLowTextQuality = this.checkTextQuality(extractedText);
        if (hasLowTextQuality) {
            firebase_functions_1.logger.info("PDF has low text quality, likely scanned");
            return true;
        }
        firebase_functions_1.logger.info(`PDF appears to be text-based: ${avgCharsPerPage.toFixed(0)} chars/page`);
        return false;
    }
    /**
     * Check if extracted text appears to be low quality or gibberish
     */
    checkTextQuality(text) {
        var _a;
        if (!text || text.trim().length < 50)
            return true;
        // Calculate ratio of alphanumeric characters to total characters
        const alphanumeric = ((_a = text.match(/[a-zA-Z0-9]/g)) === null || _a === void 0 ? void 0 : _a.length) || 0;
        const total = text.length;
        const alphanumericRatio = alphanumeric / total;
        // If less than 50% alphanumeric, likely low quality
        if (alphanumericRatio < 0.5) {
            return true;
        }
        return false;
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
     * Extract text from plain TXT buffer (UTF-8 assumed)
     */
    async extractTextFromTXT(buffer) {
        try {
            const text = buffer.toString("utf8");
            const cleaned = this.cleanExtractedText(text || "");
            firebase_functions_1.logger.info(`Extracted text from TXT: ${cleaned.length} characters`);
            return cleaned;
        }
        catch (error) {
            firebase_functions_1.logger.error("Error extracting text from TXT:", error);
            throw new Error("Failed to extract text from TXT");
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
        if (type === "text")
            return this.extractTextFromTXT(buffer);
        throw new Error(`Unsupported document type for extraction: ${type}`);
    }
    /**
     * Extract main article text from a webpage URL using @extractus/article-extractor.
     * Strips HTML, normalizes whitespace, and returns cleaned text.
     */
    async extractTextFromURL(url) {
        try {
            // Basic validation
            let u;
            try {
                u = new URL(String(url));
                if (!/^https?:$/i.test(u.protocol))
                    throw new Error("Invalid protocol");
            }
            catch (e) {
                throw new Error("Invalid URL provided");
            }
            const article = await (0, article_extractor_1.extract)(u.toString());
            if (!article)
                throw new Error("Could not extract article content");
            const html = String(article.content || "");
            const rawText = String(article.text || "");
            const title = article.title;
            // Prefer provided text if present; otherwise strip HTML
            let text = rawText && rawText.trim().length > 80 ? rawText : this.stripHtml(html);
            text = this.cleanExtractedText(text);
            // Extra cleanup: drop very short fragments that are likely nav/boilerplate
            text = this.dropShortFragments(text, 24);
            if (!text || text.length < 80) {
                throw new Error("No meaningful text extracted from webpage");
            }
            firebase_functions_1.logger.info("Extracted article from URL", {
                url: u.hostname,
                title: title || "(untitled)",
                length: text.length,
            });
            return { title, text };
        }
        catch (error) {
            firebase_functions_1.logger.error("Error extracting text from URL:", error);
            throw new Error("Failed to extract text from URL");
        }
    }
    /**
     * Best-effort HTML stripping without extra deps
     */
    stripHtml(html) {
        if (!html)
            return "";
        // Remove scripts/styles
        let s = html
            .replace(/<script[\s\S]*?<\/script>/gi, " ")
            .replace(/<style[\s\S]*?<\/style>/gi, " ");
        // Remove all tags
        s = s.replace(/<[^>]+>/g, " ");
        // Decode a few common entities
        s = s
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
        return s;
    }
    /**
     * Remove overly short lines/fragments that look like nav or boilerplate
     */
    dropShortFragments(text, minLen) {
        const lines = text
            .split(/\n+/)
            .map((l) => l.trim())
            .filter(Boolean);
        const kept = [];
        for (const l of lines) {
            // keep headings and paragraphs; drop tiny crumbs
            if (l.length >= minLen ||
                /\b(abstract|summary|introduction|conclusion|references)\b/i.test(l)) {
                kept.push(l);
            }
        }
        return kept.join("\n");
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