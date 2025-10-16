import { onCall } from "firebase-functions/v2/https";
import OpenAI from "openai";

export const evaluateLongAnswer = onCall(
  { enforceAppCheck: false },
  async (request) => {
    try {
      const { userId, userAnswer, referenceAnswer, minLength } =
        request.data || {};
      if (!userId || !userAnswer || !referenceAnswer)
        throw new Error(
          "Missing required parameters: userId, userAnswer, referenceAnswer"
        );
      if (request.auth && request.auth.uid && request.auth.uid !== userId)
        throw new Error("Authenticated user mismatch");

      const minChars = Math.max(40, Math.min(2000, Number(minLength) || 120));
      const trimmed = String(userAnswer).trim();
      if (trimmed.length < minChars) {
        return {
          success: true,
          data: {
            verdict: "insufficient",
            score: 0,
            reasoning: `Answer too brief (min ~${minChars} chars)`,
            keyPoints: [],
            missingPoints: [],
          },
        };
      }

      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const system =
        "You are a fair, strict grader for long-form answers. Grade SEMANTICALLY: consider meaning, core logic, and conceptual correctness — not phrasing or style. An answer is CORRECT if it captures the essential ideas, steps, and reasoning even with different wording. Mark INCORRECT if key logic is wrong or major concepts are missing. Mark INSUFFICIENT if the response is too short or vague for a long question. Respond ONLY with strict JSON.";
      const schemaHint =
        '{"verdict":"correct|incorrect|insufficient","score":0-100,"reasoning":"short explanation","keyPoints":["..."],"missingPoints":["..."]}';
      const userMsg = `Reference Answer:\n${String(
        referenceAnswer
      )}\n\nStudent Answer:\n${trimmed}\n\nReturn JSON in this shape: ${schemaHint}. Score reflects semantic coverage (not style).`;

      let parsed: any = {
        verdict: "incorrect",
        score: 0,
        reasoning: "Failed to parse model output",
        keyPoints: [],
        missingPoints: [],
      };

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini" as any,
          temperature: 0.0,
          messages: [
            { role: "system", content: system },
            { role: "user", content: userMsg },
          ],
          response_format: { type: "json_object" } as any,
          max_tokens: 350,
        } as any);
        const raw = completion.choices?.[0]?.message?.content || "{}";
        parsed = JSON.parse(raw);
      } catch (llmErr) {
        console.warn(
          "evaluateLongAnswer: JSON mode failed, retrying fallback",
          llmErr
        );
        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini" as any,
            temperature: 0.0,
            messages: [
              { role: "system", content: system },
              {
                role: "user",
                content: userMsg + "\nReturn compact JSON only.",
              },
            ],
            max_tokens: 350,
          } as any);
          const text = completion.choices?.[0]?.message?.content || "{}";
          const match = text.match(/\{[\s\S]*\}/);
          parsed = JSON.parse(match ? match[0] : text);
        } catch (fallbackErr) {
          console.error(
            "evaluateLongAnswer: fallback parse failed",
            fallbackErr
          );
        }
      }

      let verdict: string = String(
        parsed?.verdict || "incorrect"
      ).toLowerCase();
      if (!["correct", "incorrect", "insufficient"].includes(verdict))
        verdict = "incorrect";
      let score = Math.max(0, Math.min(100, Number(parsed?.score || 0)));
      const reasoning = String(parsed?.reasoning || "");
      const keyPoints = Array.isArray(parsed?.keyPoints)
        ? parsed.keyPoints.map(String)
        : [];
      const missingPoints = Array.isArray(parsed?.missingPoints)
        ? parsed.missingPoints.map(String)
        : [];

      if (verdict === "correct" && trimmed.length < minChars) {
        verdict = "insufficient";
        score = Math.min(score, 50);
      }

      return {
        success: true,
        data: { verdict, score, reasoning, keyPoints, missingPoints },
      };
    } catch (error) {
      console.error("Error in evaluateLongAnswer:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);
