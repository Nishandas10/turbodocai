"use client"

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { CheckCircle, XCircle, RotateCcw, Trophy, Target, Loader2, SlidersHorizontal } from 'lucide-react'
import { generateQuiz, type QuizQuestion, generateFlashcards, type Flashcard, evaluateLongAnswer } from '@/lib/ragService'
import { Button } from '@/components/ui/button'
import SummaryRating from '@/components/SummaryRating'
import { createFeedback } from '@/lib/firestore'

export default function QuizPage() {
  const params = useParams()
  const { user } = useAuth()
  const noteId = params?.noteId as string

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [quizCompleted, setQuizCompleted] = useState(false)
  // MCQ-only: per-question state
  const [answers, setAnswers] = useState<(number | null)[]>([])
  const [skippedFlags, setSkippedFlags] = useState<boolean[]>([])
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [longItems, setLongItems] = useState<Flashcard[]>([])
  const [longTexts, setLongTexts] = useState<string[]>([])
  type LongEval = { verdict: 'correct' | 'incorrect' | 'insufficient' | 'skipped'; score: number; reasoning: string; keyPoints?: string[]; missingPoints?: string[] }
  const [longEvalResults, setLongEvalResults] = useState<(LongEval | null)[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<'mixed' | 'easy' | 'medium' | 'hard'>('mixed')
  const [qType, setQType] = useState<'mcq' | 'long'>('mcq')
  const [count, setCount] = useState<number>(10)
  const [prefsOpen, setPrefsOpen] = useState(false)
  const [quizRating, setQuizRating] = useState<number | undefined>()
  const [ratingSubmitting, setRatingSubmitting] = useState(false)

  useEffect(() => {
    if (!noteId || !user?.uid) return

    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        if (qType === 'mcq') {
          const generatedQuestions = await generateQuiz({
            documentId: noteId,
            userId: user.uid,
            count: Math.max(10, Math.min(30, count)),
            difficulty
          })
          if (!generatedQuestions.length) {
            setError('No quiz questions could be generated from this document. Please make sure the document has been processed successfully.')
            setQuestions([])
            return
          }
          setQuestions(generatedQuestions)
          // initialize MCQ per-question tracking
          setAnswers(Array(generatedQuestions.length).fill(null))
          setSkippedFlags(Array(generatedQuestions.length).fill(false))
          setLongItems([])
        } else {
          const cards = await generateFlashcards({
            documentId: noteId,
            userId: user.uid,
            count: Math.max(10, Math.min(30, count)),
          })
          if (!cards.length) {
            setError('No long-answer prompts could be generated. Ensure the document has sufficient content.')
            setLongItems([])
            return
          }
          setLongItems(cards)
          setQuestions([])
          setAnswers([])
          setSkippedFlags([])
          setLongTexts(Array(cards.length).fill(''))
          setLongEvalResults(Array(cards.length).fill(null))
        }
      } catch (err) {
        console.error('Error loading quiz:', err)
        setError('Failed to generate questions. Please try again later.')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [noteId, user?.uid, difficulty, qType, count])

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return // Prevent multiple selections
    setSelectedAnswer(answerIndex)
    setShowResult(true)
    // Score immediately so auto-advance works without needing the Next button
    if (answerIndex === questions[currentQuestionIndex].correctAnswer) {
      setScore(prev => prev + 1)
    }
    // persist selection for this question
    setAnswers((prev) => {
      const next = [...prev]
      next[currentQuestionIndex] = answerIndex
      return next
    })
    // if this was previously marked skipped, clear the skip flag
    if (skippedFlags[currentQuestionIndex]) {
      setSkippedFlags((prev) => {
        const next = [...prev]
        next[currentQuestionIndex] = false
        return next
      })
    }
  }

  const handleNextQuestion = () => {
    // If no answer selected, treat as skipped for this index and move on
    if (qType === 'mcq' && (answers[currentQuestionIndex] ?? null) === null) {
      if (!skippedFlags[currentQuestionIndex]) {
        setSkippedFlags((prev) => {
          const next = [...prev]
          next[currentQuestionIndex] = true
          return next
        })
      }
    }
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((idx) => idx + 1)
      setSelectedAnswer(null)
      setShowResult(false)
    } else {
      setQuizCompleted(true)
    }
  }

  const resetQuiz = () => {
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setQuizCompleted(false)
    setQuestions([])
    setLongItems([])
    setAnswers([])
    setSkippedFlags([])
    setLongTexts([])
    setLongEvalResults([])
  }

  const handleDifficultyChange = (newDifficulty: 'mixed' | 'easy' | 'medium' | 'hard') => {
    setDifficulty(newDifficulty)
    resetQuiz()
  }

  const handleQuizRating = useCallback(async (rating: number) => {
    if (!user?.uid || !noteId) return;
    setQuizRating(rating);
    setRatingSubmitting(true);
    try {
      await createFeedback(user.uid, user.email || '', 'quizzes', rating, '');
    } catch (e) {
      console.warn('Failed to save quiz rating', e);
    } finally {
      setRatingSubmitting(false);
    }
  }, [user?.uid, user?.email, noteId]);

  // Removed auto-advance for MCQ to require explicit user action
  // Sync view state when navigating MCQ questions
  useEffect(() => {
    if (qType !== 'mcq' || questions.length === 0) return
    const a = answers[currentQuestionIndex] ?? null
    setSelectedAnswer(a)
    setShowResult(a !== null)
  }, [currentQuestionIndex, answers, qType, questions.length])

  if (!user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Please sign in to access the quiz</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-orange-600" />
            <h1 className="text-xl font-semibold text-foreground">{qType === 'mcq' ? 'Quiz' : 'Long Answer Quiz'}</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {qType === 'mcq' ? 'Generating AI quiz questions from your document...' : 'Generating long-answer prompts from your document...'}
          </p>
        </div>

        {/* Loading */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-orange-600 mx-auto mb-4" />
            <p className="text-muted-foreground">Creating quiz questions...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-orange-600" />
            <h1 className="text-xl font-semibold text-foreground">{qType === 'mcq' ? 'Quiz' : 'Long Answer Quiz'}</h1>
          </div>
        </div>

        {/* Error */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Quiz Generation Failed</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  if ((qType === 'mcq' && questions.length === 0) || (qType === 'long' && longItems.length === 0)) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No {qType === 'mcq' ? 'quiz questions' : 'long-answer prompts'} available for this document</p>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = qType === 'mcq'
    ? ((currentQuestionIndex + 1) / Math.max(1, questions.length)) * 100
    : ((currentQuestionIndex + 1) / Math.max(1, longItems.length)) * 100

  if (quizCompleted) {
    const base = qType === 'mcq' ? questions.length : longItems.length
    const percentage = Math.round((score / Math.max(1, base)) * 100)
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-orange-600" />
            <h1 className="text-xl font-semibold text-foreground">{qType === 'mcq' ? 'Quiz Results' : 'Long Answer Results'}</h1>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 p-4 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-500 rounded-full mx-auto mb-6 flex items-center justify-center">
              <Trophy className="h-12 w-12 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold text-foreground mb-2">
              Quiz Complete!
            </h2>
            
            <div className="text-6xl font-bold text-orange-600 mb-4">
              {percentage}%
            </div>
            
            <p className="text-lg text-foreground mb-6">
              You got {score} out of {qType === 'mcq' ? questions.length : longItems.length} questions correct
            </p>
            
            <div className="space-y-3 mb-8">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground">Score</span>
                <span className="font-semibold">{score}/{qType === 'mcq' ? questions.length : longItems.length}</span>
              </div>
              {qType === 'mcq' && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Skipped</span>
                  <span className="font-semibold">{skippedFlags.filter(Boolean).length}</span>
                </div>
              )}
              {qType === 'mcq' && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <span className="text-muted-foreground">Difficulty</span>
                  <span className="font-semibold capitalize">{difficulty}</span>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <button
                onClick={resetQuiz}
                className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2"
              >
                <RotateCcw className="h-5 w-5" />
                <span>Take Quiz Again</span>
              </button>
              
              <div className="flex space-x-2">
                {(['easy', 'medium', 'hard', 'mixed'] as const).map((diff) => (
                  <button
                    key={diff}
                    onClick={() => handleDifficultyChange(diff)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg transition-colors ${
                      diff === difficulty
                        ? 'bg-orange-600 text-white'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {diff === 'mixed' ? 'Mixed' : diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-orange-600" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">{qType === 'mcq' ? 'Quiz' : 'Long Answer Quiz'}</h1>
              <p className="text-sm text-muted-foreground">
                {qType === 'mcq' ? 'AI-generated questions from your document' : 'Write short answers from your document understanding'}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <SummaryRating
              value={quizRating}
              onChange={handleQuizRating}
              disabled={!user?.uid || !noteId}
              loading={ratingSubmitting}
              label="Rate this quiz:"
            />
            <Button variant="outline" size="sm" onClick={() => setPrefsOpen(true)}>
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Preferences
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>Question {currentQuestionIndex + 1} of {qType === 'mcq' ? questions.length : longItems.length}</span>
          <span>Score: {score}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-orange-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Quiz Content */}
      {qType === 'mcq' ? (
        <div className="flex-1 p-4">
          <div className="max-w-2xl mx-auto">
            {/* Category and Difficulty Badge */}
            <div className="text-center mb-6 space-y-2">
              <span className="inline-block bg-orange-100 text-orange-800 text-xs px-3 py-1 rounded-full">
                {currentQuestion.category}
              </span>
              <div className="flex items-center justify-center space-x-2">
                <span className={`inline-block text-xs px-2 py-1 rounded-full ${
                  currentQuestion.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                  currentQuestion.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {currentQuestion.difficulty.charAt(0).toUpperCase() + currentQuestion.difficulty.slice(1)}
                </span>
              </div>
            </div>

            {/* Question */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                {currentQuestion.question}
              </h3>
              
              {/* Options */}
              <div className="space-y-3">
                {currentQuestion.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={selectedAnswer !== null}
                    className={`w-full p-4 text-left rounded-lg border-2 transition-all duration-200 ${
                      selectedAnswer === null
                        ? 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'
                        : selectedAnswer === index
                        ? index === currentQuestion.correctAnswer
                          ? 'border-green-500 bg-green-50'
                          : 'border-red-500 bg-red-50'
                        : index === currentQuestion.correctAnswer
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        selectedAnswer === null
                          ? 'border-gray-300'
                          : selectedAnswer === index
                          ? index === currentQuestion.correctAnswer
                            ? 'border-green-500 bg-green-500'
                            : 'border-red-500 bg-red-500'
                          : index === currentQuestion.correctAnswer
                          ? 'border-green-500 bg-green-500'
                          : 'border-gray-300'
                      }`}>
                        {selectedAnswer !== null && (
                          index === currentQuestion.correctAnswer ? (
                            <CheckCircle className="h-4 w-4 text-white" />
                          ) : selectedAnswer === index ? (
                            <XCircle className="h-4 w-4 text-white" />
                          ) : null
                        )}
                      </div>
                      <span className="text-gray-700">{option}</span>
                    </div>
                  </button>
                ))}
              </div>
              {/* Navigation: Previous + Next/Finish */}
              {!showResult && (
                <div className="mt-4 flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (currentQuestionIndex > 0) {
                        setCurrentQuestionIndex((idx) => idx - 1)
                      }
                    }}
                    disabled={currentQuestionIndex === 0}
                    className={`px-4 py-2 rounded-lg border transition-colors ${currentQuestionIndex === 0 ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-800'}`}
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleNextQuestion}
                    className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                  </button>
                </div>
              )}
            </div>

            {/* Result and Explanation */}
            {showResult && (
              <div className="bg-muted rounded-xl p-6 mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  {selectedAnswer === currentQuestion.correctAnswer ? (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                  <h4 className={`text-lg font-semibold ${
                    selectedAnswer === currentQuestion.correctAnswer ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {selectedAnswer === currentQuestion.correctAnswer ? 'Correct!' : 'Incorrect'}
                  </h4>
                </div>
                <p className="text-gray-700 mb-4">{currentQuestion.explanation}</p>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => {
                      if (currentQuestionIndex > 0) {
                        setCurrentQuestionIndex((idx) => idx - 1)
                      }
                    }}
                    disabled={currentQuestionIndex === 0}
                    className={`px-4 py-2 rounded-lg border transition-colors ${currentQuestionIndex === 0 ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-800'}`}
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleNextQuestion}
                    className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 p-4">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Answer the following:</h3>
              <div className="text-sm text-muted-foreground mb-3">Write a concise answer based on your notes.</div>
              <div className="bg-muted rounded-lg p-4 mb-4">
                <div className="text-xs text-muted-foreground mb-1">Prompt</div>
                <p className="text-foreground whitespace-pre-wrap">{longItems[currentQuestionIndex]?.front || ''}</p>
              </div>
              <LongAnswerBlock
                key={currentQuestionIndex}
                referenceAnswer={longItems[currentQuestionIndex]?.back || ''}
                textValue={longTexts[currentQuestionIndex] || ''}
                onTextChange={(v) => {
                  setLongTexts((prev) => {
                    const next = [...prev]
                    next[currentQuestionIndex] = v
                    return next
                  })
                }}
                savedResult={longEvalResults[currentQuestionIndex] || null}
                onResultChange={(r) => {
                  setLongEvalResults((prev) => {
                    const next = [...prev]
                    const prevR = prev[currentQuestionIndex]
                    next[currentQuestionIndex] = r
                    // adjust score differentially
                    const wasCorrect = prevR?.verdict === 'correct'
                    const nowCorrect = r?.verdict === 'correct'
                    if (wasCorrect !== nowCorrect) {
                      setScore((s) => s + (nowCorrect ? 1 : -1))
                    }
                    return next
                  })
                }}
                onNext={() => {
                  if (currentQuestionIndex < longItems.length - 1) {
                    setCurrentQuestionIndex((n) => n + 1)
                  } else {
                    setQuizCompleted(true)
                  }
                }}
                onPrev={() => {
                  if (currentQuestionIndex > 0) setCurrentQuestionIndex((i) => i - 1)
                }}
                canGoPrev={currentQuestionIndex > 0}
                isLast={currentQuestionIndex >= longItems.length - 1}
                onSubmit={async (text, setResult) => {
                  try {
                    const res = await evaluateLongAnswer({ userId: user!.uid, userAnswer: text, referenceAnswer: longItems[currentQuestionIndex]?.back || '' })
                    setResult(res)
                    // persist result and adjust score via onResultChange
                    setLongEvalResults((prev) => {
                      const next = [...prev]
                      const prevR = prev[currentQuestionIndex]
                      next[currentQuestionIndex] = res
                      const wasCorrect = prevR?.verdict === 'correct'
                      const nowCorrect = res?.verdict === 'correct'
                      if (wasCorrect !== nowCorrect) {
                        setScore((s) => s + (nowCorrect ? 1 : -1))
                      }
                      return next
                    })
                  } catch {
                    setResult({ verdict: 'insufficient', score: 0, reasoning: 'Could not evaluate answer. Please try next question.' })
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
      <PreferencesModal
        isOpen={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        initial={{ qType, count, difficulty }}
        onApply={({ qType: t, count: c, difficulty: d }) => {
          const needReset = t !== qType || c !== count || (t === 'mcq' && d !== difficulty)
          setQType(t)
          setCount(c)
          if (t === 'mcq') setDifficulty(d)
          setPrefsOpen(false)
          if (needReset) resetQuiz()
        }}
      />
    </div>
  )
} 

// Long answer interaction component (simplified, adapted)
function LongAnswerBlock({
  referenceAnswer,
  onNext,
  onPrev,
  canGoPrev,
  textValue,
  onTextChange,
  savedResult,
  onResultChange,
  isLast,
  onSubmit,
}: {
  referenceAnswer: string
  onNext: () => void
  onPrev: () => void
  canGoPrev: boolean
  textValue: string
  onTextChange: (v: string) => void
  savedResult: { verdict: "correct" | "incorrect" | "insufficient" | "skipped"; score: number; reasoning: string; keyPoints?: string[]; missingPoints?: string[] } | null
  onResultChange: (r: { verdict: "correct" | "incorrect" | "insufficient" | "skipped"; score: number; reasoning: string; keyPoints?: string[]; missingPoints?: string[] } | null) => void
  isLast: boolean
  onSubmit: (text: string, setResult: (r: { verdict: "correct" | "incorrect" | "insufficient" | "skipped"; score: number; reasoning: string; keyPoints?: string[]; missingPoints?: string[] }) => void) => Promise<void> | void
}) {
  const [text, setText] = useState(textValue)
  const [submitted, setSubmitted] = useState(!!savedResult)
  const [result, setResult] = useState<{ verdict: "correct" | "incorrect" | "insufficient" | "skipped"; score: number; reasoning: string; keyPoints?: string[]; missingPoints?: string[] } | null>(savedResult ?? null)

  useEffect(() => {
    setText(textValue)
  }, [textValue])

  useEffect(() => {
    setSubmitted(!!savedResult)
    setResult(savedResult ?? null)
  }, [savedResult])

  const handleSubmit = () => {
    setSubmitted(true)
    onSubmit(text, (r) => {
      setResult(r)
      onResultChange(r)
    })
  }

  if (submitted && result) {
    return (
      <div className="bg-muted rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          {result.verdict === "correct" ? (
            <CheckCircle className="h-6 w-6 text-green-600" />
          ) : result.verdict === "skipped" ? (
            // using XCircle as a neutral icon alternative
            <XCircle className="h-6 w-6 text-blue-600" />
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
          <button onClick={onNext} className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
            {isLast ? 'Finish Quiz' : 'Next Question'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          onTextChange(e.target.value)
        }}
        placeholder="Type your answer here..."
        className="w-full h-40 bg-background border border-border rounded-lg px-3 py-2 text-card-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50"
      />
      <div className="mt-3 flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={!canGoPrev}
          className={`px-4 py-2 rounded-lg border transition-colors ${!canGoPrev ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground' : 'bg-white border-gray-300 hover:bg-gray-50 text-gray-800'}`}
        >
          Previous
        </button>
        <button
          onClick={handleSubmit}
          className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
          disabled={!text.trim()}
        >
          Submit Answer
        </button>
        <button
          onClick={() => {
            setSubmitted(true)
            const r = { verdict: "skipped" as const, score: 0, reasoning: "You chose to skip this question.", keyPoints: [], missingPoints: [] }
            setResult(r)
            onResultChange(r)
          }}
          className="text-sm text-muted-foreground hover:underline"
        >
          Skip
        </button>
      </div>
    </div>
  )
}

type Prefs = { qType: 'mcq' | 'long'; count: number; difficulty: 'mixed' | 'easy' | 'medium' | 'hard' }

function PreferencesModal({
  isOpen,
  onClose,
  initial,
  onApply,
}: {
  isOpen: boolean
  onClose: () => void
  initial: Prefs
  onApply: (prefs: Prefs) => void
}) {
  const [localType, setLocalType] = useState<Prefs['qType']>(initial.qType)
  const [localCount, setLocalCount] = useState<number>(initial.count)
  const [localDiff, setLocalDiff] = useState<Prefs['difficulty']>(initial.difficulty)

  useEffect(() => {
    if (isOpen) {
      setLocalType(initial.qType)
      setLocalCount(initial.count)
      setLocalDiff(initial.difficulty)
    }
  }, [isOpen, initial])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-card-foreground">Quiz Preferences</h2>
          <button onClick={onClose} className="w-8 h-8 bg-muted rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground">✕</button>
        </div>
        <div className="p-5 space-y-5">
          {/* Type */}
          <div>
            <div className="text-xs text-muted-foreground mb-2">Question Type</div>
            <div className="flex gap-2">
              {(['mcq','long'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setLocalType(t)}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${localType === t ? 'bg-orange-600 text-white border-orange-600' : 'bg-background border-border text-foreground hover:border-orange-400/50'}`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div>
            <div className="text-xs text-muted-foreground mb-2">Question Count</div>
            <div className="flex flex-wrap gap-2">
              {[10,15,20,25,30].map((c) => (
                <button
                  key={c}
                  onClick={() => setLocalCount(c)}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${localCount === c ? 'bg-orange-600 text-white border-orange-600' : 'bg-background border-border text-foreground hover:border-orange-400/50'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty (MCQ only) */}
          {localType === 'mcq' && (
            <div>
              <div className="text-xs text-muted-foreground mb-2">Difficulty</div>
              <div className="flex flex-wrap gap-2">
                {(['easy','medium','hard','mixed'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setLocalDiff(d)}
                    className={`px-3 py-2 rounded-md border text-sm transition-colors ${localDiff === d ? 'bg-orange-600 text-white border-orange-600' : 'bg-background border-border text-foreground hover:border-orange-400/50'}`}
                  >
                    {d === 'mixed' ? 'Mixed' : d[0].toUpperCase()+d.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onApply({ qType: localType, count: localCount, difficulty: localDiff })}>Apply</Button>
          </div>
        </div>
      </div>
    </div>
  )
}