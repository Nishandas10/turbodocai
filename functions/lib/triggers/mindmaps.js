"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateMindMap = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const openai_1 = __importDefault(require("openai"));
const firebase_1 = require("../config/firebase");
exports.generateMindMap = (0, firestore_1.onDocumentWritten)("mindmaps/{mindMapId}", async (event) => {
    var _a, _b, _c, _d;
    try {
        const after = (_b = (_a = event.data) === null || _a === void 0 ? void 0 : _a.after) === null || _b === void 0 ? void 0 : _b.data();
        const before = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.before) === null || _d === void 0 ? void 0 : _d.data();
        const mindMapId = event.params.mindMapId;
        if (!after)
            return;
        if (before && before.structure && before.status === "ready")
            return;
        if (after.status !== "generating")
            return;
        const { prompt, language, mode } = after;
        if (!prompt)
            return;
        const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
        const system = `You create hierarchical JSON mind map structures. Return STRICT JSON only in this shape: {"root": {"title": string, "children": [{"title": string, "children": [...] }]}}. Depth max 6, each node max 6 words. No extraneous fields.`;
        const userPrompt = `Prompt: ${prompt}\nLanguage: ${language || "English"}\nMode: ${mode}`;
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            messages: [
                { role: "system", content: system },
                { role: "user", content: userPrompt },
            ],
            max_tokens: 800,
            response_format: { type: "json_object" },
        });
        let structure = null;
        try {
            const raw = completion.choices[0].message.content || "{}";
            structure = JSON.parse(raw);
        }
        catch (e) {
            structure = { root: { title: after.title || "Mind Map", children: [] } };
        }
        await firebase_1.db.collection("mindmaps").doc(mindMapId).set({ structure, status: "ready", updatedAt: new Date() }, { merge: true });
    }
    catch (err) {
        console.error("Mind map generation failed", err);
        const mindMapId = event.params.mindMapId;
        await firebase_1.db.collection("mindmaps").doc(mindMapId).set({ status: "error", errorMessage: err instanceof Error ? err.message : "Unknown error", updatedAt: new Date() }, { merge: true });
    }
});
//# sourceMappingURL=mindmaps.js.map