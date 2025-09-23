"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { generateQuiz, type QuizQuestion } from "@/lib/ragService"
import ProtectedRoute from "@/components/ProtectedRoute"
import { CheckCircle, XCircle, RotateCcw, Target, Loader2, Trophy } from "lucide-react"

export default function SpaceTestPage() {
  const { user } = useAuth()
  const sp = useSearchParams()
  const docIds = useMemo(() => (sp.get("docs") || "").split(",").filter(Boolean), [sp])
  const count = Number(sp.get("count") || 10)
  const difficulty = (sp.get("difficulty") as "mixed" | "easy" | "medium" | "hard") || "mixed"
  const qType = (sp.get("type") as "mcq" | "long" | "mixed") || "mcq"
  const durationMin = Math.max(1, Math.min(240, Number(sp.get("duration") || 0))) || 0

  const [questions, setQuestions] = useState<QuizQuestion[]>([])
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
        // If we still have capacity, top up from first doc
        if (all.length < count && docIds[0]) {
          try {
            const extra = await generateQuiz({ documentId: docIds[0], userId: user.uid, count: count - all.length, difficulty })
            all.push(...extra)
          } catch {}
        }
        // Shuffle and trim
        for (let i = all.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[all[i], all[j]] = [all[j], all[i]]
        }
        setQuestions(all.slice(0, count))
      } catch (e) {
        console.error(e)
        setError("Failed to generate test questions.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.uid, docIds, count, difficulty])

  const current = questions[idx]
  const progress = questions.length ? ((idx + 1) / questions.length) * 100 : 0

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

  if (loading) {
    return (
      <ProtectedRoute>
      <div className="h-full flex flex-col bg-background">
        <div className="border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-orange-600" />
            <h1 className="text-xl font-semibold text-foreground">Creating Test…</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Generating AI questions from selected documents…</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
        </div>
      </div>
      </ProtectedRoute>
    )
  }

  if (error || questions.length === 0) {
    return (
      <ProtectedRoute>
  <div className="h-full flex flex-col bg-background">
        <div className="border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-orange-600" />
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
    const pct = Math.round((score / questions.length) * 100)
    return (
      <ProtectedRoute>
      <div className="h-full flex flex-col bg-background">
        <div className="border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-orange-600" />
            <h1 className="text-xl font-semibold text-foreground">Test Results</h1>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-500 rounded-full mx-auto mb-6 flex items-center justify-center">
              <Trophy className="h-12 w-12 text-white" />
            </div>
            <div className="text-6xl font-bold text-orange-600 mb-4">{pct}%</div>
            <p className="text-lg text-foreground mb-6">You got {score} of {questions.length} correct.</p>
            <button onClick={reset} className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 mx-auto">
              <RotateCcw className="h-5 w-5" /> Retake
            </button>
          </div>
        </div>
      </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-orange-600" />
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
          <div className="bg-orange-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-6 space-y-2">
            <span className="inline-block bg-orange-100 text-orange-800 text-xs px-3 py-1 rounded-full">
              {current.category}
            </span>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{current.question}</h3>
            <div className="space-y-3">
              {current.options.map((opt, i) => (
                <button key={i} onClick={() => choose(i)} disabled={picked !== null}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    picked === null ? "border-gray-200 hover:border-orange-300 hover:bg-orange-50" :
                    picked === i ? (i === current.correctAnswer ? "border-green-500 bg-green-50" : "border-red-500 bg-red-50") :
                    i === current.correctAnswer ? "border-green-500 bg-green-50" : "border-gray-200 bg-gray-50"
                  }`}>
                  <span className="text-gray-700">{opt}</span>
                </button>
              ))}
            </div>
          </div>

          {show && (
            <div className="bg-muted rounded-xl p-6 mb-6">
              <div className="flex items-center gap-3 mb-4">
                {picked === current.correctAnswer ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                <h4 className={`text-lg font-semibold ${picked === current.correctAnswer ? "text-green-700" : "text-red-700"}`}>
                  {picked === current.correctAnswer ? "Correct!" : "Incorrect"}
                </h4>
              </div>
              <p className="text-gray-700 mb-4">{current.explanation}</p>
              <button onClick={next} className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                {idx < questions.length - 1 ? "Next Question" : "Finish Test"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </ProtectedRoute>
  )
}
