"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cosineSim = cosineSim;
function cosineSim(a, b) {
    let dot = 0, na = 0, nb = 0;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        const va = a[i];
        const vb = b[i];
        dot += va * vb;
        na += va * va;
        nb += vb * vb;
    }
    if (!na || !nb)
        return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
//# sourceMappingURL=similarity.js.map