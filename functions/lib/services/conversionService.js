"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversionService = void 0;
const firebase_functions_1 = require("firebase-functions");
class ConversionService {
    constructor(url, bucket) {
        this.url = url || process.env.CLOUD_RUN_CONVERTER_URL || "";
        this.bucket = bucket || process.env.FUNCTIONS_BUCKET || process.env.STORAGE_BUCKET || "";
    }
    isConfigured() {
        return !!this.url && !!this.bucket;
    }
    /**
     * Convert a GCS object path from .doc -> .docx via Cloud Run converter.
     * storagePath format expected: users/<uid>/documents/<docId>.doc
     * Returns the new .docx storagePath.
     */
    async convertDocToDocx(storagePath) {
        if (!this.isConfigured()) {
            throw new Error("ConversionService not configured: set CLOUD_RUN_CONVERTER_URL and bucket env");
        }
        if (!/\.doc$/i.test(storagePath)) {
            throw new Error("convertDocToDocx expects a .doc storagePath");
        }
        const outputPath = storagePath.replace(/\.doc$/i, ".docx");
        const payload = { bucket: this.bucket, inputPath: storagePath, outputPath };
        firebase_functions_1.logger.info("Calling Cloud Run converter", { url: this.url, payload });
        const res = await fetch(this.url.replace(/\/$/, "") + "/convert", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Converter HTTP ${res.status}: ${text}`);
        }
        const data = (await res.json());
        if (!(data === null || data === void 0 ? void 0 : data.success)) {
            throw new Error(`Converter error: ${(data === null || data === void 0 ? void 0 : data.error) || "unknown"}`);
        }
        const out = data.outputPath || outputPath;
        firebase_functions_1.logger.info("Conversion completed", { outputPath: out });
        return out;
    }
}
exports.ConversionService = ConversionService;
//# sourceMappingURL=conversionService.js.map