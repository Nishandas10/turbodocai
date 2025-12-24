import type { Course } from "@/lib/schema";

type QuizQuestion = NonNullable<
  NonNullable<Course["finalTest"]>["quiz"]
>[number];
type Flashcard = NonNullable<
  NonNullable<Course["finalTest"]>["flashcards"]
>[number];

function normalizeWhitespace(s: string): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Build a course-wide test by aggregating questions/flashcards across all sections.
 * - Dedupe by normalized question/front text.
 * - Prefer earlier items in the course order.
 * - Returns up to `limit` items each.
 */
export function buildFinalTestFromCourse(
  course: Course,
  limit = 15
): {
  quiz: QuizQuestion[];
  flashcards: Flashcard[];
} {
  const quiz: QuizQuestion[] = [];
  const flashcards: Flashcard[] = [];

  const seenQ = new Set<string>();
  const seenF = new Set<string>();

  for (const mod of course.modules ?? []) {
    for (const sec of mod.sections ?? []) {
      if (Array.isArray(sec.quiz)) {
        for (const q of sec.quiz) {
          if (!q?.question || !Array.isArray(q.options) || q.options.length < 2)
            continue;
          if (typeof q.answerIndex !== "number") continue;

          const key = normalizeWhitespace(q.question);
          if (!key || seenQ.has(key)) continue;

          seenQ.add(key);
          quiz.push(q);
          if (quiz.length >= limit) break;
        }
      }
      if (quiz.length >= limit && flashcards.length >= limit)
        return { quiz, flashcards };

      if (Array.isArray(sec.flashcards)) {
        for (const f of sec.flashcards) {
          if (!f?.front || !f?.back) continue;
          const key = normalizeWhitespace(f.front);
          if (!key || seenF.has(key)) continue;

          seenF.add(key);
          flashcards.push(f);
          if (flashcards.length >= limit) break;
        }
      }

      if (quiz.length >= limit && flashcards.length >= limit)
        return { quiz, flashcards };
    }
  }

  return { quiz, flashcards };
}
