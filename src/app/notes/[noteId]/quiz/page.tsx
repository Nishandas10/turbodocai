"use client"

import { useState } from 'react'
import { CheckCircle, XCircle, RotateCcw, Trophy, Target } from 'lucide-react'

interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  category: string
}

export default function QuizPage() {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [timeSpent, setTimeSpent] = useState(0)

  // Sample quiz questions based on notes
  const questions: QuizQuestion[] = [
    {
      id: '1',
      question: 'What is the primary focus of the main concept in your notes?',
      options: [
        'Understanding basic principles',
        'Advanced applications only',
        'Historical context',
        'Technical implementation'
      ],
      correctAnswer: 0,
      explanation: 'The main concept focuses on understanding the fundamental principles first, which then leads to applications.',
      category: 'Concept Understanding'
    },
    {
      id: '2',
      question: 'Which of the following is NOT a key point mentioned in your notes?',
      options: [
        'Step-by-step process',
        'Important guidelines',
        'Common pitfalls',
        'External references'
      ],
      correctAnswer: 3,
      explanation: 'External references were not mentioned as key points in your notes.',
      category: 'Key Points'
    },
    {
      id: '3',
      question: 'How should you approach the application of this knowledge?',
      options: [
        'Jump directly to complex scenarios',
        'Follow the outlined process carefully',
        'Skip the basic steps',
        'Modify the process as needed'
      ],
      correctAnswer: 1,
      explanation: 'The notes emphasize following the outlined process carefully to ensure proper implementation.',
      category: 'Application'
    },
    {
      id: '4',
      question: 'What is the recommended way to avoid common mistakes?',
      options: [
        'Ignore the guidelines',
        'Rush through the process',
        'Follow the guidelines precisely',
        'Skip the preparation phase'
      ],
      correctAnswer: 2,
      explanation: 'Following the guidelines precisely is the best way to avoid common mistakes mentioned in your notes.',
      category: 'Best Practices'
    }
  ]

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return // Prevent multiple selections
    setSelectedAnswer(answerIndex)
    setShowResult(true)
  }

  const handleNextQuestion = () => {
    if (selectedAnswer !== null) {
      if (selectedAnswer === questions[currentQuestionIndex].correctAnswer) {
        setScore(score + 1)
      }
      
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1)
        setSelectedAnswer(null)
        setShowResult(false)
      } else {
        setQuizCompleted(true)
      }
    }
  }

  const resetQuiz = () => {
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
    setQuizCompleted(false)
    setTimeSpent(0)
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
                <span className="text-muted-foreground">Time Spent</span>
                <span className="font-semibold">{Math.round(timeSpent / 60)}m {timeSpent % 60}s</span>
              </div>
            </div>
            
            <button
              onClick={resetQuiz}
              className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2"
            >
              <RotateCcw className="h-5 w-5" />
              <span>Take Quiz Again</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center space-x-3">
          <Target className="h-6 w-6 text-orange-600" />
          <h1 className="text-xl font-semibold text-foreground">Quiz</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Test your knowledge with AI-generated questions from your notes
        </p>
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
          {/* Category Badge */}
          <div className="text-center mb-6">
            <span className="inline-block bg-orange-100 text-orange-800 text-xs px-3 py-1 rounded-full">
              {currentQuestion.category}
            </span>
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