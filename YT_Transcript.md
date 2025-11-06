1 Upload the image to Firebase Storage
When a user takes a photo or uploads one, store it in:
/users/{userId}/images/snapshots/image.jpg when user takes a photo and
/users/{userId}/images/image.jpg for user uploaded images and
Save metadata in Firestore:

2️ Extract Text from the Image
Use OpenAI’s gpt-4o-mini

3 Generate and Store Embeddings in openai vector db
Use OpenAI Embeddings to store semantic vectors for RAG.

4 Enable Chat, Summaries, Flashcards, and Quiz Generation on demand as Now that the text is vectorized:
