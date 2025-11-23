# Quick Start: Testing OCR Feature

## How to Test

1. **Build and Deploy:**

   ```bash
   cd functions
   npm install
   npm run build
   firebase deploy --only functions
   ```

2. **Upload Test PDFs:**

   - Upload a regular text-based PDF → Should use normal extraction
   - Upload a scanned document/book → Should trigger OCR
   - Upload handwritten notes → Should trigger OCR

3. **Monitor Processing:**
   - Check the document's `processingProgress` field in Firestore
   - Look for progress messages like "Performing OCR on scanned document..."
   - Watch Firebase Functions logs for OCR-related messages

## How It Works (Simple Version)

**Regular PDF:**

```
Upload → Extract Text → Process → Done (fast)
```

**Scanned/Handwritten PDF:**

```
Upload → Try Extract → Detect Low Quality → OCR Each Page → Merge → Process → Done (slower)
```

## Detection Threshold

A PDF is considered scanned if:

- **Less than 100 characters per page** OR
- **Text quality is poor** (less than 50% alphanumeric)

## Key Log Messages

Look for these in Firebase Functions logs:

```
✅ "PDF appears to be text-based: 850 chars/page"
   → Using regular extraction

⚠️ "PDF appears to be scanned: 25 chars/page (threshold: 100)"
   → Switching to OCR

🔄 "Processing page 5/10"
   → OCR in progress

✅ "OCR extraction completed: 5432 total characters from 10 pages"
   → OCR finished successfully
```

## Troubleshooting

| Issue              | Likely Cause          | Solution                                      |
| ------------------ | --------------------- | --------------------------------------------- |
| OCR not triggering | PDF has embedded text | Lower threshold in `isScannedOrHandwritten()` |
| Timeout errors     | Too many pages        | Reduce batch size or increase timeout         |
| Memory errors      | Large PDFs            | Process fewer pages per batch                 |
| Poor OCR quality   | Low image resolution  | Increase scale factor in `getViewport()`      |
| High API costs     | Too many OCR requests | Implement usage limits                        |

## Configuration Options

In `functions/src/services/ocrService.ts`:

```typescript
// Image quality (line 110, 334)
const viewport = page.getViewport({ scale: 2.0 }); // 1.0 to 3.0

// Batch size (in index.ts, line ~855)
extractTextFromScannedPDFChunked(fileBuffer, progressCallback, 5); // 1-10

// Detection threshold (in documentProcessor.ts, line 74)
const MIN_CHARS_PER_PAGE = 100; // 50-200
```

## Expected Processing Times

- **Text PDF (10 pages)**: ~5-10 seconds
- **Scanned PDF (10 pages)**: ~30-60 seconds
- **Handwritten (10 pages)**: ~40-80 seconds

_Times vary based on page complexity and API response time_

## API Usage

Each scanned page requires:

- 1 OpenAI Vision API call (gpt-4o-mini)
- ~2000 max tokens per page
- Cost: Higher than text-only processing

**Recommendation**: Monitor costs and consider limits for production.

---

## Next Steps After Deployment

1. ✅ Deploy functions
2. ✅ Test with sample PDFs
3. ✅ Monitor logs for errors
4. ✅ Check extraction quality
5. ✅ Monitor API costs
6. ✅ Implement usage limits (if needed)
7. ✅ Gather user feedback
