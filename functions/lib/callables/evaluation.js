"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateLongAnswer = void 0;
const https_1 = require("firebase-functions/v2/https");
const openai_1 = __importDefault(require("openai"));
exports.evaluateLongAnswer = (0, https_1.onCall)({ enforceAppCheck: false }, async (request) => {
    var _a, _b, _c, _d, _e, _f;
    try {
        const { userId, userAnswer, referenceAnswer, minLength } = request.data || {};
        if (!userId || !userAnswer || !referenceAnswer)
            throw new Error("Missing required parameters: userId, userAnswer, referenceAnswer");
        if (request.auth && request.auth.uid && request.auth.uid !== userId)
            throw new Error("Authenticated user mismatch");
        const minChars = Math.max(40, Math.min(2000, Number(minLength) || 120));
        const trimmed = String(userAnswer).trim();
        if (trimmed.length < minChars) {
            return { success: true, data: { verdict: "insufficient", score: 0, reasoning: `Answer too brief (min ~${minChars} chars)`, keyPoints: [], missingPoints: [] } };
        }
        const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
        const system = "You are a fair, strict grader for long-form answers. Grade SEMANTICALLY: consider meaning, core logic, and conceptual correctness — not phrasing or style. An answer is CORRECT if it captures the essential ideas, steps, and reasoning even with different wording. Mark INCORRECT if key logic is wrong or major concepts are missing. Mark INSUFFICIENT if the response is too short or vague for a long question. Respond ONLY with strict JSON.";
        const schemaHint = '{"verdict":"correct|incorrect|insufficient","score":0-100,"reasoning":"short explanation","keyPoints":["..."],"missingPoints":["..."]}';
        const userMsg = `Reference Answer:\n${String(referenceAnswer)}\n\nStudent Answer:\n${trimmed}\n\nReturn JSON in this shape: ${schemaHint}. Score reflects semantic coverage (not style).`;
        let parsed = { verdict: "incorrect", score: 0, reasoning: "Failed to parse model output", keyPoints: [], missingPoints: [] };
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                temperature: 0.0,
                messages: [
                    { role: "system", content: system },
                    { role: "user", content: userMsg },
                ],
                response_format: { type: "json_object" },
                max_tokens: 350,
            });
            const raw = ((_c = (_b = (_a = completion.choices) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.message) === null || _c === void 0 ? void 0 : _c.content) || "{}";
            parsed = JSON.parse(raw);
        }
        catch (llmErr) {
            console.warn("evaluateLongAnswer: JSON mode failed, retrying fallback", llmErr);
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    temperature: 0.0,
                    messages: [
                        { role: "system", content: system },
                        { role: "user", content: userMsg + "\nReturn compact JSON only." },
                    ],
                    max_tokens: 350,
                });
                const text = ((_f = (_e = (_d = completion.choices) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.message) === null || _f === void 0 ? void 0 : _f.content) || "{}";
                const match = text.match(/\{[\s\S]*\}/);
                parsed = JSON.parse(match ? match[0] : text);
            }
            catch (fallbackErr) {
                console.error("evaluateLongAnswer: fallback parse failed", fallbackErr);
            }
        }
        let verdict = String((parsed === null || parsed === void 0 ? void 0 : parsed.verdict) || "incorrect").toLowerCase();
        if (!["correct", "incorrect", "insufficient"].includes(verdict))
            verdict = "incorrect";
        let score = Math.max(0, Math.min(100, Number((parsed === null || parsed === void 0 ? void 0 : parsed.score) || 0)));
        const reasoning = String((parsed === null || parsed === void 0 ? void 0 : parsed.reasoning) || "");
        const keyPoints = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.keyPoints) ? parsed.keyPoints.map(String) : [];
        const missingPoints = Array.isArray(parsed === null || parsed === void 0 ? void 0 : parsed.missingPoints) ? parsed.missingPoints.map(String) : [];
        if (verdict === "correct" && trimmed.length < minChars) {
            verdict = "insufficient";
            score = Math.min(score, 50);
        }
        return { success: true, data: { verdict, score, reasoning, keyPoints, missingPoints } };
    }
    catch (error) {
        console.error("Error in evaluateLongAnswer:", error);
        return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
});
//# sourceMappingURL=evaluation.js.map