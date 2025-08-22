# Firestore Database Implementation

This document describes the complete Firestore database implementation for the TurboDocAI application, including the database schema, security rules, and React hooks for data management.

## Database Schema

### 1. Users Collection (`/users/{userId}`)
User profile information stored directly in the user document:
- `email`: string
- `displayName`: string
- `photoURL`: string
- `createdAt`: timestamp
- `subscription`: 'free' | 'premium'

### 2. Documents Collection (`/documents/{userId}/userDocuments/{documentId}`)
Documents are organized by user in a nested structure:
- `userId`: string (owner)
- `title`: string
- `type`: 'text' | 'audio' | 'pdf' | 'docx' | 'ppt' | 'youtube' | 'website' | 'image'
- `content`: object
  - `raw`: string (original content)
  - `processed`: string (processed/cleaned content)
  - `lexicalState`: object (for text documents)
- `metadata`: object
  - `fileSize?`: number
  - `fileName?`: string
  - `mimeType?`: string
  - `duration?`: number (for audio)
  - `pageCount?`: number (for PDFs)
  - `url?`: string (for YouTube/websites)
  - `language?`: string
- `status`: 'uploading' | 'processing' | 'ready' | 'error'
- `tags`: array<string>
- `createdAt`: timestamp
- `updatedAt`: timestamp
- `lastAccessed`: timestamp
- `isPublic`: boolean

### 3. Processing Queue (`/processing_queue/{taskId}`)
- `documentId`: string
- `userId`: string
- `type`: string
- `status`: 'pending' | 'processing' | 'completed' | 'failed'
- `createdAt`: timestamp
- `completedAt?`: timestamp
- `errorMessage?`: string

### 4. User Analytics (`/user_analytics/{userId}`)
- `documentsCreated`: number
- `totalStorageUsed`: number
- `lastActiveDate`: timestamp
- `featureUsage`: object

## Implementation Files

### Core Files
- `src/lib/firebase.ts` - Firebase configuration with Firestore
- `src/lib/types.ts` - TypeScript interfaces for all data models
- `src/lib/firestore.ts` - Firestore service functions
- `src/lib/documentProcessor.ts` - Document processing utilities

### React Hooks
- `src/hooks/useAuth.ts` - Authentication and user profile management
- `src/hooks/useDocuments.ts` - Document CRUD operations
- `src/hooks/useProcessingQueue.ts` - Processing queue management
- `src/hooks/useUserAnalytics.ts` - User analytics tracking

### Security
- `firestore.rules` - Firestore security rules

## Usage Examples

### 1. Authentication and User Profile

```typescript
import { useAuth } from '@/hooks/useAuth';

function App() {
  const { user, loading, signInWithGoogle, logout } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return (
      <button onClick={signInWithGoogle}>
        Sign in with Google
      </button>
    );
  }

  return (
    <div>
      <p>Welcome, {user.displayName}!</p>
      <p>Subscription: {user.profile?.subscription}</p>
      <button onClick={logout}>Sign Out</button>
    </div>
  );
}
```

### 2. Document Management

```typescript
import { useDocuments } from '@/hooks/useDocuments';
import { useAuth } from '@/hooks/useAuth';

function DocumentList() {
  const { user } = useAuth();
  const { 
    documents, 
    loading, 
    addDocument, 
    deleteDocument,
    searchDocuments 
  } = useDocuments(user?.uid);

  const handleCreateDocument = async () => {
    try {
      const documentId = await addDocument({
        title: 'New Document',
        type: 'text',
        content: {
          raw: 'Raw content here',
          processed: 'Processed content here',
        },
        metadata: {
          fileSize: 1024,
          language: 'en',
        },
        tags: ['example', 'text'],
      });
      console.log('Document created:', documentId);
    } catch (error) {
      console.error('Failed to create document:', error);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocument(documentId, user?.uid);
      console.log('Document deleted');
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  if (loading) return <div>Loading documents...</div>;

  return (
    <div>
      <button onClick={handleCreateDocument}>Create Document</button>
      {documents.map(doc => (
        <div key={doc.id}>
          <h3>{doc.title}</h3>
          <p>Type: {doc.type}</p>
          <p>Status: {doc.status}</p>
          <button onClick={() => handleDeleteDocument(doc.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 3. Processing Queue Management

```typescript
import { useProcessingQueue } from '@/hooks/useProcessingQueue';
import { useAuth } from '@/hooks/useAuth';

