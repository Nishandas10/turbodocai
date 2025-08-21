import { Timestamp } from "firebase/firestore";

// User Profile Types
export interface UserProfile {
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: Timestamp;
  subscription: "free" | "premium";
}

export interface User {
  id: string;
  profile: UserProfile;
}

// Document Types
export interface DocumentContent {
  raw: string;
  processed: string;
  lexicalState?: object; // for text documents
}

export interface DocumentMetadata {
  fileSize?: number;
  fileName?: string;
  mimeType?: string;
  duration?: number; // for audio
  pageCount?: number; // for PDFs
  url?: string; // for YouTube/websites
  language?: string;
  storagePath?: string; // Firebase Storage path
  downloadURL?: string; // Firebase Storage download URL
  originalFile?: File; // Temporary reference to original file (not stored in Firestore)
}

export interface Document {
  id: string;
  userId: string; // owner
  title: string;
  type:
    | "text"
    | "audio"
    | "pdf"
    | "docx"
    | "ppt"
    | "pptx"
    | "youtube"
    | "website"
    | "image";
  content: DocumentContent;
  metadata: DocumentMetadata;
  status: "uploading" | "processing" | "ready" | "error";
  tags: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastAccessed: Timestamp;
  isPublic: boolean;
}

// File Upload Types
export interface FileUploadData {
  file: File;
  userId: string;
  title?: string;
  tags?: string[];
  isPublic?: boolean;
}

export interface StorageUploadResult {
  success: boolean;
  documentId?: string;
  storagePath?: string;
  downloadURL?: string;
  error?: string;
}

// Processing Queue Types
export interface ProcessingTask {
  id: string;
  documentId: string;
  userId: string;
  type: string;
  status: "pending" | "processing" | "completed" | "failed";
  createdAt: Timestamp;
  completedAt?: Timestamp;
  errorMessage?: string;
}

// User Analytics Types
export interface FeatureUsage {
  [key: string]: number; // e.g., "quizzesGenerated": 5, "flashcardsCreated": 3
}

export interface UserAnalytics {
  id: string;
  documentsCreated: number;
  totalStorageUsed: number;
  lastActiveDate: Timestamp;
  featureUsage: FeatureUsage;
}

// Document Creation/Update Types
export interface CreateDocumentData {
  title: string;
  type: Document["type"];
  content: DocumentContent;
  metadata: DocumentMetadata;
  tags?: string[];
  isPublic?: boolean;
}

export interface UpdateDocumentData {
  title?: string;
  content?: Partial<DocumentContent>;
  metadata?: Partial<DocumentMetadata>;
  tags?: string[];
  isPublic?: boolean;
  status?: Document["status"];
}
