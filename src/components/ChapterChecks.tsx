"use client";

import { useMemo, useState } from "react";
import type { Course } from "@/lib/schema";

type Quiz = NonNullable<NonNullable<Course["modules"]>[number]["sections"]>[number]["quiz"];
type Flashcards = NonNullable<NonNullable<Course["modules"]>[number]["sections"]>[number]["flashcards"];

export default function ChapterChecks({
  quiz,
  flashcards,
}: {
  quiz?: Quiz;
  flashcards?: Flashcards;
}) {
  const hasQuiz = Array.isArray(quiz) && quiz.length >= 3;
  const hasFlashcards = Array.isArray(flashcards) && flashcards.length >= 3;

  if (!hasQuiz && !hasFlashcards) return null;

  return (
    <section className="mt-12 border-t border-gray-300 pt-8">
      <h3 className="font-serif text-2xl font-medium text-[#1A1A1A] mb-6">
        Check your understanding
      </h3>

      <div className="grid grid-cols-1 gap-8">
        {hasQuiz ? <QuizBlock quiz={quiz!} /> : null}
        {hasFlashcards ? <FlashcardsBlock flashcards={flashcards!} /> : null}
      </div>
    </section>
  );
}

function QuizBlock({ quiz }: { quiz: NonNullable<Quiz> }) {
  const [selected, setSelected] = useState<Record<number, number | null>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const score = useMemo(() => {
    let correct = 0;
    for (let i = 0; i < quiz.length; i++) {
      const choice = selected[i];
      const correctAnswer = quiz[i].answerIndex;
      
      // Safety check: if answerIndex is undefined, skip this question
      if (typeof correctAnswer !== "number") {
        continue;
      }
      
      const isCorrect = typeof choice === "number" && choice === correctAnswer;
      
      if (isCorrect) correct++;
    }
    return correct;
  }, [quiz, selected]);

  return (
    <div className="rounded-2xl border border-gray-300 bg-white p-6 shadow-sm">
      {/* Check for corrupted quiz data */}
      {quiz.some((q) => typeof q.answerIndex !== "number" || !q.options || q.options.length === 0) && (
        <div className="mb-4 p-4 bg-rose-50 border border-rose-300 rounded-lg">
          <p className="text-sm font-medium text-rose-900">
            ⚠️ Quiz data is corrupted (missing answer keys or options). Please regenerate this course.
          </p>
        </div>
      )}
      
      <div className="flex items-start justify-between gap-6 mb-5">
        <div>
          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
            Quiz (min 3)
          </h4>
          <p className="text-[#1A1A1A] text-sm">
            Answer, then reveal to see explanations.
          </p>
        </div>
        <div className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-full px-3 py-1">
          Score: <span className="font-medium text-gray-900">{score}</span>/{quiz.length}
        </div>
      </div>

      <div className="space-y-6">
        {quiz.map((q, idx) => {
          const choice = selected[idx] ?? null;
          const isRevealed = revealed[idx] ?? false;
          
          // Safety check: only calculate isCorrect if answerIndex is valid
          const isCorrect = isRevealed && 
            typeof q.answerIndex === "number" && 
            choice === q.answerIndex;

          return (
            <div key={idx} className="border border-gray-200 rounded-xl p-5">
              <p className="font-medium text-[#1A1A1A] mb-3">
                {idx + 1}. {q.question}
              </p>

              <div className="space-y-2">
                {q.options?.map((opt, optIdx) => {
                  const picked = choice === optIdx;
                  // Safety: only highlight correct answer if answerIndex is valid
                  const correct = isRevealed && 
                    typeof q.answerIndex === "number" && 
                    optIdx === q.answerIndex;
                  const wrongPick = isRevealed && 
                    picked && 
                    typeof q.answerIndex === "number" && 
                    optIdx !== q.answerIndex;

                  return (
                    <button
                      key={optIdx}
                      type="button"
                      disabled={isRevealed}
                      onClick={() => {
                        setSelected((s) => ({ ...s, [idx]: optIdx }));
                      }}
                      className={
                        "w-full text-left px-4 py-3 rounded-lg border transition-colors text-sm " +
                        (correct
                          ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                          : wrongPick
                            ? "border-rose-300 bg-rose-50 text-rose-900"
                            : picked
                              ? "border-gray-400 bg-gray-50"
                              : "border-gray-200 hover:bg-gray-50") +
                        (isRevealed ? " cursor-default" : "")
                      }
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium bg-[#FBE7A1] hover:bg-[#F7D978] text-[#1A1A1A] rounded-full transition-colors"
                  onClick={() => {
                    setRevealed((r) => ({ ...r, [idx]: true }));
                  }}
                  disabled={isRevealed || typeof choice !== "number"}
                  aria-disabled={isRevealed || typeof choice !== "number"}
                  title={typeof choice !== "number" ? "Pick an option first" : ""}
                >
                  Reveal answer
                </button>

                <button
                  type="button"
                  className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-full text-[#1A1A1A] hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    setSelected((s) => ({ ...s, [idx]: null }));
                    setRevealed((r) => ({ ...r, [idx]: false }));
                  }}
                >
                  Reset
                </button>

                {isRevealed ? (
                  <span
                    className={
                      "text-sm font-medium " +
                      (isCorrect ? "text-emerald-700" : "text-rose-700")
                    }
                  >
                    {isCorrect ? "Correct" : "Not quite"}
                  </span>
                ) : null}
              </div>

              {isRevealed && q.explanation ? (
                <div className="mt-4 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <span className="font-medium text-gray-900">Why:</span> {q.explanation}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlashcardsBlock({ flashcards }: { flashcards: NonNullable<Flashcards> }) {
  const [flipped, setFlipped] = useState<Record<number, boolean>>({});

  return (
    <div className="rounded-2xl border border-gray-300 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">
          Flashcards (min 3)
        </h4>
        <p className="text-[#1A1A1A] text-sm">
          Click a card to flip it.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {flashcards.map((c, idx) => {
          const isFlipped = flipped[idx] ?? false;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setFlipped((f) => ({ ...f, [idx]: !isFlipped }))}
              className="text-left rounded-xl border border-gray-200 bg-[#F8F6F3] hover:bg-[#f3efe9] transition-colors p-5 min-h-[110px]"
            >
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                Card {idx + 1}
              </div>
              <div className="text-[#1A1A1A] text-sm leading-relaxed">
                {isFlipped ? c.back : c.front}
              </div>
              <div className="mt-3 text-xs text-gray-500">
                {isFlipped ? "Back" : "Front"} • Click to flip
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
