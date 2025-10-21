import pdf from "pdf-parse";
import mammoth from "mammoth";
import JSZip from "jszip";
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
   * Extract text from DOCX buffer using mammoth
   */
  async extractTextFromDOCX(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value || "";
      logger.info(
        `Extracted text from DOCX: ${text.length} characters, messages: ${
          (result as any)?.messages?.length || 0
        }`
      );
      return this.cleanExtractedText(text);
    } catch (error) {
      logger.error("Error extracting text from DOCX:", error);
      throw new Error("Failed to extract text from DOCX");
    }
  }

  /**
   * Extract text from plain TXT buffer (UTF-8 assumed)
   */
  async extractTextFromTXT(buffer: Buffer): Promise<string> {
    try {
      const text = buffer.toString("utf8");
      const cleaned = this.cleanExtractedText(text || "");
      logger.info(`Extracted text from TXT: ${cleaned.length} characters`);
      return cleaned;
    } catch (error) {
      logger.error("Error extracting text from TXT:", error);
      throw new Error("Failed to extract text from TXT");
    }
  }

  /**
   * Dispatch extraction by mime/extension hint
   */
  async extractText(
    buffer: Buffer,
    type: "pdf" | "docx" | "text"
  ): Promise<string> {
    if (type === "pdf") return this.extractTextFromPDF(buffer);
    if (type === "docx") return this.extractTextFromDOCX(buffer);
    if (type === "text") return this.extractTextFromTXT(buffer);
    throw new Error(`Unsupported document type for extraction: ${type}`);
  }

  /**
   * Extract text from PPTX buffer using pptx-parser + JSZip.
   * Adds slide boundaries like `--- Slide 3 ---` to preserve structure.
   */
  async extractTextFromPPTX(buffer: Buffer): Promise<string> {
    try {
      const zip = await JSZip.loadAsync(buffer);
      // ppt/slides/slideN.xml files contain slide text runs
      const slides: { index: number; text: string }[] = [];
      for (const path of Object.keys(zip.files)) {
        const m = path.match(/^ppt\/slides\/slide(\d+)\.xml$/);
        if (!m) continue;
        const idx = Number(m[1]);
        const xml = await zip.files[path].async("string");
        slides.push({ index: idx, text: xml });
      }
      slides.sort((a, b) => a.index - b.index);
      // Extract plain text from slide XML (<a:t>text</a:t> nodes)
      const extractFromXml = (xml: string): string => {
        const texts: string[] = [];
        const regex = /<a:t[^>]*>([\s\S]*?)<\/a:t>/g;
        let m: RegExpExecArray | null;
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
      const parts: string[] = [];
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
        } catch (e) {
          logger.warn("pptx slide parse failed", { slide: s.index, e });
        }
      }
      const joined = parts.join("\n\n");
      const finalText = this.cleanExtractedText(joined);
      logger.info(
        `Extracted text from PPTX: ${finalText.length} characters, slides: ${slides.length}`
      );
      return finalText;
    } catch (error) {
      logger.error("Error extracting text from PPTX:", error);
      throw new Error("Failed to extract text from PPTX");
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
