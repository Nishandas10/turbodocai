"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.selectDocTextForClassification = selectDocTextForClassification;
exports.mergeTags = mergeTags;
function selectDocTextForClassification(data) {
    var _a, _b, _c, _d;
    const title = String(data.title || "").slice(0, 200);
    const summary = String(data.summary || "").slice(0, 4000);
    const processed = String(((_a = data.content) === null || _a === void 0 ? void 0 : _a.processed) || "").slice(0, 4000);
    const raw = String(((_b = data.content) === null || _b === void 0 ? void 0 : _b.raw) || "").slice(0, 4000);
    const meta = [data.type, (_c = data.metadata) === null || _c === void 0 ? void 0 : _c.fileName, (_d = data.metadata) === null || _d === void 0 ? void 0 : _d.mimeType]
        .filter(Boolean)
        .join(" ");
    const base = [title, summary, processed, raw, meta].filter(Boolean).join("\n");
    return base || title || meta || "";
}
function mergeTags(existing, computed) {
    const base = Array.isArray(existing) ? existing.map(String) : [];
    const set = new Set(base);
    for (const t of computed)
        set.add(t);
    set.delete("uploaded");
    return Array.from(set);
}
//# sourceMappingURL=text.js.map