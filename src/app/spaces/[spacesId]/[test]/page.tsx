"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { generateQuiz, type QuizQuestion, generateFlashcards, type Flashcard, evaluateLongAnswer } from "@/lib/ragService"
import ProtectedRoute from "@/components/ProtectedRoute"
import { CheckCircle, XCircle, RotateCcw, Target, Loader2, Trophy, MinusCircle, ChevronLeft, ChevronRight } from "lucide-react"

export default function SpaceTestPage() {
  const { user } = useAuth()
  const sp = useSearchParams()
  const docIds = useMemo(() => (sp.get("docs") || "").split(",").filter(Boolean), [sp])
  const count = Number(sp.get("count") || 10)
  const difficulty = (sp.get("difficulty") as "mixed" | "easy" | "medium" | "hard") || "mixed"
  const qType = (sp.get("type") as "mcq" | "long" | "mixed") || "mcq"
  const durationMin = Math.max(1, Math.min(240, Number(sp.get("duration") || 0))) || 0

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [longItems, setLongItems] = useState<Flashcard[]>([])
  type MixedItem = { kind: "mcq"; q: QuizQuestion } | { kind: "long"; fc: Flashcard }
  const [mixedItems, setMixedItems] = useState<MixedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [idx, setIdx] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [show, setShow] = useState(false)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null) // seconds
  const endTimeRef = useRef<number | null>(null)

  // Start timer on questions load if duration provided
  useEffect(() => {
    if (!durationMin || done || loading) return
    if (!endTimeRef.current) {
      endTimeRef.current = Date.now() + durationMin * 60_000
    }
    const tick = () => {
      if (!endTimeRef.current) return
      const leftMs = endTimeRef.current - Date.now()
      const s = Math.max(0, Math.floor(leftMs / 1000))
      setTimeLeft(s)
      if (s <= 0) {
        setDone(true)
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [durationMin, done, loading])

  useEffect(() => {
    if (!user?.uid || !docIds.length) return
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        if (qType === "long") {
          const perDoc = Math.max(1, Math.floor(count / docIds.length))
          const all: Flashcard[] = []
          for (const id of docIds) {
            try {
              const cards = await generateFlashcards({ documentId: id, userId: user.uid, count: perDoc })
              all.push(...cards)
            } catch {
              /* ignore */
            }
          }
          if (all.length < count && docIds[0]) {
            try {
              const extra = await generateFlashcards({ documentId: docIds[0], userId: user.uid, count: count - all.length })
              all.push(...extra)
            } catch {}
          }
          // Shuffle and trim
          for (let i = all.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[all[i], all[j]] = [all[j], all[i]]
          }
          setLongItems(all.slice(0, count))
        } else if (qType === "mixed") {
          // Split count ~50/50
          const mcqTarget = Math.floor(count / 2)
          const longTarget = count - mcqTarget

          // Fetch MCQs
          const perDocMcq = Math.max(1, Math.floor(mcqTarget / docIds.length))
          const allMcq: QuizQuestion[] = []
          for (const id of docIds) {
            try {
              const qs = await generateQuiz({ documentId: id, userId: user.uid, count: perDocMcq, difficulty })
              allMcq.push(...qs)
            } catch {/* ignore */}
          }
          if (allMcq.length < mcqTarget && docIds[0]) {
            try {
              const extra = await generateQuiz({ documentId: docIds[0], userId: user.uid, count: mcqTarget - allMcq.length, difficulty })
              allMcq.push(...extra)
            } catch {/* ignore */}
          }

          // Fetch Long
          const perDocLong = Math.max(1, Math.floor(longTarget / docIds.length))
          const allLong: Flashcard[] = []
          for (const id of docIds) {
            try {
              const cards = await generateFlashcards({ documentId: id, userId: user.uid, count: perDocLong })
              allLong.push(...cards)
            } catch {/* ignore */}
          }
          if (allLong.length < longTarget && docIds[0]) {
            try {
              const extra = await generateFlashcards({ documentId: docIds[0], userId: user.uid, count: longTarget - allLong.length })
              allLong.push(...extra)
            } catch {/* ignore */}
          }

          // Shuffle individually for variety
          const shuffle = <T,>(arr: T[]) => {
            for (let i = arr.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1))
              ;[arr[i], arr[j]] = [arr[j], arr[i]]
            }
          }
          shuffle(allMcq)
          shuffle(allLong)

          // Interleave 1:1, then append leftovers, then trim to count
          const items: MixedItem[] = []
          const maxLen = Math.max(allMcq.length, allLong.length)
          for (let i = 0; i < maxLen; i++) {
            if (i < allMcq.length) items.push({ kind: "mcq", q: allMcq[i] })
            if (i < allLong.length) items.push({ kind: "long", fc: allLong[i] })
          }
          setMixedItems(items.slice(0, count))
        } else {
          // default MCQ path
          const perDoc = Math.max(1, Math.floor(count / docIds.length))
          const all: QuizQuestion[] = []
          for (const id of docIds) {
            try {
              const qs = await generateQuiz({ documentId: id, userId: user.uid, count: perDoc, difficulty })
              all.push(...qs)
            } catch {
              // continue; one doc failing shouldn't block others
            }
          }
          if (all.length < count && docIds[0]) {
            try {
              const extra = await generateQuiz({ documentId: docIds[0], userId: user.uid, count: count - all.length, difficulty })
              all.push(...extra)
            } catch {}
          }
          for (let i = all.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[all[i], all[j]] = [all[j], all[i]]
          }
          setQuestions(all.slice(0, count))
        }
      } catch (e) {
        console.error(e)
        setError("Failed to generate test questions.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.uid, docIds, count, difficulty, qType])

  const current = qType === "long" ? undefined : questions[idx]
  const totalItems = qType === "long" ? longItems.length : qType === "mixed" ? mixedItems.length : questions.length
  const progress = totalItems ? ((idx + 1) / totalItems) * 100 : 0

  const choose = (i: number) => {
    if (picked !== null) return
    setPicked(i)
    setShow(true)
    if (current && i === current.correctAnswer) setScore((s) => s + 1)
  }

  const next = () => {
    if (picked === null) return
    if (idx < questions.length - 1) {
      setIdx((n) => n + 1)
      setPicked(null)
      setShow(false)
    } else {
      setDone(true)
    }
  }

  const reset = () => {
    setIdx(0)
    setPicked(null)
    setShow(false)
    setScore(0)
    setDone(false)
  }

  // Global arrow navigation
  const goPrev = () => {
    if (idx === 0) return
    setIdx((n) => Math.max(0, n - 1))
    setPicked(null)
    setShow(false)
  }
  const goNext = () => {
    if (idx >= Math.max(0, totalItems - 1)) {
      setDone(true)
      return
    }
    setIdx((n) => n + 1)
    setPicked(null)
    setShow(false)
  }

  const ArrowNav = () => (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center pointer-events-none select-none">
      <div className="pointer-events-auto bg-white/90 backdrop-blur border border-gray-200 rounded-full shadow-md flex items-center overflow-hidden">
        <button
          aria-label="Previous question"
          onClick={goPrev}
          disabled={idx === 0}
          className={`p-3 transition-colors ${idx === 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50'} `}
        >
          <ChevronLeft className="h-6 w-6 text-blue-700" />
        </button>
        <div className="w-px h-6 bg-gray-200" />
        <button
          aria-label="Next question"
          onClick={goNext}
          disabled={idx >= Math.max(0, totalItems - 1)}
          className={`p-3 transition-colors ${idx >= Math.max(0, totalItems - 1) ? 'opacity-40 cursor-not-allowed' : 'hover:bg-blue-50'} `}
        >
          <ChevronRight className="h-6 w-6 text-blue-700" />
        </button>
      </div>
    </div>
  )

  if (loading) {
    return (
      <ProtectedRoute>
      <div className="h-full flex flex-col bg-background">
        <div className="border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-foreground">Creating Test…</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Generating AI questions from selected documents…</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </div>
      </ProtectedRoute>
    )
  }

  if (error || (qType === "long" ? longItems.length === 0 : qType === "mixed" ? mixedItems.length === 0 : questions.length === 0)) {
    return (
      <ProtectedRoute>
  <div className="h-full flex flex-col bg-background">
        <div className="border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-foreground">Test</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <XCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <p className="text-muted-foreground">{error || "No questions could be generated."}</p>
          </div>
        </div>
      </div>
      </ProtectedRoute>
    )
  }

  if (done) {
    const base = qType === "long" ? longItems.length : qType === "mixed" ? mixedItems.length : questions.length
    const pct = Math.round((score / Math.max(1, base)) * 100)
    return (
      <ProtectedRoute>
      <div className="h-full flex flex-col bg-background">
        <div className="border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-semibold text-foreground">Test Results</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full mx-auto mb-6 flex items-center justify-center">
              <Trophy className="h-12 w-12 text-white" />
            </div>
            <div className="text-6xl font-bold text-blue-600 mb-4">{pct}%</div>
            <p className="text-lg text-foreground mb-6">You got {score} of {base} correct.</p>
            <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto">
              <RotateCcw className="h-5 w-5" /> Retake
            </button>
          </div>
        </div>
      </div>
      </ProtectedRoute>
    )
  }

  // ---------- Mixed questions UI ----------
  if (qType === "mixed") {
    const item = mixedItems[idx]
    const header = (
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Test</h1>
              <p className="text-sm text-muted-foreground">
                From {docIds.length} documents • Difficulty: {difficulty} • Type: MIXED
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {durationMin ? (
              <span className={`font-medium ${timeLeft !== null && timeLeft <= 30 ? 'text-red-600' : ''}`}>
                Time Left: {timeLeft !== null ? `${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}` : '--:--'}
              </span>
            ) : null}
            <span>Score: {score}</span>
          </div>
        </div>
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    )

    if (!item) return null
    // MCQ item
    if (item.kind === "mcq") {
      const mcq = item.q
      const [pickedLocal, setPickedLocal] = [picked, setPicked]
      const [showLocal, setShowLocal] = [show, setShow]
      const chooseLocal = (i: number) => {
        if (pickedLocal !== null) return
        setPickedLocal(i)
        setShowLocal(true)
        if (i === mcq.correctAnswer) setScore((s) => s + 1)
      }
      const nextLocal = () => {
        if (pickedLocal === null) return
        if (idx < mixedItems.length - 1) {
          setIdx((n) => n + 1)
          setPickedLocal(null)
          setShowLocal(false)
        } else {
          setDone(true)
        }
      }
      return (
        <ProtectedRoute>
          <div className="h-full flex flex-col bg-background">
            {header}
            <div className="flex-1 p-4">
              <div className="max-w-2xl mx-auto">
                <div className="text-center mb-6 space-y-2">
                  <span className="inline-block bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">{mcq.category}</span>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">{mcq.question}</h3>
                  <div className="space-y-3">
                    {mcq.options.map((opt, i) => (
                      <button key={i} onClick={() => chooseLocal(i)} disabled={pickedLocal !== null}
                        className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                          pickedLocal === null ? "border-gray-200 hover:border-blue-300 hover:bg-blue-50" :
                          pickedLocal === i ? (i === mcq.correctAnswer ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50") :
                          i === mcq.correctAnswer ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50"
                        }`}>
                        <span className="text-gray-700">{opt}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {showLocal && (
                  <div className="bg-muted rounded-xl p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                      {pickedLocal === mcq.correctAnswer ? (
                        <CheckCircle className="h-6 w-6 text-green-600" />
                      ) : (
                        <XCircle className="h-6 w-6 text-red-600" />
                      )}
                      <h4 className={`text-lg font-semibold ${pickedLocal === mcq.correctAnswer ? "text-green-700" : "text-red-700"}`}>
                        {pickedLocal === mcq.correctAnswer ? "Correct!" : "Incorrect"}
                      </h4>
                    </div>
                    <p className="text-gray-700 mb-4">{mcq.explanation}</p>
                    <button onClick={nextLocal} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      {idx < mixedItems.length - 1 ? "Next Question" : "Finish Test"}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <ArrowNav />
          </div>
        </ProtectedRoute>
      )
    }

    // Long item
    const card = item.fc
    return (
      <ProtectedRoute>
        <div className="h-full flex flex-col bg-background">
          {header}
          <div className="flex-1 p-4">
            <div className="max-w-3xl mx-auto">
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{idx + 1}. {card.front}</h3>
                <LongAnswerBlock
                  key={`mix-${idx}`}
                  referenceAnswer={card.back || ""}
                  userId={user?.uid || ""}
                  onNext={goNext}
                  isLast={idx >= mixedItems.length - 1}
                  onSubmit={async (text, setResult) => {
                    try {
                      const res = await evaluateLongAnswer({
                        userId: user?.uid || "",
                        userAnswer: text,
                        referenceAnswer: card.back || "",
                        minLength: 120,
                      })
                      setResult(res)
                      if (res.verdict === "correct") setScore((s) => s + 1)
                    } catch (e) {
                      setResult({ verdict: "incorrect", score: 0, reasoning: "Evaluation failed. Please try again.", keyPoints: [], missingPoints: [] })
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <ArrowNav />
        </div>
      </ProtectedRoute>
    )
  }

  // ---------- Long questions UI ----------
  if (qType === "long") {
    const item = longItems[idx]
    return (
      <ProtectedRoute>
        <div className="h-full flex flex-col bg-background">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Target className="h-6 w-6 text-blue-600" />
                <div>
                  <h1 className="text-xl font-semibold text-foreground">Test</h1>
                  <p className="text-sm text-muted-foreground">
                    From {docIds.length} documents • Difficulty: {difficulty} • Type: LONG
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {durationMin ? (
                  <span className={`font-medium ${timeLeft !== null && timeLeft <= 30 ? 'text-red-600' : ''}`}>
                    Time Left: {timeLeft !== null ? `${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}` : '--:--'}
                  </span>
                ) : null}
                <span>Score: {score}</span>
              </div>
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="flex-1 p-4">
            <div className="max-w-3xl mx-auto">
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{idx + 1}. {item?.front}</h3>
                <LongAnswerBlock
                  key={`${idx}`}
                  referenceAnswer={item?.back || ""}
                  userId={user?.uid || ""}
                  onNext={goNext}
                  isLast={idx >= longItems.length - 1}
                  onSubmit={async (text, setResult) => {
                    try {
                      const res = await evaluateLongAnswer({
                        userId: user?.uid || "",
                        userAnswer: text,
                        referenceAnswer: item?.back || "",
                        minLength: 120,
                      })
                      setResult(res)
                      if (res.verdict === "correct") setScore((s) => s + 1)
                    } catch (e) {
                      setResult({ verdict: "incorrect", score: 0, reasoning: "Evaluation failed. Please try again.", keyPoints: [], missingPoints: [] })
                    }
                  }}
                />
              </div>
            </div>
          </div>
          <ArrowNav />
        </div>
      </ProtectedRoute>
    )
  }

  // ---------- MCQ UI (existing) ----------
  const q = questions[idx]!
  return (
    <ProtectedRoute>
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Test</h1>
              <p className="text-sm text-muted-foreground">
                From {docIds.length} documents • Difficulty: {difficulty} • Type: {qType.toUpperCase()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {durationMin ? (
              <span className={`font-medium ${timeLeft !== null && timeLeft <= 30 ? 'text-red-600' : ''}`}>
                Time Left: {timeLeft !== null ? `${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,'0')}` : '--:--'}
              </span>
            ) : null}
            <span>Score: {score}</span>
          </div>
        </div>
        <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6 space-y-2">
            <span className="inline-block bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
              {q.category}
            </span>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{q.question}</h3>
            <div className="space-y-3">
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => choose(i)} disabled={picked !== null}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    picked === null ? "border-gray-200 hover:border-blue-300 hover:bg-blue-50" :
                    picked === i ? (i === q.correctAnswer ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50") :
                    i === q.correctAnswer ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50"
                  }`}>
                  <span className="text-gray-700">{opt}</span>
                </button>
              ))}
            </div>
          </div>

          {show && (
            <div className="bg-muted rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                {picked === q.correctAnswer ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                <h4 className={`text-lg font-semibold ${picked === q.correctAnswer ? "text-green-700" : "text-red-700"}`}>
                  {picked === q.correctAnswer ? "Correct!" : "Incorrect"}
                </h4>
              </div>
              <p className="text-gray-700 mb-4">{q.explanation}</p>
              <button onClick={next} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {idx < questions.length - 1 ? "Next Question" : "Finish Test"}
              </button>
            </div>
          )}
        </div>
      </div>
      <ArrowNav />
    </div>
    </ProtectedRoute>
  )
}

// Long answer interaction component (kept local to this file)
function LongAnswerBlock({
  referenceAnswer,
  userId,
  onNext,
  isLast,
  onSubmit,
}: {
  referenceAnswer: string
  userId: string
  onNext: () => void
  isLast: boolean
  onSubmit: (text: string, setResult: (r: { verdict: "correct" | "incorrect" | "insufficient" | "skipped"; score: number; reasoning: string; keyPoints?: string[]; missingPoints?: string[] }) => void) => Promise<void> | void
}) {
  const [text, setText] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [result, setResult] = useState<{ verdict: "correct" | "incorrect" | "insufficient" | "skipped"; score: number; reasoning: string; keyPoints?: string[]; missingPoints?: string[] } | null>(null)

  const handleSubmit = () => {
    setSubmitted(true)
    onSubmit(text, setResult)
  }

  if (submitted && result) {
    return (
      <div className="bg-muted rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          {result.verdict === "correct" ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : result.verdict === "skipped" ? (
            <MinusCircle className="h-6 w-6 text-blue-600" />
          ) : (
            <XCircle className="h-6 w-6 text-red-600" />
          )}
          <h4 className={`text-lg font-semibold ${
            result.verdict === 'correct' ? 'text-green-700' :
            result.verdict === 'insufficient' ? 'text-yellow-700' :
            result.verdict === 'skipped' ? 'text-blue-700' : 'text-red-700'
          }`}>
            {result.verdict === "correct" ? "Correct!" : result.verdict === "insufficient" ? "Not enough information" : result.verdict === 'skipped' ? 'Skipped' : "Marked Incorrect"}
          </h4>
        </div>
        {result.reasoning ? (
          <p className="text-sm text-muted-foreground mb-3">{result.reasoning}</p>
        ) : null}
        {result.keyPoints?.length ? (
          <div className="text-sm mb-2"><span className="font-medium">Key points covered:</span> {result.keyPoints.join(", ")}</div>
        ) : null}
        {result.missingPoints?.length ? (
          <div className="text-sm mb-4"><span className="font-medium">Missing:</span> {result.missingPoints.join(", ")}</div>
        ) : null}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Reference Answer</div>
          <p className="text-gray-800 whitespace-pre-wrap">{referenceAnswer}</p>
        </div>
        <div className="mt-4">
          <button onClick={onNext} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            {isLast ? 'Finish Test' : 'Next Question'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your answer here..."
        className="w-full h-40 bg-background border border-border rounded-lg px-3 py-2 text-card-foreground focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
      />
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          disabled={!text.trim()}
        >
          Submit Answer
        </button>
        <button
          onClick={() => {
            setSubmitted(true)
            setResult({ verdict: "skipped", score: 0, reasoning: "You chose to skip this question.", keyPoints: [], missingPoints: [] })
          }}
          className="text-sm text-muted-foreground hover:underline"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
