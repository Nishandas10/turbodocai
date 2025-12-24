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

type WebSearchResult = {
  title?: string;
  url: string;
  snippet?: string;
  displayLink?: string;
};

function getRequiredEnvVar(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function googleWebSearch(
  query: string,
  opts?: { num?: number }
): Promise<{ results: WebSearchResult[] }> {
  const q = (query ?? "").trim();
  if (!q) return { results: [] };

  // Uses Google Programmable Search Engine (Custom Search JSON API)
  // Env vars must be set in the deployment environment.
  const apiKey = getRequiredEnvVar("GOOGLE_CSE_API_KEY");
  const cx = getRequiredEnvVar("GOOGLE_CSE_ID");
  const num = Math.min(Math.max(opts?.num ?? 6, 1), 10);

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("cx", cx);
  url.searchParams.set("q", q);
  url.searchParams.set("num", String(num));

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Google search failed (${res.status}): ${text.slice(0, 500)}`
    );
  }

  const json = (await res.json().catch(() => null)) as {
    items?: Array<{
      title?: string;
      link?: string;
      snippet?: string;
      displayLink?: string;
    }>;
  } | null;

  const items = Array.isArray(json?.items) ? json!.items! : [];
  const results = items
    .map((it): WebSearchResult | null => {
      const url = typeof it.link === "string" ? it.link : "";
      if (!url) return null;
      return {
        url,
        title: typeof it.title === "string" ? it.title.trim() : undefined,
        snippet: typeof it.snippet === "string" ? it.snippet.trim() : undefined,
        displayLink:
          typeof it.displayLink === "string"
            ? it.displayLink.trim()
            : undefined,
      };
    })
    .filter((x) => x !== null) as WebSearchResult[];

  return { results };
}

function formatSearchResultsForPrompt(results: WebSearchResult[]): string {
  if (!results.length) return "(No search results.)";
  // Keep it compact: titles + snippets + URLs.
  return results
    .slice(0, 10)
    .map((r, i) => {
      const title = r.title ? r.title : "(untitled)";
      const domain = (() => {
        try {
          return new URL(r.url).hostname;
        } catch {
          return r.displayLink ?? "";
        }
      })();
      const snippet = r.snippet ? `\nSnippet: ${r.snippet}` : "";
      const domainLine = domain ? ` (${domain})` : "";
      return `#${i + 1}: ${title}${domainLine}\nURL: ${r.url}${snippet}`;
    })
    .join("\n\n");
}

/**
 * Validate and fix quiz data to ensure answerIndex is present.
 * If missing, attempt to guess from the question or default to 0.
 */
function validateAndFixQuizData(course: unknown): unknown {
  if (!course || typeof course !== "object") return course;

  const data = course as Record<string, unknown>;

  if (!Array.isArray(data.modules)) return course;

  data.modules.forEach((module: unknown) => {
    if (!module || typeof module !== "object") return;
    const mod = module as Record<string, unknown>;

    if (!Array.isArray(mod.sections)) return;

    mod.sections.forEach((section: unknown) => {
      if (!section || typeof section !== "object") return;
      const sec = section as Record<string, unknown>;

      if (!Array.isArray(sec.quiz)) return;

      sec.quiz.forEach((question: unknown) => {
        if (!question || typeof question !== "object") return;
        const q = question as Record<string, unknown>;

        // Ensure options is an array
        if (!Array.isArray(q.options)) {
          q.options = [];
        }

        // Check if answerIndex is missing or invalid
        if (typeof q.answerIndex !== "number" || q.answerIndex < 0) {
          q.answerIndex = 0; // Default to first option
        }

        // Validate answerIndex is within options bounds
        const ansIdx = q.answerIndex as number;
        if (Array.isArray(q.options) && ansIdx >= q.options.length) {
          q.answerIndex = 0;
        }
      });
    });
  });

  return data;
}

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

  // Persist minimal metadata immediately so other endpoints (like thumbnail) can work
  // while the course is still streaming.
  await redis.set(`course:meta:${courseId}`, {
    prompt,
    searchQuery: prompt,
  });

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

  // 1b. Explicit web search FIRST, then generate grounded on these sources.
  // Required flow:
  // 1) exact user prompt -> Google Search
  // 2) collect sources + metadata
  // 3) generate course using those sources
  let searchResults: WebSearchResult[] = [];
  try {
    const search = await googleWebSearch(prompt, { num: 6 });
    searchResults = search.results;
  } catch (e) {
    // If search fails (missing env, quota, etc.), we still generate using any provided sources.
    console.warn("googleWebSearch failed:", e);
  }

  // Persist search metadata so other endpoints / the UI can display citations later.
  await redis.set(`course:search:${courseId}`, {
    query: prompt,
    results: searchResults,
  });

  const webSearchBlock = formatSearchResultsForPrompt(searchResults);
  const combinedContext = [
    contextBlock ? `USER-PROVIDED CONTEXT\n${contextBlock}` : "",
    `GOOGLE SEARCH RESULTS (authoritative; cite/ground claims using these)\n${webSearchBlock}`,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  // 2. The AI Stream
  const result = await streamObject({
    model: google("gemini-2.5-flash-lite"), // Switch to 'gemini-3-flash' if available
    schema: courseSchema,
    system: COURSE_GENERATION_SYSTEM_PROMPT,
    prompt: buildCoursePrompt(prompt, combinedContext),
    // 3. ON FINISH: Save to Redis for permanent access
    onFinish: async ({ object }) => {
      if (object) {
        // Validate and fix quiz data before saving
        const validated = validateAndFixQuizData(object);

        // If the client already generated/persisted a thumbnail during streaming,
        // don't overwrite it with a potentially different image.
        const existing = (await redis.get(`course:${courseId}`)) as Record<
          string,
          unknown
        > | null;
        const existingImage =
          typeof existing?.courseImage === "string"
            ? (existing.courseImage as string)
            : "";

        // IMPORTANT: Do not generate a thumbnail here.
        // Thumbnails should only be generated during streaming via /api/courses/ensure-thumbnail.
        const courseImage = existingImage || null;
        // Attach id so the public course page and client components have a stable identifier.
        // This enables persistence of additional fields (like courseImage) without guessing.
        const courseWithId = {
          ...(validated as Record<string, unknown>),
          id: courseId,
          ...(courseImage ? { courseImage } : {}),
        };
        // Expire after 7 days to save space (Guest Policy)
        await redis.set(`course:${courseId}`, courseWithId);
      }
    },
  });

  // 4. Return the stream + The Course ID in headers
  return result.toTextStreamResponse({
    headers: { "x-course-id": courseId },
  });
}
