import { onDocumentWritten } from "firebase-functions/v2/firestore";
import OpenAI from "openai";
import { db } from "../config/firebase";

export const generateMindMap = onDocumentWritten(
  "mindmaps/{mindMapId}",
  async (event) => {
    try {
      const after = event.data?.after?.data() as any;
      const before = event.data?.before?.data() as any | undefined;
      const mindMapId = event.params.mindMapId;
      if (!after) return;
      if (before && before.structure && before.status === "ready") return;
      if (after.status !== "generating") return;
      const { prompt, language, mode } = after;
      if (!prompt) return;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const system = `You create hierarchical JSON mind map structures. Return STRICT JSON only in this shape: {"root": {"title": string, "children": [{"title": string, "children": [...] }]}}. Depth max 6, each node max 6 words. No extraneous fields.`;
      const userPrompt = `Prompt: ${prompt}\nLanguage: ${
        language || "English"
      }\nMode: ${mode}`;
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 800,
        response_format: { type: "json_object" } as any,
      } as any);
      let structure: any = null;
      try {
        const raw = completion.choices[0].message.content || "{}";
        structure = JSON.parse(raw);
      } catch (e) {
        structure = {
          root: { title: after.title || "Mind Map", children: [] },
        };
      }
      await db
        .collection("mindmaps")
        .doc(mindMapId)
        .set(
          { structure, status: "ready", updatedAt: new Date() },
          { merge: true }
        );
    } catch (err) {
      console.error("Mind map generation failed", err);
      const mindMapId = event.params.mindMapId;
      await db
        .collection("mindmaps")
        .doc(mindMapId)
        .set(
          {
            status: "error",
            errorMessage: err instanceof Error ? err.message : "Unknown error",
            updatedAt: new Date(),
          },
          { merge: true }
        );
    }
  }
);
