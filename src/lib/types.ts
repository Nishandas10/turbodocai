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
  // Provenance when importing a public document from another user
  sourceOwnerId?: string;
  sourceDocumentId?: string;
}

export interface Document {
  id: string;
  userId: string; // owner
  // If the document belongs to a space/workspace
  spaceId?: string;
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
  // RAG Processing fields
  processingStatus?: "pending" | "processing" | "completed" | "failed";
  processingStartedAt?: Timestamp;
  processingCompletedAt?: Timestamp;
  processingFailedAt?: Timestamp;
  processingError?: string;
  chunkCount?: number;
  characterCount?: number;
  // AI summary fields
  summary?: string;
  summaryUpdatedAt?: Timestamp;
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
  // Optional association to a space/workspace
  spaceId?: string;
}

export interface UpdateDocumentData {
  title?: string;
  content?: Partial<DocumentContent>;
  metadata?: Partial<DocumentMetadata>;
  tags?: string[];
  isPublic?: boolean;
  status?: Document["status"];
  summary?: string;
  summaryUpdatedAt?: Timestamp;
  spaceId?: string;
}

// Mind Map Types
export interface MindMap {
  id: string;
  userId: string;
  title: string;
  prompt: string;
  language: string;
  mode: string; // input mode used to create
  structure: unknown | null; // JSON structure of the mind map (TBD)
  status: "generating" | "ready" | "error";
  errorMessage?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastAccessed: Timestamp;
}

export interface CreateMindMapData {
  title: string;
  prompt: string;
  language: string;
  mode: string;
}

export interface UpdateMindMapData {
  title?: string;
  prompt?: string;
  language?: string;
  mode?: string;
  structure?: unknown;
  status?: MindMap["status"];
  errorMessage?: string;
}

// Space/Workspace Types
export interface Space {
  id: string;
  userId: string; // owner
  name: string;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateSpaceData {
  name: string;
  description?: string;
}

// Test Types
export interface SpaceTest {
  id: string;
  userId: string; // owner
  spaceId: string;
  documentIds: string[]; // selected documents for this test
  type: "mcq" | "long" | "mixed";
  difficulty: "mixed" | "easy" | "medium" | "hard";
  questionCount: number;
  durationMin: number; // in minutes
  title?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateSpaceTestData {
  documentIds: string[];
  type: "mcq" | "long" | "mixed";
  difficulty: "mixed" | "easy" | "medium" | "hard";
  questionCount: number;
  durationMin: number; // in minutes
  title?: string;
}
