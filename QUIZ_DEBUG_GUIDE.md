# Quiz Debugging Console Logs Guide

## What I Added

I've instrumented `src/components/ChapterChecks.tsx` with **detailed step-by-step browser console logging** to help diagnose why correct answers might show as wrong.

## Console Log Categories

### 🔄 Component Lifecycle

- **Mount/Unmount**: Logs when ChapterChecks component mounts and unmounts
- Shows the full quiz data structure received from the course

### 🎯 Score Calculation (runs on every state change)

- Shows a grouped table for all questions with:
  - Question text
  - User's selected option index
  - Correct answer index
  - User's selected answer text
  - Correct answer text
  - Whether the answer is correct
  - Final score calculation

### 📝 Question Rendering

- Logs each question as it's rendered with:
  - Question index and text
  - User's current choice
  - Correct answer index
  - Reveal state
  - All available options

### 🖱️ User Click Events

- **Option Selection**: Logs when user clicks an option, showing:
  - Question index
  - Option index clicked
  - Option text
  - Correct answer index
  - Whether this selection will be correct

### 👁️ Answer Reveal

- Logs when "Reveal answer" is clicked with:
  - Question index
  - User's choice
  - Correct answer index
  - Whether the answer is correct

### 🔄 Reset Action

- Logs when a question is reset

## How to Use

1. **Open Browser DevTools** (F12 or Ctrl+Shift+I)
2. **Navigate to Console tab**
3. **Load a course** with quiz questions
4. **Answer questions** and watch the logs
5. **Click "Reveal answer"**

## What to Look For

### ✅ If Working Correctly:

```
🎯 Quiz Score Calculation
  Question 1: {
    userSelected: 2,
    correctAnswerIndex: 2,
    isCorrect: true
  }
```

### ❌ If There's a Mismatch:

```
🎯 Quiz Score Calculation
  Question 1: {
    userSelected: 2,          // What you clicked
    correctAnswerIndex: 1,    // What AI generated
    userSelectedText: "Paris",
    correctAnswerText: "London",
    isCorrect: false
  }
```

## Root Cause Scenarios

### 1. **AI Generated Wrong answerIndex**

If logs show `correctAnswerIndex` doesn't match the actual correct option:

- The AI may have miscounted (0-based vs 1-based)
- The AI may have shuffled options in its mind
- **Fix**: Regenerate the course or manually fix the data

### 2. **Option Array Order Changed**

If the option at `correctAnswerText` doesn't match what you expected:

- Check if options were reordered during generation
- Verify the schema validation in `/api/generate`

### 3. **State Persistence Bug**

If clicking correct answer on Q1 shows wrong, but logs show correct state:

- Check if the `key` prop is being used correctly
- Verify React isn't reusing component instances

## Example Debug Session

```javascript
// User clicks option B (index 1) for "What is 2+2?"
🖱️ User clicked option 2 for question 1: {
  questionIndex: 0,
  optionIndex: 1,
  optionText: "4",
  correctAnswerIndex: 1,
  willBeCorrect: true
}

// User clicks "Reveal answer"
👁️ Revealing answer for question 1: {
  questionIndex: 0,
  userChoice: 1,
  correctAnswerIndex: 1,
  isCorrect: true
}

// Score updates
🎯 Quiz Score Calculation
  Question 1: {
    question: "What is 2+2?",
    userSelected: 1,
    correctAnswerIndex: 1,
    userSelectedText: "4",
    correctAnswerText: "4",
    isCorrect: true,
  }
  ✅ Final Score: 1/3
```

## Next Steps

After you test with these logs:

1. **Share the console output** if the issue persists
2. We can add a **schema validation step** to catch bad answerIndex values
3. We can add a **quiz data inspector UI** to preview correct answers in dev mode
4. We can add **server-side validation** in `/api/generate` to reject invalid quizzes

## Quick Test

Run this in your browser console after a quiz loads:

```javascript
// Dump all quiz data for current chapter
console.table(document.querySelectorAll("[data-quiz-question]"));
```

(Note: You'll need to add `data-quiz-question` attributes if you want this quick test)
