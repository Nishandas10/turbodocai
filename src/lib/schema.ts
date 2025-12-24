import { z } from "zod";

// This schema defines exactly what the AI must generate
export const courseSchema = z.object({
  courseTitle: z.string().describe("Catchy title for the course"),
  courseDescription: z
    .string()
    .describe("Brief summary of what the user will learn"),
  // Optional: persisted thumbnail for the course.
  // Stored as a base64-encoded PNG (no data: prefix) returned by /api/generate-image.
  // This prevents regenerating an image on every page reload.
  courseImage: z.string().optional(),
  finalTest: z
    .object({
      quiz: z
        .array(
          z.object({
            question: z.string(),
            options: z.array(z.string()).min(2),
            // Index of the correct option in `options`
            answerIndex: z.number().int().nonnegative(),
            explanation: z.string().optional(),
          })
        )
        .min(1),
      flashcards: z
        .array(
          z.object({
            front: z.string(),
            back: z.string(),
          })
        )
        .min(1),
    })
    .optional()
    .describe(
      "Optional course-wide final test (ideally 15 quiz questions + 15 flashcards)."
    ),
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
          imageSearchQuery: z
            .string()
            .describe(
              "A specific one word search query to find a relevant public domain image for this section from Wikimedia Commons. E.g. 'Steam Engine Diagram 19th Century'"
            ),
          // End-of-chapter learning checks (optional for backward compatibility).
          // If you generate them, keep at least 3 of each.
          quiz: z
            .array(
              z.object({
                question: z.string(),
                options: z.array(z.string()).min(2),
                // Index of the correct option in `options`
                answerIndex: z.number().int().nonnegative(),
                explanation: z.string().optional(),
              })
            )
            .min(3)
            .optional(),
          flashcards: z
            .array(
              z.object({
                front: z.string(),
                back: z.string(),
              })
            )
            .min(3)
            .optional(),
        })
      ),
    })
  ),
});

export type Course = z.infer<typeof courseSchema>;
