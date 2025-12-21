Here is the complete, step-by-step master guide to building the **"Guest Course Generator"** feature.

This architecture is optimized for **speed** (Edge Runtime + Parallel Processing) and **shareability** (Upstash Redis + Public Links).

---

### **Phase 1: Project Setup & Dependencies**

Initialize a fresh Next.js project and install the required AI and UI libraries.

```bash
npx create-next-app@latest ai-course-platform
# Select: TypeScript, Tailwind, App Router, ESLint
cd ai-course-platform

# Install Core AI & Database libs
npm install ai @ai-sdk/google zod @upstash/redis nanoid

# Install UI Utilities
npm install lucide-react react-markdown clsx tailwind-merge

```

**Environment Variables (`.env.local`)**
Get your keys from [Google AI Studio](https://aistudio.google.com/) and [Upstash](https://upstash.com/).

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_key_here
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

```

---

### **Phase 2: The Data Structure (Schema)**

Create a strict "Contract" that forces the AI to output JSON that matches your exact UI layout (Sidebar + Tabs).

**File:** `lib/schema.ts`

```typescript
import { z } from "zod";

// This schema defines exactly what the AI must generate
export const courseSchema = z.object({
  courseTitle: z.string().describe("Catchy title for the course"),
  courseDescription: z
    .string()
    .describe("Brief summary of what the user will learn"),
  modules: z.array(
    z.object({
      id: z.string(),
      moduleTitle: z.string().describe("Title for the sidebar navigation"),
      sections: z.array(
        z.object({
          id: z.string(),
          title: z.string().describe("Title of the specific lesson"),
          // TAB 1: The Main Content
          explanation: z
            .string()
            .describe(
              "Detailed educational content in Markdown format. Use headings, bullet points, and bold text."
            ),
          // TAB 2: The Podcast Script
          podcastScript: z
            .string()
            .describe(
              "A conversational script between two hosts summarizing this lesson."
            ),
          // Metadata for UI badges
          readingTime: z.string().describe("e.g. '5 min'"),
        })
      ),
    })
  ),
});

export type Course = z.infer<typeof courseSchema>;
```

---

### **Phase 3: The Backend (API Route)**

This is the engine. It handles unauthenticated requests, processes inputs, and streams the response.

**File:** `app/api/generate/route.ts`

```typescript
import { google } from "@ai-sdk/google";
import { streamObject } from "ai";
import { courseSchema } from "@/lib/schema";
import { Redis } from "@upstash/redis";
import { nanoid } from "nanoid";

// EDGE RUNTIME: Critical for speed and long streaming timeouts
export const runtime = "edge";

const redis = Redis.fromEnv();

export async function POST(req: Request) {
  const { prompt, sources } = await req.json();

  // Generate a unique ID for this course immediately
  const courseId = nanoid(10);

  // 1. Context Preparation (Simple concatenation for text sources)
  // For production, use Jina.ai for web links or pdf-parse for docs
  const contextBlock = sources
    .map((s: any) => `[Source: ${s.type}] ${s.content}`)
    .join("\n\n");

  // 2. The AI Stream
  const result = await streamObject({
    model: google("gemini-1.5-flash"), // Switch to 'gemini-3-flash' if available
    schema: courseSchema,
    system: `
      You are an expert instructional designer. 
      Your goal is to create a structured course based strictly on the provided context.
      - Sidebar: Organize content into logical modules.
      - Content: detailed and academic.
      - Podcast: fun and conversational.
    `,
    prompt: `
      USER REQUEST: ${prompt}
      
      CONTEXT MATERIAL:
      ${contextBlock}
    `,
    // 3. ON FINISH: Save to Redis for permanent access
    onFinish: async ({ object }) => {
      if (object) {
        // Expire after 7 days to save space (Guest Policy)
        await redis.set(`course:${courseId}`, object, { ex: 604800 });
      }
    },
  });
  // 4. Return the stream + The Course ID in headers
  return result.toTextStreamResponse({
    headers: { "x-course-id": courseId },
  });
}
```

---

### **Phase 4: The Shared UI Component**

We build one "Smart Component" that handles the Sidebar, Tabs, and Content. This is used by both the _Creator_ (while generating) and the _Viewer_ (public link).

**File:** `components/CourseViewer.tsx`

```tsx
"use client";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { BookOpen, Headphones, Play, Menu, Clock } from "lucide-react";
import { Course } from "@/lib/schema";

export default function CourseViewer({ course }: { course: Course }) {
  // UI State
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [activeTab, setActiveTab] = useState<"read" | "listen">("read");

  // Safety check for empty streaming data
  const currentModule = course?.modules?.[activeModuleIdx];
  const currentSection = currentModule?.sections?.[activeSectionIdx];

  if (!course)
    return <div className="p-10 text-center">Initializing Course...</div>;

  return (
    <div className="flex h-screen bg-white overflow-hidden font-sans">
      {/* --- LEFT SIDEBAR --- */}
      <aside className="w-80 border-r bg-gray-50 flex flex-col">
        <div className="p-6 border-b bg-white">
          <h2 className="font-bold text-lg leading-tight">
            {course.courseTitle || "Generating..."}
          </h2>
          <p className="text-xs text-gray-500 mt-2 line-clamp-2">
            {course.courseDescription}
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-6">
          {course.modules?.map((module, mIdx) => (
            <div key={mIdx}>
              <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">
                {module.moduleTitle}
              </h3>
              <div className="space-y-1">
                {module.sections?.map((section, sIdx) => {
                  const isActive =
                    mIdx === activeModuleIdx && sIdx === activeSectionIdx;
                  return (
                    <button
                      key={sIdx}
                      onClick={() => {
                        setActiveModuleIdx(mIdx);
                        setActiveSectionIdx(sIdx);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? "bg-white shadow-sm text-black font-medium border"
                          : "text-gray-600 hover:bg-gray-200/50"
                      }`}
                    >
                      {section.title}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {currentSection ? (
          <>
            {/* Header / Tabs */}
            <header className="px-12 pt-10 pb-0 bg-white z-10">
              <div className="flex justify-between items-start mb-6">
                <h1 className="text-3xl font-bold text-gray-900">
                  {currentSection.title}
                </h1>
                <div className="flex items-center gap-1 text-xs font-medium bg-gray-100 px-2 py-1 rounded-md text-gray-600">
                  <Clock size={12} /> {currentSection.readingTime}
                </div>
              </div>

              <div className="flex gap-8 border-b border-gray-100">
                <button
                  onClick={() => setActiveTab("read")}
                  className={`pb-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                    activeTab === "read"
                      ? "border-b-2 border-black text-black"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <BookOpen size={16} /> Explanation
                </button>
                <button
                  onClick={() => setActiveTab("listen")}
                  className={`pb-3 flex items-center gap-2 text-sm font-medium transition-colors ${
                    activeTab === "listen"
                      ? "border-b-2 border-black text-black"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <Headphones size={16} /> Podcast
                </button>
              </div>
            </header>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-12 pb-24">
              <div className="max-w-3xl">
                {activeTab === "read" ? (
                  <article className="prose prose-slate prose-headings:font-bold prose-p:text-gray-600 prose-p:leading-7">
                    <ReactMarkdown>{currentSection.explanation}</ReactMarkdown>
                  </article>
                ) : (
                  <div className="bg-amber-50 rounded-2xl p-8 border border-amber-100">
                    <div className="flex items-center gap-4 mb-6">
                      <button className="w-12 h-12 bg-black rounded-full flex items-center justify-center hover:scale-105 transition">
                        <Play
                          fill="white"
                          size={20}
                          className="ml-1 text-white"
                        />
                      </button>
                      <div>
                        <p className="font-bold text-gray-900">
                          Audio Overview
                        </p>
                        <p className="text-xs text-gray-500">
                          AI Generated Conversation
                        </p>
                      </div>
                    </div>
                    <div className="prose prose-sm font-mono text-gray-600 whitespace-pre-line">
                      {currentSection.podcastScript}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400 animate-pulse">
            Generating course content...
          </div>
        )}
      </main>
    </div>
  );
}
```

---

### **Phase 5: The Pages**

#### **1. The Creator Page (Home)**

This is where the user starts.

**File:** `app/page.tsx`

```tsx
"use client";

import { useObject } from "ai/react";
import { courseSchema } from "@/lib/schema";
import CourseViewer from "@/components/CourseViewer";
import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  // In a real app, this would handle file uploads and extract text
  const [mockSource] = useState({
    type: "text",
    content: "Context about React Hooks...",
  });

  const { object, submit, isLoading } = useObject({
    api: "/api/generate",
    schema: courseSchema,
    onFinish: (event) => {
      // MAGIC: Automatically update URL to the permanent public link
      const id = event.response.headers.get("x-course-id");
      if (id) {
        window.history.pushState({}, "", `/course/${id}`);
      }
    },
  });

  // If we have an object (even partial), show the Viewer
  if (object || isLoading) {
    return <CourseViewer course={object as any} />;
  }

  // Otherwise, show the Input Form
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
      <div className="max-w-xl w-full bg-white p-8 rounded-2xl shadow-xl border">
        <h1 className="text-3xl font-bold mb-2">Guest Course Generator</h1>
        <p className="text-gray-500 mb-6">
          Attach links or docs to generate a full course instantly.
        </p>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="What do you want to learn? (e.g. 'Explain Advanced Next.js caching')"
          className="w-full h-32 p-4 border rounded-xl mb-4 bg-gray-50 focus:ring-2 ring-black outline-none resize-none"
        />

        <button
          onClick={() => submit({ prompt: input, sources: [mockSource] })}
          disabled={!input}
          className="w-full py-3 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50"
        >
          Generate Course
        </button>
      </div>
    </div>
  );
}
```

#### **2. The Public Viewer Page**

This page loads the saved JSON from Redis.

**File:** `app/course/[id]/page.tsx`

```tsx
import { Redis } from "@upstash/redis";
import CourseViewer from "@/components/CourseViewer";
import { notFound } from "next/navigation";
import { Course } from "@/lib/schema";

const redis = Redis.fromEnv();

// Server Component - Fetches Data BEFORE rendering (Super Fast)
export default async function PublicCoursePage({
  params,
}: {
  params: { id: string };
}) {
  const data = await redis.get(`course:${params.id}`);

  if (!data) {
    return notFound();
  }

  // Redis returns a JSON object directly if using the SDK
  const course = data as Course;

  return <CourseViewer course={course} />;
}
```

---

### **Phase 6: Deployment Checklist**

1. **Push to GitHub.**
2. **Import to Vercel.**
3. **Add Environment Variables** in Vercel project settings.
4. **Deploy.**

**Why this is "Fast as Possible":**

1. **Parallel Processing:** You can expand the `sources` mapping in the API to fetch 5 URLs at once using `Promise.all`.
2. **Edge Runtime:** The API starts responding in milliseconds.
3. **Streaming UI:** The user sees the sidebar structure _immediately_ while the content is still being typed out.
4. **Redis Cache:** The public link (`/course/[id]`) loads instantly because it's just reading a static JSON blob, no AI generation required for viewers.

image gen 4 fast gemini for images
gemini 2.5 fast for tts
web-search , files and uploads gemini only
page refresh regen issue
