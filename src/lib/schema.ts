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
              "Detailed educational content in Markdown format. Use headings, sub-headings, tables, block quotes, bullet points, and bold text wherever applicable"
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
