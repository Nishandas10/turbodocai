import { google } from "@ai-sdk/google";
import { streamObject } from "ai";
import { courseSchema } from "@/lib/schema";
import { Redis } from "@upstash/redis";
import { customAlphabet } from "nanoid";
import {
  COURSE_GENERATION_SYSTEM_PROMPT,
  buildCoursePrompt,
} from "@/lib/geminiprompt";

// EDGE RUNTIME: Critical for speed and long streaming timeouts
export const runtime = "edge";

const redis = Redis.fromEnv();
const generateId = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  10
);

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
  const courseId = generateId();

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
    system: COURSE_GENERATION_SYSTEM_PROMPT,
    prompt: buildCoursePrompt(prompt, contextBlock),
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
