# Firebase Storage Implementation

This document describes the complete Firebase Storage implementation for the TurboDocAI application, including the storage structure, security rules, and integration with Firestore.

## Storage Structure

The Firebase Storage follows a hierarchical folder structure that keeps files organized by user and type:

```
/users/{userId}/
├── documents/
│   ├── {documentId}.pdf
│   ├── {documentId}.docx
│   ├── {documentId}.pptx
│   └── {documentId}.txt
├── audio/
│   ├── {documentId}.mp3
│   ├── {documentId}.wav
│   └── recordings/
│       └── {documentId}.mp3
└── images/
    ├── {documentId}.jpg
    ├── {documentId}.png
    └── snapshots/
        └── {documentId}.jpg
```

### Key Features

- **User Isolation**: Each user's files are stored in their own folder (`/users/{userId}/`)
- **Type Organization**: Files are grouped by type (documents, audio, images)
- **Document ID Mapping**: Storage file names match Firestore document IDs for easy mapping
- **Specialized Folders**: Recordings and snapshots have dedicated subfolders

## Implementation Files

### Core Storage Service (`src/lib/storage.ts`)

- `uploadDocument()` - Upload PDF, DOCX, PPTX files
- `uploadAudio()` - Upload audio files (MP3, WAV, etc.)
- `uploadRecording()` - Upload live recordings
- `uploadImage()` - Upload image files
- `uploadSnapshot()` - Upload camera snapshots
- `uploadFile()` - Auto-detect file type and upload
- `deleteFile()` - Delete files from storage
- `getFileDownloadURL()` - Get download URLs
- `base64ToFile()` - Convert base64 images to File objects

### File Upload Service (`src/lib/fileUploadService.ts`)

- `uploadDocumentFile()` - Complete document upload with metadata
- `uploadAudioFile()` - Complete audio upload with metadata
- `uploadRecordingFile()` - Complete recording upload with metadata
- `uploadImageFile()` - Complete image upload with metadata
- `uploadCameraSnapshot()` - Complete camera snapshot upload with metadata
- `uploadAnyFile()` - Auto-detect and upload any file type

### Firestore Integration (`src/lib/firestore.ts`)

- `createDocumentWithFile()` - Create document with file metadata
- `updateDocumentStorageInfo()` - Update document with storage paths

## Security Rules

### Storage Rules (`storage.rules`)

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Users can only access their own files
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Deny all other access
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

### Key Security Features

- **Authentication Required**: All operations require user authentication
- **User Isolation**: Users can only access files in their own folder
- **Path Validation**: Explicit rules for each folder type
- **Deny by Default**: All other paths are denied access

## Usage Examples

### Upload a Document

```typescript
import { uploadDocumentFile } from "@/lib/fileUploadService";

const result = await uploadDocumentFile(file, userId, {
  title: "My Document",
  tags: ["work", "important"],
  isPublic: false,
});

if (result.success) {
  console.log("Document uploaded:", result.documentId);
  console.log("Storage path:", result.storagePath);
  console.log("Download URL:", result.downloadURL);
}
```

### Upload Audio

```typescript
import { uploadAudioFile } from "@/lib/fileUploadService";

const result = await uploadAudioFile(audioFile, userId, {
  title: "Meeting Recording",
  tags: ["meeting", "recording"],
});
```

### Upload Camera Snapshot

```typescript
import { uploadCameraSnapshot } from "@/lib/fileUploadService";

const result = await uploadCameraSnapshot(base64ImageData, userId, {
  title: "Whiteboard Photo",
  tags: ["whiteboard", "meeting"],
});
```

## File Type Support

### Documents

- **PDF** (`.pdf`) → `/users/{userId}/documents/{documentId}.pdf`
- **Word** (`.docx`, `.doc`) → `/users/{userId}/documents/{documentId}.docx`
- **PowerPoint** (`.pptx`, `.ppt`) → `/users/{userId}/documents/{documentId}.pptx`
- **Text** (`.txt`) → `/users/{userId}/documents/{documentId}.txt`

### Audio

- **Audio Files** (`.mp3`, `.wav`, `.m4a`) → `/users/{userId}/audio/{documentId}.{ext}`
- **Recordings** (Live recorded audio) → `/users/{userId}/audio/recordings/{documentId}.{ext}`

### Images

- **Image Files** (`.jpg`, `.png`, `.gif`) → `/users/{userId}/images/{documentId}.{ext}`
- **Camera Snapshots** → `/users/{userId}/images/snapshots/{documentId}.jpg`

## Metadata Storage

All file metadata is stored in Firestore with the following structure:

```typescript
interface DocumentMetadata {
  fileSize?: number; // File size in bytes
  fileName?: string; // Original filename
  mimeType?: string; // MIME type
  storagePath?: string; // Firebase Storage path
  downloadURL?: string; // Firebase Storage download URL
  duration?: number; // Audio duration (for audio files)
  pageCount?: number; // Page count (for PDFs)
  language?: string; // Detected language
}
```

## Error Handling

The implementation includes comprehensive error handling:

- **Upload Failures**: Network errors, authentication issues, storage quota exceeded
- **File Validation**: File type, size, and format validation
- **User Feedback**: Clear error messages and success confirmations
- **Retry Logic**: Automatic retry for transient failures

## Performance Considerations

- **Chunked Uploads**: Large files are uploaded in chunks for better reliability
- **Progress Tracking**: Upload progress indicators for better UX
- **Background Processing**: File processing happens asynchronously
- **Caching**: Download URLs are cached to reduce API calls

## Setup Instructions

### 1. Enable Firebase Storage

1. Go to Firebase Console
2. Navigate to Storage
3. Click "Get started"
4. Choose your preferred location
5. Start in production mode

### 2. Deploy Storage Rules

```bash
firebase deploy --only storage
```

### 3. Update Environment Variables

Ensure your `.env.local` includes:

```env
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

### 4. Test Uploads

1. Start your development server
2. Try uploading different file types
3. Check Firebase Console for uploaded files
4. Verify Firestore metadata is created

## Monitoring and Analytics

### Storage Usage Tracking

- File size tracking per user
- Storage quota monitoring
- Upload/download analytics
- Error rate monitoring

### Cost Optimization

- File compression for images
- Audio format optimization
- Automatic cleanup of old files
- Storage class selection

## Next Steps

1. **File Processing**: Implement document text extraction
2. **Audio Transcription**: Add speech-to-text for audio files
3. **Image OCR**: Extract text from images and documents
4. **Batch Operations**: Support for multiple file uploads
5. **File Sharing**: Implement file sharing between users
6. **Version Control**: Add file versioning support
7. **Backup & Sync**: Implement file backup and synchronization

## Troubleshooting

### Common Issues

1. **Upload Fails**

   - Check Firebase Storage rules
   - Verify user authentication
   - Check file size limits
   - Ensure proper file permissions

2. **Files Not Appearing**

   - Check Firestore for metadata
   - Verify storage paths
   - Check console for errors
   - Verify file format support

3. **Permission Denied**
   - Check user authentication status
   - Verify storage security rules
   - Check user ID matching
   - Ensure proper file paths

### Debug Mode

Enable debug logging by setting:

```typescript
localStorage.setItem("debug", "firebase:storage");
```

## Support

For issues or questions:

1. Check Firebase Console logs
2. Review browser console errors
3. Verify security rules
4. Check file format support
5. Review authentication status
