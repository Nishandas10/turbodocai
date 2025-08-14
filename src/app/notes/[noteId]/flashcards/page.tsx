"use client"

import { useState } from 'react'
import { RotateCcw, ChevronLeft, ChevronRight, BookOpen, CheckCircle, XCircle } from 'lucide-react'

interface Flashcard {
  id: string
  front: string
  back: string
  category: string
}

export default function FlashcardsPage() {
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  // Sample flashcards based on notes
  const flashcards: Flashcard[] = [
    {
      id: '1',
      front: 'What is the main concept discussed in your notes?',
      back: 'The main concept focuses on understanding the fundamental principles and their applications in real-world scenarios.',
      category: 'Concept Understanding'
    },
    {
      id: '2',
      front: 'List the key points from your notes',
      back: '1. Point A: Essential information\n2. Point B: Important details\n3. Point C: Supporting evidence',
      category: 'Key Points'
    },
    {
      id: '3',
      front: 'How do you apply this knowledge?',
      back: 'Apply the knowledge by following the step-by-step process outlined in your notes, ensuring proper implementation.',
      category: 'Application'
    },
    {
      id: '4',
      front: 'What are the common mistakes to avoid?',
      back: 'Common mistakes include overlooking important details, rushing through the process, and not following the guidelines.',
      category: 'Common Mistakes'
    }
  ]

  const handleNext = () => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1)
      setIsFlipped(false)
      setShowAnswer(false)
    }
  }

  const handlePrevious = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(currentCardIndex - 1)
      setIsFlipped(false)
      setShowAnswer(false)
    }
  }

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleAnswer = (isCorrect: boolean) => {
    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }))
    handleNext()
  }

  const resetProgress = () => {
    setCurrentCardIndex(0)
    setIsFlipped(false)
    setShowAnswer(false)
    setScore({ correct: 0, total: 0 })
  }

  const currentCard = flashcards[currentCardIndex]

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="flex items-center space-x-3">
          <BookOpen className="h-6 w-6 text-green-600" />
          <h1 className="text-xl font-semibold text-foreground">Flashcards</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Test your knowledge with AI-generated flashcards from your notes
        </p>
      </div>

      {/* Progress Bar */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
          <span>Progress: {currentCardIndex + 1} of {flashcards.length}</span>
          <span>Score: {score.correct}/{score.total}</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-green-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentCardIndex + 1) / flashcards.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Flashcard Content */}
      <div className="flex-1 p-4 flex items-center justify-center">
        <div className="w-full max-w-2xl">
          {/* Category Badge */}
          <div className="text-center mb-4">
            <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              {currentCard.category}
            </span>
          </div>

          {/* Flashcard */}
          <div 
            className={`relative w-full h-64 bg-white border-2 border-gray-200 rounded-xl shadow-lg cursor-pointer transition-all duration-500 transform ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
            onClick={handleFlip}
          >
            <div className={`absolute inset-0 p-6 flex items-center justify-center text-center ${
              isFlipped ? 'opacity-0' : 'opacity-100'
            } transition-opacity duration-300`}>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Question</h3>
                <p className="text-gray-700 text-lg leading-relaxed">{currentCard.front}</p>
                <p className="text-sm text-gray-500 mt-4">Click to flip</p>
              </div>
            </div>
            
            <div className={`absolute inset-0 p-6 flex items-center justify-center text-center ${
              isFlipped ? 'opacity-100' : 'opacity-0'
            } transition-opacity duration-300`}>
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Answer</h3>
                <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-line">{currentCard.back}</p>
                <p className="text-sm text-gray-500 mt-4">Click to flip back</p>
              </div>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-center space-x-4 mt-6">
            <button
              onClick={handlePrevious}
              disabled={currentCardIndex === 0}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <button
              onClick={handleFlip}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isFlipped ? 'Show Question' : 'Show Answer'}
            </button>
            
            <button
              onClick={handleNext}
              disabled={currentCardIndex === flashcards.length - 1}
              className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Answer Buttons */}
          {showAnswer && (
            <div className="flex items-center justify-center space-x-4 mt-6">
              <button
                onClick={() => handleAnswer(false)}
                className="flex items-center space-x-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <XCircle className="h-4 w-4" />
                <span>Incorrect</span>
              </button>
              <button
                onClick={() => handleAnswer(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
              >
                <CheckCircle className="h-4 w-4" />
                <span>Correct</span>
              </button>
            </div>
          )}

          {/* Reset Button */}
          <div className="text-center mt-6">
            <button
              onClick={resetProgress}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors mx-auto"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Reset Progress</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 