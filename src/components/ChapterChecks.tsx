"use client";

import { useMemo, useState } from "react";
import { BrainCircuit, Layers, ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
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
  const [tab, setTab] = useState<"quiz" | "flashcards">("quiz");

  if (!hasQuiz && !hasFlashcards) return null;

  let activeTab = tab;
  if (activeTab === "quiz" && !hasQuiz) activeTab = "flashcards";
  if (activeTab === "flashcards" && !hasFlashcards) activeTab = "quiz";

  return (
    <section className="mt-12 border-t border-gray-300 pt-8">
      <h3 className="font-serif text-2xl font-medium text-[#1A1A1A] mb-6">
        Check your understanding
      </h3>

      <div className="flex items-center gap-8 mb-6 border-b border-gray-200">
        {hasQuiz && (
          <button
            onClick={() => setTab("quiz")}
            className={`pb-4 flex items-center gap-2 text-sm font-medium transition-all border-b-2 ${
              activeTab === "quiz"
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <BrainCircuit size={18} /> Quiz
          </button>
        )}
        {hasFlashcards && (
          <button
            onClick={() => setTab("flashcards")}
            className={`pb-4 flex items-center gap-2 text-sm font-medium transition-all border-b-2 ${
              activeTab === "flashcards"
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            <Layers size={18} /> Flashcards
          </button>
        )}
      </div>

      <div className="mt-6">
        {hasQuiz && (
          <div className={activeTab === "quiz" ? "block" : "hidden"}>
            <QuizBlock quiz={quiz!} />
          </div>
        )}
        {hasFlashcards && (
          <div className={activeTab === "flashcards" ? "block" : "hidden"}>
            <FlashcardsBlock flashcards={flashcards!} />
          </div>
        )}
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentCard = flashcards[currentIndex];
  const nextCard = flashcards[currentIndex + 1];

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-300 bg-white p-6 shadow-sm min-h-[400px] flex flex-col">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">
            Flashcards
          </h4>
          <p className="text-[#1A1A1A] text-sm">
            Card {currentIndex + 1} of {flashcards.length}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            onClick={handleNext}
            disabled={currentIndex === flashcards.length - 1}
            className="p-2 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative perspective-1000">
        {/* Stack effect cards behind */}
        {nextCard && (
          <div 
            className="absolute w-full h-full bg-white border border-gray-200 rounded-xl transform scale-95 translate-y-2 -z-10"
          ></div>
        )}
        {flashcards[currentIndex + 2] && (
          <div 
            className="absolute w-full h-full bg-white border border-gray-200 rounded-xl transform scale-90 translate-y-4 -z-20"
          ></div>
        )}

        {/* Main Card */}
        <div 
          className="relative w-full h-full min-h-[280px] cursor-pointer group perspective-1000"
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div className={`relative w-full h-full transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
            {/* Front */}
            <div className={`absolute w-full h-full backface-hidden rounded-xl p-8 flex flex-col justify-between text-center transition-shadow ${isFlipped ? 'invisible' : 'visible'}`}>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                Front
              </div>

              <div className="flex-1 flex items-center justify-center px-4">
                <div className="text-xl font-medium text-[#1A1A1A] leading-relaxed">
                  {currentCard.front}
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-400 flex items-center gap-1 justify-center">
                <RotateCw size={12} /> Click to flip
              </div>
            </div>

            {/* Back */}
            <div className={`absolute w-full h-full backface-hidden rounded-xl p-8 flex flex-col justify-between text-center transition-shadow rotate-y-180 ${isFlipped ? 'visible' : 'invisible'}`}>
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">
                Answer
              </div>

              <div className="flex-1 flex items-center justify-center px-4">
                <div className="text-lg text-gray-700 leading-relaxed">
                  {currentCard.back}
                </div>
              </div>

              <div className="mt-4 text-xs text-gray-400 flex items-center gap-1 justify-center">
                <RotateCw size={12} /> Click to flip back
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mt-6 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-black transition-all duration-300"
          style={{ width: `${((currentIndex + 1) / flashcards.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