function ProcessingQueue() {
  const { user } = useAuth();
  const { 
    tasks, 
    loading, 
    addTask, 
    updateTaskStatus 
  } = useProcessingQueue(user?.uid);

  const handleAddTask = async (documentId: string) => {
    try {
      const taskId = await addTask(documentId, 'text-processing');
      console.log('Task added:', taskId);
    } catch (error) {
      console.error('Failed to add task:', error);
    }
  };

  const handleUpdateStatus = async (taskId: string, status: string) => {
    try {
      await updateTaskStatus(taskId, status as any);
      console.log('Task status updated');
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  if (loading) return <div>Loading tasks...</div>;

  return (
    <div>
      <h2>Processing Queue</h2>
      {tasks.map(task => (
        <div key={task.id}>
          <p>Document: {task.documentId}</p>
          <p>Type: {task.type}</p>
          <p>Status: {task.status}</p>
          <button onClick={() => handleUpdateStatus(task.id, 'completed')}>
            Mark Complete
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 4. User Analytics Tracking

```typescript
import { useUserAnalytics } from '@/hooks/useUserAnalytics';
import { useAuth } from '@/hooks/useAuth';

function Analytics() {
  const { user } = useAuth();
  const { 
    analytics, 
    loading, 
    trackFeature,
    getFormattedStorageUsage,
    getMostUsedFeatures 
  } = useUserAnalytics(user?.uid);

  const handleTrackFeature = async () => {
    try {
      await trackFeature('quizzesGenerated', 1);
      console.log('Feature usage tracked');
    } catch (error) {
      console.error('Failed to track feature:', error);
    }
  };

  if (loading) return <div>Loading analytics...</div>;
  if (!analytics) return <div>No analytics available</div>;

  return (
    <div>
      <h2>User Analytics</h2>
      <p>Documents Created: {analytics.documentsCreated}</p>
      <p>Storage Used: {getFormattedStorageUsage()}</p>
      <p>Last Active: {analytics.lastActiveDate.toDate().toLocaleDateString()}</p>
      
      <h3>Most Used Features</h3>
      {getMostUsedFeatures().map(({ feature, usage }) => (
        <p key={feature}>{feature}: {usage} times</p>
      ))}
      
      <button onClick={handleTrackFeature}>Track Quiz Generation</button>
    </div>
  );
}
```

### 5. Document Processing

```typescript
import { DocumentProcessor } from '@/lib/documentProcessor';

async function processTextDocument(rawText: string) {
  try {
    const result = await DocumentProcessor.processDocument('text', rawText);
    
    if (result.success && result.processedContent) {
      console.log('Processed content:', result.processedContent.processed);
      console.log('Language:', result.metadata?.language);
      console.log('Lexical state:', result.processedContent.lexicalState);
    } else {
      console.error('Processing failed:', result.error);
    }
  } catch (error) {
    console.error('Processing error:', error);
  }
}
```

## Security Rules

The Firestore security rules ensure:
- Users can only access their own data
- Documents can be read by owners or if marked as public
- Processing tasks are user-scoped
- Analytics are user-scoped
- Data validation for all collections

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install firebase
   ```

2. **Environment Variables**
   Create a `.env.local` file with your Firebase configuration:
   ```
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

3. **Deploy Security Rules**
   ```bash
   firebase deploy --only firestore:rules
   ```

4. **Enable Firestore**
   - Go to Firebase Console
   - Enable Firestore Database
   - Choose your preferred location
   - Start in production mode

## Next Steps

1. **Implement Document Processing**: Replace placeholder functions in `DocumentProcessor` with actual processing logic
2. **Add File Upload**: Implement file upload functionality with Firebase Storage
3. **Create Cloud Functions**: Set up Cloud Functions for background processing
4. **Add Search**: Implement full-text search using Firestore or external search services
5. **Enhance Analytics**: Add more detailed analytics and reporting features

## Notes

- The implementation includes real-time listeners for documents and processing queue
- All database operations are properly typed with TypeScript
- Error handling is implemented throughout the system
- The system automatically creates user profiles and analytics on first login
- Batch operations are available for atomic document creation with processing tasks 