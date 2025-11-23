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
Upload → Try Extract → Detect Low Quality → OCR All Pages (Parallel) → Merge → Process → Done (fast)
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

🔄 "Processing all 10 pages in parallel..."
   → OCR in progress

✅ "All pages processed successfully"
   → All pages rendered and sent to API

✅ "OCR extraction completed: 5432 total characters from 10 pages"
   → OCR finished successfully
```

## Troubleshooting

| Issue              | Likely Cause           | Solution                                      |
| ------------------ | ---------------------- | --------------------------------------------- |
| OCR not triggering | PDF has embedded text  | Lower threshold in `isScannedOrHandwritten()` |
| Timeout errors     | Too many pages         | Increase timeout or reduce max pages          |
| Memory errors      | Large PDFs/many pages  | Process smaller PDFs or increase memory       |
| Poor OCR quality   | Low image resolution   | Increase scale factor in `getViewport()`      |
| High API costs     | Too many OCR requests  | Implement usage limits or page limits         |
| Rate limit errors  | Too many parallel APIs | Add retry logic or reduce parallelism         |

## Configuration Options

In `functions/src/services/ocrService.ts`:

```typescript
// Image quality (rendering scale)
const viewport = page.getViewport({ scale: 2.0 }); // 1.0 to 3.0

// Detection threshold (in documentProcessor.ts)
const MIN_CHARS_PER_PAGE = 100; // 50-200

// Note: All pages now processed in parallel (no batch size setting)
```

## Expected Processing Times

- **Text PDF (10 pages)**: ~5-10 seconds
- **Scanned PDF (10 pages)**: ~15-30 seconds (all pages in parallel)
- **Handwritten (10 pages)**: ~20-40 seconds (all pages in parallel)

_Times vary based on page complexity, API response time, and parallel processing limits_

**Note**: Parallel processing is much faster than sequential, but may hit rate limits with very large PDFs.

## API Usage

Each scanned page requires:

- 1 OpenAI Vision API call (gpt-4o-mini)
- ~2000 max tokens per page
- **All pages processed simultaneously** (multiple concurrent API calls)
- Cost: Higher than text-only processing

**Recommendations**:

- Monitor costs and API rate limits
- Consider implementing page limits (e.g., max 50 pages per document)
- Watch for OpenAI rate limit errors with large PDFs

---

## Next Steps After Deployment

1. ✅ Deploy functions
2. ✅ Test with sample PDFs
3. ✅ Monitor logs for errors
4. ✅ Check extraction quality
5. ✅ Monitor API costs
6. ✅ Implement usage limits (if needed)
7. ✅ Gather user feedback
