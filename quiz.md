

### Phase 1: Update the Data Contract (Schema)

The first step is to mandate that the AI generates practice content for every section.

1. **Locate your Schema Definition:** Open the file where you defined your `courseSchema` (using Zod).
2. **Modify the Section Object:** Inside the `sections` array, add two new required fields:
* **`quiz`**: Define this as an array of objects. Each object must contain a `question`, a list of `options`, the index of the `correctAnswer`, and an `explanation`.
* **`flashcards`**: Define this as an array of objects containing `front` (term) and `back` (definition).


3. **Enforce Limits:** Chain a validation rule (like `.min(3)`) to both arrays to ensure the AI always generates at least 3 questions and 3 flashcards per lesson.

### Phase 2: Update the User Interface

You need to expand your current "Viewer" component to handle the new interactive mode.

1. **Add a "Practice" Tab:**
* In your `CourseViewer` component, locate the header where you have "Explanation" and "Podcast" tabs.
* Add a third button labeled **"Practice"** (or "Quiz").
* Create a state variable (e.g., `activeTab`) to track which view is currently open.


2. **Implement Flashcard Logic:**
* Create a container that displays the flashcards in a grid layout.
* **State Management:** Create a local state object to track which cards are currently "flipped." The key should be the card index, and the value a boolean (true/false).
* **Interaction:** Add an `onClick` handler to each card that toggles its specific index in the state object.


3. **Implement Quiz Logic:**
* Render the list of questions below the flashcards.
* **State Management:** Create a local state object to track the user's selected answer for each question index.
* **Interaction:** When a user clicks an option, update the state with their selection.
* **Feedback System:** Immediately compare the user's selection with the `correctAnswer` provided by the schema.
* If matches: Style the box green and show the `explanation`.
* If mismatch: Style the box red, highlight the correct answer, and show the `explanation`.





### Phase 3: Add Animation Styles

To make the flashcards feel high-quality, you need to add specific 3D transformation utilities.

1. **Update Global CSS:** Open your global stylesheet.
2. **Add Utility Classes:** Add custom CSS classes for:
* `perspective`: To give the 3D depth effect.
* `preserve-3d`: To ensure child elements rotate in 3D space.
* `backface-visibility: hidden`: To hide the "back" of the card when it is facing away from the user.
* `rotate-y-180`: A utility to physically rotate the card element 180 degrees.
