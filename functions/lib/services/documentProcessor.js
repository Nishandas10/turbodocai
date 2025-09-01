"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentProcessor = void 0;
const pdf_parse_1 = __importDefault(require("pdf-parse"));
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