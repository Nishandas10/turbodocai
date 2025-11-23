import * as pdfjsLib from "pdfjs-dist";
import { createCanvas } from "canvas";
import { logger } from "firebase-functions";
import OpenAI from "openai";

/**
 * Service for performing OCR on scanned/handwritten PDFs
 * Uses pdfjs-dist to extract pages as images and OpenAI Vision API for OCR
 */
export class OCRService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("OpenAI API key is required for OCR service");
    }
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Check if a PDF is likely scanned/handwritten by analyzing the text extraction quality
   * @param buffer - PDF file buffer
   * @param extractedText - Text extracted via pdf-parse
   * @returns true if the PDF appears to be scanned/handwritten
   */
  isScannedOrHandwritten(extractedText: string, pageCount: number): boolean {
    // If extracted text is too short relative to page count, likely scanned
    const avgCharsPerPage = extractedText.length / pageCount;

    // Typical text-based PDFs have at least 500-1000 chars per page
    // Scanned PDFs will have very little to no text
    const MIN_CHARS_PER_PAGE = 100;

    if (avgCharsPerPage < MIN_CHARS_PER_PAGE) {
      logger.info(
        `PDF appears to be scanned: ${avgCharsPerPage.toFixed(
          0
        )} chars/page (threshold: ${MIN_CHARS_PER_PAGE})`
      );
      return true;
    }

    // Check for common OCR artifacts or gibberish
    const hasLowTextQuality = this.checkTextQuality(extractedText);
    if (hasLowTextQuality) {
      logger.info("PDF has low text quality, likely scanned");
      return true;
    }

    logger.info(
      `PDF appears to be text-based: ${avgCharsPerPage.toFixed(0)} chars/page`
    );
    return false;
  }

  /**
   * Check if extracted text appears to be low quality or gibberish
   */
  private checkTextQuality(text: string): boolean {
    if (!text || text.trim().length < 50) return true;

    // Calculate ratio of alphanumeric characters to total characters
    const alphanumeric = text.match(/[a-zA-Z0-9]/g)?.length || 0;
    const total = text.length;
    const alphanumericRatio = alphanumeric / total;

    // If less than 50% alphanumeric, likely low quality
    if (alphanumericRatio < 0.5) {
      return true;
    }

    return false;
  }

  /**
   * Extract text from a scanned/handwritten PDF using OCR
   * @param buffer - PDF file buffer
   * @param progressCallback - Optional callback to report progress (0-100)
   * @returns Extracted text from all pages
   */
  async extractTextFromScannedPDF(
    buffer: Buffer,
    progressCallback?: (progress: number) => Promise<void>
  ): Promise<string> {
    try {
      logger.info("Starting OCR extraction from scanned PDF");

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      });

      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;

      logger.info(`PDF has ${numPages} pages to process with OCR`);

      const pageTexts: string[] = [];

      // Process each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          logger.info(`Processing page ${pageNum}/${numPages}`);

          // Get the page
          const page = await pdfDocument.getPage(pageNum);

          // Render page to canvas
          const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
          const canvas = createCanvas(viewport.width, viewport.height);
          const context = canvas.getContext("2d");

          const renderContext: any = {
            canvasContext: context,
            viewport: viewport,
          };

          await page.render(renderContext).promise;

          // Convert canvas to base64 image
          const imageBase64 = canvas.toDataURL("image/png").split(",")[1];
          const dataUrl = `data:image/png;base64,${imageBase64}`;

          // Perform OCR using OpenAI Vision API
          const ocrText = await this.performOCR(dataUrl, pageNum);
          pageTexts.push(ocrText);

          // Report progress
          if (progressCallback) {
            const progress = Math.round((pageNum / numPages) * 100);
            await progressCallback(progress);
          }

          logger.info(
            `Page ${pageNum} OCR completed: ${ocrText.length} characters extracted`
          );
        } catch (pageError) {
          logger.error(`Error processing page ${pageNum}:`, pageError);
          // Continue with other pages even if one fails
          pageTexts.push(`[Error processing page ${pageNum}]`);
        }
      }

      // Merge all page texts
      const mergedText = this.mergePageTexts(pageTexts);

      logger.info(
        `OCR extraction completed: ${mergedText.length} total characters from ${numPages} pages`
      );

      return mergedText;
    } catch (error) {
      logger.error("Error in OCR extraction:", error);
      throw new Error("Failed to extract text from scanned PDF using OCR");
    }
  }

  /**
   * Perform OCR on a single page image using OpenAI Vision API
   */
  private async performOCR(
    imageDataUrl: string,
    pageNum: number
  ): Promise<string> {
    try {
      const prompt = `Extract all text from this PDF page (page ${pageNum}). 
      
Instructions:
- Extract ALL visible text exactly as it appears
- Preserve the natural reading order (top to bottom, left to right)
- For handwritten notes, do your best to interpret the handwriting accurately
- Include headers, footers, and any annotations
- Maintain paragraph breaks and formatting where clear
- If text is unclear or illegible, mark it as [illegible]
- Return ONLY the extracted text, no additional commentary

Format the output as plain text with proper line breaks.`;

      // Try using the Responses API first (newer API)
      let ocrText = "";
      try {
        const resp: any = await (this.openai as any).responses.create({
          model: "gpt-5-mini",
          input: [
            {
              role: "user",
              content: [
                { type: "input_text", text: prompt },
                { type: "input_image", image_url: imageDataUrl },
              ],
            },
          ],
        });

        ocrText =
          resp?.output_text ||
          resp?.output?.[0]?.content?.[0]?.text ||
          resp?.data?.[0]?.content?.[0]?.text ||
          "";
      } catch (respErr) {
        logger.warn("Responses API failed, trying chat completion fallback");

        // Fallback to chat completions API
        const completion = await this.openai.chat.completions.create({
          model: "gpt-4o-mini" as any,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt } as any,
                { type: "image_url", image_url: { url: imageDataUrl } } as any,
              ],
            } as any,
          ],
          max_tokens: 20000,
          temperature: 0.0,
        } as any);

        ocrText = completion.choices?.[0]?.message?.content || "";
      }

      return ocrText.trim();
    } catch (error) {
      logger.error(`Error performing OCR on page ${pageNum}:`, error);
      return `[OCR failed for page ${pageNum}]`;
    }
  }

  /**
   * Merge text from all pages into a single document
   */
  private mergePageTexts(pageTexts: string[]): string {
    const mergedPages = pageTexts.map((text, index) => {
      const pageNum = index + 1;
      return `--- Page ${pageNum} ---\n${text.trim()}`;
    });

    return mergedPages.join("\n\n");
  }

  /**
   * Extract text from a scanned/handwritten PDF with chunked processing for large files
   * Processes pages in batches to avoid memory issues
   */
  async extractTextFromScannedPDFChunked(
    buffer: Buffer,
    progressCallback?: (progress: number) => Promise<void>,
    batchSize: number = 5
  ): Promise<string> {
    try {
      logger.info(
        `Starting chunked OCR extraction from scanned PDF (batch size: ${batchSize})`
      );

      // Load PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
      });

      const pdfDocument = await loadingTask.promise;
      const numPages = pdfDocument.numPages;

      logger.info(`PDF has ${numPages} pages to process with OCR in batches`);

      const pageTexts: string[] = [];
      let processedPages = 0;

      // Process pages in batches
      for (let startPage = 1; startPage <= numPages; startPage += batchSize) {
        const endPage = Math.min(startPage + batchSize - 1, numPages);
        logger.info(
          `Processing batch: pages ${startPage}-${endPage} of ${numPages}`
        );

        // Process batch
        const batchPromises: Promise<string>[] = [];

        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
          batchPromises.push(
            this.processPageOCR(pdfDocument, pageNum).catch((error) => {
              logger.error(`Error processing page ${pageNum}:`, error);
              return `[Error processing page ${pageNum}]`;
            })
          );
        }

        const batchResults = await Promise.all(batchPromises);
        pageTexts.push(...batchResults);

        processedPages += batchResults.length;

        // Report progress
        if (progressCallback) {
          const progress = Math.round((processedPages / numPages) * 100);
          await progressCallback(progress);
        }

        logger.info(
          `Batch completed: ${processedPages}/${numPages} pages processed`
        );
      }

      // Merge all page texts
      const mergedText = this.mergePageTexts(pageTexts);

      logger.info(
        `Chunked OCR extraction completed: ${mergedText.length} total characters from ${numPages} pages`
      );

      return mergedText;
    } catch (error) {
      logger.error("Error in chunked OCR extraction:", error);
      throw new Error(
        "Failed to extract text from scanned PDF using chunked OCR"
      );
    }
  }

  /**
   * Process a single page for OCR
   */
  private async processPageOCR(
    pdfDocument: any,
    pageNum: number
  ): Promise<string> {
    try {
      // Get the page
      const page = await pdfDocument.getPage(pageNum);

      // Render page to canvas
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext("2d");

      const renderContext: any = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Convert canvas to base64 image
      const imageBase64 = canvas.toDataURL("image/png").split(",")[1];
      const dataUrl = `data:image/png;base64,${imageBase64}`;

      // Perform OCR using OpenAI Vision API
      const ocrText = await this.performOCR(dataUrl, pageNum);

      logger.info(
        `Page ${pageNum} OCR completed: ${ocrText.length} characters extracted`
      );

      return ocrText;
    } catch (error) {
      logger.error(`Error processing page ${pageNum}:`, error);
      throw error;
    }
  }
}
