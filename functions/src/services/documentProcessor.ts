import pdf from "pdf-parse";
import { logger } from "firebase-functions";

export class DocumentProcessor {
  /**
   * Extract text from PDF buffer using pdf-parse
   */
  async extractTextFromPDF(buffer: Buffer): Promise<string> {
    try {
      const data = await pdf(buffer);

      logger.info(
        `Extracted text from PDF: ${data.numpages} pages, ${data.text.length} characters`
      );

      // Clean up the text
      const cleanedText = this.cleanExtractedText(data.text);

      return cleanedText;
    } catch (error) {
      logger.error("Error extracting text from PDF:", error);
      throw new Error("Failed to extract text from PDF");
    }
  }

  /**
   * Clean extracted text by removing excessive whitespace and formatting
   */
  private cleanExtractedText(text: string): string {
    return (
      text
        // Remove excessive whitespace
        .replace(/\s+/g, " ")
        // Remove page breaks and form feeds
        .replace(/\f/g, " ")
        // Remove excessive newlines
        .replace(/\n\s*\n/g, "\n")
        // Trim whitespace
        .trim()
    );
  }

  /**
   * Chunk text into smaller pieces with overlap
   * @param text - The text to chunk
   * @param chunkSize - Size of each chunk in words
   * @param overlap - Number of overlapping words between chunks
   */
  chunkText(
    text: string,
    chunkSize: number = 800,
    overlap: number = 100
  ): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];

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

    logger.info(`Created ${chunks.length} chunks from ${words.length} words`);

    return chunks;
  }

  /**
   * Get text statistics
   */
  getTextStats(text: string): {
    characterCount: number;
    wordCount: number;
    paragraphCount: number;
  } {
    return {
      characterCount: text.length,
      wordCount: text.split(/\s+/).length,
      paragraphCount: text.split(/\n\s*\n/).length,
    };
  }
}
