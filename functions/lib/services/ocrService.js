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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OCRService = void 0;
const pdfjsLib = __importStar(require("pdfjs-dist"));
const canvas_1 = require("canvas");
const firebase_functions_1 = require("firebase-functions");
const openai_1 = __importDefault(require("openai"));
/**
 * Service for performing OCR on scanned/handwritten PDFs
 * Uses pdfjs-dist to extract pages as images and OpenAI Vision API for OCR
 */
class OCRService {
    constructor(apiKey) {
        if (!apiKey) {
            throw new Error("OpenAI API key is required for OCR service");
        }
        this.openai = new openai_1.default({ apiKey });
    }
    /**
     * Check if a PDF is likely scanned/handwritten by analyzing the text extraction quality
     * @param buffer - PDF file buffer
     * @param extractedText - Text extracted via pdf-parse
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
     * Extract text from a scanned/handwritten PDF using OCR
     * @param buffer - PDF file buffer
     * @param progressCallback - Optional callback to report progress (0-100)
     * @returns Extracted text from all pages
     */
    async extractTextFromScannedPDF(buffer, progressCallback) {
        try {
            firebase_functions_1.logger.info("Starting OCR extraction from scanned PDF");
            // Load PDF document
            const loadingTask = pdfjsLib.getDocument({
                data: new Uint8Array(buffer),
                useSystemFonts: true,
            });
            const pdfDocument = await loadingTask.promise;
            const numPages = pdfDocument.numPages;
            firebase_functions_1.logger.info(`PDF has ${numPages} pages to process with OCR`);
            const pageTexts = [];
            // Process each page
            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                try {
                    firebase_functions_1.logger.info(`Processing page ${pageNum}/${numPages}`);
                    // Get the page
                    const page = await pdfDocument.getPage(pageNum);
                    // Render page to canvas
                    const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
                    const canvas = (0, canvas_1.createCanvas)(viewport.width, viewport.height);
                    const context = canvas.getContext("2d");
                    const renderContext = {
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
                    firebase_functions_1.logger.info(`Page ${pageNum} OCR completed: ${ocrText.length} characters extracted`);
                }
                catch (pageError) {
                    firebase_functions_1.logger.error(`Error processing page ${pageNum}:`, pageError);
                    // Continue with other pages even if one fails
                    pageTexts.push(`[Error processing page ${pageNum}]`);
                }
            }
            // Merge all page texts
            const mergedText = this.mergePageTexts(pageTexts);
            firebase_functions_1.logger.info(`OCR extraction completed: ${mergedText.length} total characters from ${numPages} pages`);
            return mergedText;
        }
        catch (error) {
            firebase_functions_1.logger.error("Error in OCR extraction:", error);
            throw new Error("Failed to extract text from scanned PDF using OCR");
        }
    }
    /**
     * Perform OCR on a single page image using OpenAI Vision API
     */
    async performOCR(imageDataUrl, pageNum) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
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
                const resp = await this.openai.responses.create({
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
                    (resp === null || resp === void 0 ? void 0 : resp.output_text) ||
                        ((_d = (_c = (_b = (_a = resp === null || resp === void 0 ? void 0 : resp.output) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.text) ||
                        ((_h = (_g = (_f = (_e = resp === null || resp === void 0 ? void 0 : resp.data) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.content) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.text) ||
                        "";
            }
            catch (respErr) {
                firebase_functions_1.logger.warn("Responses API failed, trying chat completion fallback");
                // Fallback to chat completions API
                const completion = await this.openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        {
                            role: "user",
                            content: [
                                { type: "text", text: prompt },
                                { type: "image_url", image_url: { url: imageDataUrl } },
                            ],
                        },
                    ],
                    max_tokens: 20000,
                    temperature: 0.0,
                });
                ocrText = ((_l = (_k = (_j = completion.choices) === null || _j === void 0 ? void 0 : _j[0]) === null || _k === void 0 ? void 0 : _k.message) === null || _l === void 0 ? void 0 : _l.content) || "";
            }
            return ocrText.trim();
        }
        catch (error) {
            firebase_functions_1.logger.error(`Error performing OCR on page ${pageNum}:`, error);
            return `[OCR failed for page ${pageNum}]`;
        }
    }
    /**
     * Merge text from all pages into a single document
     */
    mergePageTexts(pageTexts) {
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
    async extractTextFromScannedPDFChunked(buffer, progressCallback, batchSize = 5) {
        try {
            firebase_functions_1.logger.info(`Starting chunked OCR extraction from scanned PDF (batch size: ${batchSize})`);
            // Load PDF document
            const loadingTask = pdfjsLib.getDocument({
                data: new Uint8Array(buffer),
                useSystemFonts: true,
            });
            const pdfDocument = await loadingTask.promise;
            const numPages = pdfDocument.numPages;
            firebase_functions_1.logger.info(`PDF has ${numPages} pages to process with OCR in batches`);
            const pageTexts = [];
            let processedPages = 0;
            // Process pages in batches
            for (let startPage = 1; startPage <= numPages; startPage += batchSize) {
                const endPage = Math.min(startPage + batchSize - 1, numPages);
                firebase_functions_1.logger.info(`Processing batch: pages ${startPage}-${endPage} of ${numPages}`);
                // Process batch
                const batchPromises = [];
                for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
                    batchPromises.push(this.processPageOCR(pdfDocument, pageNum).catch((error) => {
                        firebase_functions_1.logger.error(`Error processing page ${pageNum}:`, error);
                        return `[Error processing page ${pageNum}]`;
                    }));
                }
                const batchResults = await Promise.all(batchPromises);
                pageTexts.push(...batchResults);
                processedPages += batchResults.length;
                // Report progress
                if (progressCallback) {
                    const progress = Math.round((processedPages / numPages) * 100);
                    await progressCallback(progress);
                }
                firebase_functions_1.logger.info(`Batch completed: ${processedPages}/${numPages} pages processed`);
            }
            // Merge all page texts
            const mergedText = this.mergePageTexts(pageTexts);
            firebase_functions_1.logger.info(`Chunked OCR extraction completed: ${mergedText.length} total characters from ${numPages} pages`);
            return mergedText;
        }
        catch (error) {
            firebase_functions_1.logger.error("Error in chunked OCR extraction:", error);
            throw new Error("Failed to extract text from scanned PDF using chunked OCR");
        }
    }
    /**
     * Process a single page for OCR
     */
    async processPageOCR(pdfDocument, pageNum) {
        try {
            // Get the page
            const page = await pdfDocument.getPage(pageNum);
            // Render page to canvas
            const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
            const canvas = (0, canvas_1.createCanvas)(viewport.width, viewport.height);
            const context = canvas.getContext("2d");
            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };
            await page.render(renderContext).promise;
            // Convert canvas to base64 image
            const imageBase64 = canvas.toDataURL("image/png").split(",")[1];
            const dataUrl = `data:image/png;base64,${imageBase64}`;
            // Perform OCR using OpenAI Vision API
            const ocrText = await this.performOCR(dataUrl, pageNum);
            firebase_functions_1.logger.info(`Page ${pageNum} OCR completed: ${ocrText.length} characters extracted`);
            return ocrText;
        }
        catch (error) {
            firebase_functions_1.logger.error(`Error processing page ${pageNum}:`, error);
            throw error;
        }
    }
}
exports.OCRService = OCRService;
//# sourceMappingURL=ocrService.js.map