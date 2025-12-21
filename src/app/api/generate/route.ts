import { google } from "@ai-sdk/google";
import { streamObject } from "ai";
import { courseSchema } from "@/lib/schema";
import { Redis } from "@upstash/redis";
import { nanoid } from "nanoid";

// EDGE RUNTIME: Critical for speed and long streaming timeouts
export const runtime = "edge";

const redis = Redis.fromEnv();

type Source = {
  type: string;
  content: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<{
    prompt: string;
    sources: Source[];
  }>;

  const prompt = (body.prompt ?? "").trim();
  const sources = Array.isArray(body.sources) ? body.sources : [];

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing 'prompt'" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // Generate a unique ID for this course immediately
  const courseId = nanoid(10);

  // 1. Context Preparation (Simple concatenation for text sources)
  // For production, use Jina.ai for web links or pdf-parse for docs
  const contextBlock = sources
    .filter((s): s is Source => !!s && typeof s.content === "string")
    .map((s: Source, i: number) => {
      const type =
        typeof s.type === "string" && s.type.trim() ? s.type.trim() : "unknown";
      const content = s.content.trim();
      return `[Source ${i + 1} | ${type}]\n${content}`;
    })
    .join("\n\n---\n\n");

  // 2. The AI Stream
  const result = await streamObject({
    model: google("gemini-3-flash-preview"), // Switch to 'gemini-3-flash' if available
    schema: courseSchema,
    system: `
You are an expert instructional designer and curriculum architect.

CRITICAL OUTPUT RULES (NON-NEGOTIABLE):
- You MUST output a single JSON object that VALIDATES against the provided schema.
- Do NOT output any extra keys, commentary, markdown fences, or surrounding text.
- Every required field must be present. Never return null.
- Only use strings for text fields. Use arrays where required.

COURSE QUALITY RULES:
- Organize into Modules -> Sections (chapters/lessons).
- Every section.explanation MUST be well-structured Markdown (not raw text walls): headings, paragraphs, lists.
- Keep it rigorous and high-density. Avoid filler.

MARKDOWN FORMATTING CONVENTIONS (so the UI looks beautiful):
- Use '#', '##', '###' headings for hierarchy.
- Use short paragraphs (2–4 sentences).
- Use bullet lists for outlines and key points.
- For important term definitions, use a blockquote to create a "definition card" in the UI, like:
  > **frequency**
  > *noun*
  > The rate at which ...
- Use '**bold**' for emphasis and \`inline code\` for symbols, units, variables.
- Use horizontal rules '---' sparingly to separate major sections.

ID RULES:
- Provide stable string ids for modules and sections (e.g. "m1", "s1", or nanoid-like strings). They must be unique.

READING TIME:
- Provide a reasonable readingTime per section (e.g. "6 min").

PODCAST SCRIPT:
- podcastScript should be a conversational, two-speaker script (Mentor/Student) summarizing the lesson.
`,
    prompt: `
USER REQUEST:
${prompt}

CONTEXT MATERIAL (authoritative; prioritize it when present):
${contextBlock || "(No sources provided.)"}

Generate the course JSON now.
`,
    // 3. ON FINISH: Save to Redis for permanent access
    onFinish: async ({ object }) => {
      if (object) {
        // Expire after 7 days to save space (Guest Policy)
        await redis.set(`course:${courseId}`, object);
      }
    },
  });

  // 4. Return the stream + The Course ID in headers
  return result.toTextStreamResponse({
    headers: { "x-course-id": courseId },
  });
}
