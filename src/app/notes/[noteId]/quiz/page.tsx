"use client"

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { CheckCircle, XCircle, RotateCcw, Trophy, Target, Loader2 } from 'lucide-react'
import { generateQuiz, type QuizQuestion } from '@/lib/ragService'

export default function QuizPage() {
  const params = useParams()
  const { user } = useAuth()
  const noteId = params?.noteId as string

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [difficulty, setDifficulty] = useState<'mixed' | 'easy' | 'medium' | 'hard'>('mixed')
  // Optional auto-advance (2s) after showing result
  const AUTO_ADVANCE_MS = 2000
  const [autoAdvance] = useState(true)

  useEffect(() => {
    if (!noteId || !user?.uid) return

    const loadQuiz = async () => {
      try {
        setLoading(true)
        setError(null)
        const generatedQuestions = await generateQuiz({
          documentId: noteId,
          userId: user.uid,
          count: 10,
          difficulty
        })
        
        if (generatedQuestions.length === 0) {
          setError("No quiz questions could be generated from this document. Please make sure the document has been processed successfully.")
          return
        }
        
        setQuestions(generatedQuestions)
      } catch (err) {
        console.error('Error loading quiz:', err)
        setError("Failed to generate quiz questions. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    loadQuiz()
  }, [noteId, user?.uid, difficulty])

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return // Prevent multiple selections
    setSelectedAnswer(answerIndex)
    setShowResult(true)
    // Score immediately so auto-advance works without needing the Next button
    if (answerIndex === questions[currentQuestionIndex].correctAnswer) {
      setScore(prev => prev + 1)
    }
  }

  const handleNextQuestion = () => {
    if (selectedAnswer === null) return
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(idx => idx + 1)
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
  }

  const handleDifficultyChange = (newDifficulty: 'mixed' | 'easy' | 'medium' | 'hard') => {
    setDifficulty(newDifficulty)
    resetQuiz()
  }

  // Auto advance effect
  useEffect(() => {
    if (!autoAdvance) return
    if (!showResult || selectedAnswer === null) return
    const isLast = currentQuestionIndex === questions.length - 1
    const timer = setTimeout(() => {
      if (isLast) {
        setQuizCompleted(true)
      } else {
        setCurrentQuestionIndex(idx => idx + 1)
        setSelectedAnswer(null)
        setShowResult(false)
      }
    }, AUTO_ADVANCE_MS)
    return () => clearTimeout(timer)
  }, [autoAdvance, showResult, selectedAnswer, currentQuestionIndex, questions.length])

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
            <h1 className="text-xl font-semibold text-foreground">Quiz</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Generating AI quiz questions from your document...
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
            <h1 className="text-xl font-semibold text-foreground">Quiz</h1>
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

  if (questions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">No quiz questions available for this document</p>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100

  if (quizCompleted) {
    const percentage = Math.round((score / questions.length) * 100)
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border p-4">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-orange-600" />
            <h1 className="text-xl font-semibold text-foreground">Quiz Results</h1>
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
              You got {score} out of {questions.length} questions correct
            </p>
            
            <div className="space-y-3 mb-8">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground">Score</span>
                <span className="font-semibold">{score}/{questions.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-muted-foreground">Difficulty</span>
                <span className="font-semibold capitalize">{difficulty}</span>
              </div>
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
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Target className="h-6 w-6 text-orange-600" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">Quiz</h1>
              <p className="text-sm text-muted-foreground">
                AI-generated questions from your document
              </p>
            </div>
          </div>
          
          {/* Difficulty Selector */}
          <div className="flex space-x-1 bg-muted rounded-lg p-1">
            {(['easy', 'medium', 'hard', 'mixed'] as const).map((diff) => (
              <button
                key={diff}
                onClick={() => handleDifficultyChange(diff)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  diff === difficulty
                    ? 'bg-orange-600 text-white'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {diff === 'mixed' ? 'Mixed' : diff.charAt(0).toUpperCase() + diff.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>Question {currentQuestionIndex + 1} of {questions.length}</span>
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
              <button
                onClick={handleNextQuestion}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
              >
                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 