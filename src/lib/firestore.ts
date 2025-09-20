import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  writeBatch,
  onSnapshot,
  DocumentData,
  QuerySnapshot,
  Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import {
  UserProfile,
  Document,
  ProcessingTask,
  UserAnalytics,
  CreateDocumentData,
  UpdateDocumentData,
  MindMap,
  CreateMindMapData,
  UpdateMindMapData,
  Space,
  CreateSpaceData,
} from "./types";

// Collection names
const COLLECTIONS = {
  USERS: "users",
  DOCUMENTS: "documents",
  PROCESSING_QUEUE: "processing_queue",
  USER_ANALYTICS: "user_analytics",
  MINDMAPS: "mindmaps",
  SPACES: "spaces",
} as const;

// ===== USER OPERATIONS =====

/**
 * Create a new user profile on first login/signup
 */
export const createUserProfile = async (
  userId: string,
  profileData: Omit<UserProfile, "createdAt" | "subscription">
): Promise<void> => {
  const userRef = doc(db, COLLECTIONS.USERS, userId);

  const profile: UserProfile = {
    ...profileData,
    createdAt: Timestamp.now(),
    subscription: "free",
  };

  // Use setDoc to create the user document with profile data
  await setDoc(userRef, profile);
};

/**
 * Get user profile
 */
export const getUserProfile = async (
  userId: string
): Promise<UserProfile | null> => {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  const userSnap = await getDoc(userRef);

  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> => {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  await updateDoc(userRef, updates);
};

/**
 * Update user subscription
 */
export const updateUserSubscription = async (
  userId: string,
  subscription: "free" | "premium"
): Promise<void> => {
  await updateUserProfile(userId, { subscription });
};

// ===== DOCUMENT OPERATIONS =====

/**
 * Create a new document
 */
export const createDocument = async (
  userId: string,
  documentData: CreateDocumentData
): Promise<string> => {
  const now = Timestamp.now();

  const document: Omit<Document, "id"> = {
    userId,
    ...documentData,
    status: "uploading",
    tags: documentData.tags || [],
    isPublic: documentData.isPublic || false,
    createdAt: now,
    updatedAt: now,
    lastAccessed: now,
  };

  // Create document in nested structure: documents/{userId}/{documentId}
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const docRef = await addDoc(userDocumentsRef, document);

  // Update user analytics
  await incrementUserAnalytics(userId, {
    documentsCreated: 1,
    totalStorageUsed: documentData.metadata.fileSize || 0,
  });

  return docRef.id;
};

// ===== SPACES (WORKSPACES) OPERATIONS =====

export const createSpace = async (
  userId: string,
  data: CreateSpaceData
): Promise<string> => {
  const now = Timestamp.now();
  const spRef = await addDoc(collection(db, COLLECTIONS.SPACES), {
    userId,
    name: data.name,
    description: data.description || "",
    createdAt: now,
    updatedAt: now,
  } as Omit<Space, "id">);
  return spRef.id;
};

export const getSpace = async (spaceId: string): Promise<Space | null> => {
  const ref = doc(db, COLLECTIONS.SPACES, spaceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Space;
};

export const listenToUserSpaces = (
  userId: string,
  callback: (spaces: Space[]) => void
): Unsubscribe => {
  const qy = query(
    collection(db, COLLECTIONS.SPACES),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(qy, (snap) => {
    const spaces = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Space[];
    callback(spaces);
  });
};

export const listenToSpaceDocuments = (
  userId: string,
  spaceId: string,
  callback: (documents: Document[]) => void
): Unsubscribe => {
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const qy = query(
    userDocumentsRef,
    where("spaceId", "==", spaceId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(qy, (snapshot) => {
    const documents = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Document[];
    callback(documents);
  });
};

/**
 * Get document by ID
 */
export const getDocument = async (
  documentId: string,
  userId: string
): Promise<Document | null> => {
  const docRef = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments",
    documentId
  );
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Document;
  }
  return null;
};

/**
 * Get documents for a user
 */
export const getUserDocuments = async (
  userId: string,
  limitCount: number = 50
): Promise<Document[]> => {
  // Query the nested collection: documents/{userId}/userDocuments
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const q = query(
    userDocumentsRef,
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Document[];
};

/**
 * Update document
 */
export const updateDocument = async (
  documentId: string,
  userId: string,
  updates: UpdateDocumentData
): Promise<void> => {
  const docRef = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments",
    documentId
  );
  const updateData = {
    ...updates,
    updatedAt: Timestamp.now(),
  };

  await updateDoc(docRef, updateData);
};

/**
 * Update document status
 */
export const updateDocumentStatus = async (
  documentId: string,
  userId: string,
  status: Document["status"]
): Promise<void> => {
  await updateDocument(documentId, userId, { status });
};

/**
 * Update (or create) stored AI summary for a document
 */
export const updateDocumentSummary = async (
  documentId: string,
  userId: string,
  summary: string
): Promise<void> => {
  await updateDocument(documentId, userId, {
    summary,
    summaryUpdatedAt: Timestamp.now(),
  });
};

/**
 * Delete document
 */
export const deleteDocument = async (
  documentId: string,
  userId: string
): Promise<void> => {
  const docRef = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments",
    documentId
  );
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const documentData = docSnap.data() as Document;

    // Update user analytics
    await incrementUserAnalytics(userId, {
      documentsCreated: -1,
      totalStorageUsed: -(documentData.metadata.fileSize || 0),
    });

    await deleteDoc(docRef);
  }
};

/**
 * Update document last accessed time
 */
export const updateDocumentLastAccessed = async (
  documentId: string,
  userId: string
): Promise<void> => {
  const docRef = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments",
    documentId
  );
  await updateDoc(docRef, { lastAccessed: Timestamp.now() });
};

// ===== PROCESSING QUEUE OPERATIONS =====

/**
 * Add a task to the processing queue
 */
export const addProcessingTask = async (
  documentId: string,
  userId: string,
  type: string
): Promise<string> => {
  const task: Omit<ProcessingTask, "id"> = {
    documentId,
    userId,
    type,
    status: "pending",
    createdAt: Timestamp.now(),
  };

  const taskRef = await addDoc(
    collection(db, COLLECTIONS.PROCESSING_QUEUE),
    task
  );
  return taskRef.id;
};

/**
 * Update processing task status
 */
export const updateProcessingTaskStatus = async (
  taskId: string,
  status: ProcessingTask["status"],
  errorMessage?: string
): Promise<void> => {
  const taskRef = doc(db, COLLECTIONS.PROCESSING_QUEUE, taskId);
  const updates: Partial<ProcessingTask> = {
    status,
    ...(status === "completed" || status === "failed"
      ? { completedAt: Timestamp.now() }
      : {}),
    ...(errorMessage ? { errorMessage } : {}),
  };

  await updateDoc(taskRef, updates);
};

/**
 * Get pending processing tasks
 */
export const getPendingProcessingTasks = async (): Promise<
  ProcessingTask[]
> => {
  const q = query(
    collection(db, COLLECTIONS.PROCESSING_QUEUE),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc")
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as ProcessingTask[];
};

// ===== USER ANALYTICS OPERATIONS =====

/**
 * Get user analytics
 */
export const getUserAnalytics = async (
  userId: string
): Promise<UserAnalytics | null> => {
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  const analyticsSnap = await getDoc(analyticsRef);

  if (analyticsSnap.exists()) {
    return { id: analyticsSnap.id, ...analyticsSnap.data() } as UserAnalytics;
  }
  return null;
};

/**
 * Initialize user analytics
 */
export const initializeUserAnalytics = async (
  userId: string
): Promise<void> => {
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  const analytics: Omit<UserAnalytics, "id"> = {
    documentsCreated: 0,
    totalStorageUsed: 0,
    lastActiveDate: Timestamp.now(),
    featureUsage: {},
  };

  // Use setDoc to create the analytics document
  await setDoc(analyticsRef, analytics);
};

/**
 * Increment user analytics counters
 */
export const incrementUserAnalytics = async (
  userId: string,
  increments: Partial<
    Pick<UserAnalytics, "documentsCreated" | "totalStorageUsed">
  >
): Promise<void> => {
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);

  // Check if analytics exist, if not create them
  const existingAnalytics = await getUserAnalytics(userId);
  if (!existingAnalytics) {
    await initializeUserAnalytics(userId);
  }

  // Use FieldValue.increment() for atomic operations
  const updates: Record<string, number | Timestamp> = {
    lastActiveDate: Timestamp.now(),
  };

  if (increments.documentsCreated !== undefined) {
    updates.documentsCreated = increments.documentsCreated;
  }

  if (increments.totalStorageUsed !== undefined) {
    updates.totalStorageUsed = increments.totalStorageUsed;
  }

  await updateDoc(analyticsRef, updates);
};

/**
 * Track feature usage
 */
export const trackFeatureUsage = async (
  userId: string,
  feature: string,
  increment: number = 1
): Promise<void> => {
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  const analytics = await getUserAnalytics(userId);

  if (analytics) {
    const currentUsage = analytics.featureUsage[feature] || 0;
    const newUsage = currentUsage + increment;

    await updateDoc(analyticsRef, {
      [`featureUsage.${feature}`]: newUsage,
      lastActiveDate: Timestamp.now(),
    });
  }
};

// ===== REAL-TIME LISTENERS =====

/**
 * Listen to user documents in real-time
 */
export const listenToUserDocuments = (
  userId: string,
  callback: (documents: Document[]) => void
): Unsubscribe => {
  // Listen to the nested collection: documents/{userId}/userDocuments
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const q = query(userDocumentsRef, orderBy("createdAt", "desc"));

  return onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
    const documents = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Document[];
    callback(documents);
  });
};

/**
 * Listen to processing queue in real-time
 */
export const listenToProcessingQueue = (
  callback: (tasks: ProcessingTask[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, COLLECTIONS.PROCESSING_QUEUE),
    orderBy("createdAt", "asc")
  );

  return onSnapshot(q, (querySnapshot: QuerySnapshot<DocumentData>) => {
    const tasks = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ProcessingTask[];
    callback(tasks);
  });
};

// ===== EXPLORE (PUBLIC) OPERATIONS =====

export interface PublicDocumentMeta {
  id: string;
  ownerId: string;
  title: string;
  type: string;
  status: string;
  isPublic: boolean;
  tags?: string[];
  preview?: string;
  // Optional fields mirrored from userDocuments for richer previews
  storagePath?: string;
  masterUrl?: string;
  content?: { processed?: string; raw?: string };
  summary?: string;
  metadata?: {
    pageCount?: number;
    duration?: number;
    fileSize?: number;
    lang?: string;
    fileName?: string;
    mimeType?: string;
    downloadURL?: string;
  };
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  stats?: { views?: number; likes?: number };
}

/**
 * Get newest public documents for Explore
 */
export const getExploreDocuments = async (
  limitCount: number = 48
): Promise<PublicDocumentMeta[]> => {
  const ref = collection(db, "allDocuments");
  const qy = query(
    ref,
    where("isPublic", "==", true),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => {
    const data = d.data() as Omit<PublicDocumentMeta, "id">;
    return { id: d.id, ...data };
  });
};

export const listenToExploreDocuments = (
  callback: (docs: PublicDocumentMeta[]) => void
): Unsubscribe => {
  const ref = collection(db, "allDocuments");
  const qy = query(
    ref,
    where("isPublic", "==", true),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(qy, (snap) => {
    const docs = snap.docs.map((d) => {
      const data = d.data() as Omit<PublicDocumentMeta, "id">;
      return { id: d.id, ...data };
    });
    callback(docs);
  });
};

// ===== MIND MAP OPERATIONS =====

/**
 * Create a new mind map entry (initially with status generating)
 */
export const createMindMap = async (
  userId: string,
  data: CreateMindMapData
): Promise<string> => {
  const now = Timestamp.now();
  const collectionRef = collection(db, COLLECTIONS.MINDMAPS);
  const map: Omit<MindMap, "id"> = {
    userId,
    title: data.title,
    prompt: data.prompt,
    language: data.language,
    mode: data.mode,
    structure: null,
    status: "generating",
    createdAt: now,
    updatedAt: now,
    lastAccessed: now,
  };
  const ref = await addDoc(collectionRef, map);
  return ref.id;
};

export const updateMindMap = async (
  userId: string,
  mindMapId: string,
  updates: UpdateMindMapData
): Promise<void> => {
  const ref = doc(db, COLLECTIONS.MINDMAPS, mindMapId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: Timestamp.now(),
    lastAccessed: Timestamp.now(),
  });
};

export const getMindMaps = async (
  userId: string,
  limitCount: number = 100
): Promise<MindMap[]> => {
  const collectionRef = collection(db, COLLECTIONS.MINDMAPS);
  const q = query(
    collectionRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MindMap[];
};

export const listenToMindMaps = (
  userId: string,
  callback: (maps: MindMap[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  const collectionRef = collection(db, COLLECTIONS.MINDMAPS);
  const q = query(
    collectionRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  // NOTE: Requires composite index on (userId ASC, createdAt DESC) in firestore.indexes.json
  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const maps = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as MindMap[];
      callback(maps);
    },
    (err) => {
      if (onError) onError(err);
      else console.error("listenToMindMaps error", err);
    }
  );
};

export const getMindMap = async (
  mindMapId: string
): Promise<MindMap | null> => {
  const ref = doc(db, COLLECTIONS.MINDMAPS, mindMapId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MindMap;
};

export const listenToMindMap = (
  mindMapId: string,
  callback: (map: MindMap | null) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  const ref = doc(db, COLLECTIONS.MINDMAPS, mindMapId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) return callback(null);
      callback({ id: snap.id, ...snap.data() } as MindMap);
    },
    (err) => {
      if (onError) onError(err);
      else console.error("listenToMindMap error", err);
    }
  );
};

// ===== BATCH OPERATIONS =====

/**
 * Create document and add to processing queue in a batch
 */
export const createDocumentWithProcessing = async (
  userId: string,
  documentData: CreateDocumentData,
  processingType: string
): Promise<{ documentId: string; taskId: string }> => {
  const batch = writeBatch(db);

  // Create document in nested structure
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const documentRef = doc(userDocumentsRef);
  const now = Timestamp.now();

  const document: Omit<Document, "id"> = {
    userId,
    ...documentData,
    status: "uploading",
    tags: documentData.tags || [],
    isPublic: documentData.isPublic || false,
    createdAt: now,
    updatedAt: now,
    lastAccessed: now,
  };

  batch.set(documentRef, document);

  // Create processing task
  const taskRef = doc(collection(db, COLLECTIONS.PROCESSING_QUEUE));
  const task: Omit<ProcessingTask, "id"> = {
    documentId: documentRef.id,
    userId,
    type: processingType,
    status: "pending",
    createdAt: now,
  };

  batch.set(taskRef, task);

  // Commit batch
  await batch.commit();

  return {
    documentId: documentRef.id,
    taskId: taskRef.id,
  };
};

/**
 * Create a document with file upload metadata
 */
export const createDocumentWithFile = async (
  userId: string,
  documentData: CreateDocumentData,
  file: File
): Promise<string> => {
  const now = Timestamp.now();

  // Add file metadata
  const documentWithFile: Omit<Document, "id"> = {
    userId,
    ...documentData,
    metadata: {
      ...documentData.metadata,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    },
    status: "uploading",
    tags: documentData.tags || [],
    isPublic: documentData.isPublic || false,
    createdAt: now,
    updatedAt: now,
    lastAccessed: now,
  };

  // Create document in nested structure
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const docRef = await addDoc(userDocumentsRef, documentWithFile);

  // Update user analytics
  await incrementUserAnalytics(userId, {
    documentsCreated: 1,
    totalStorageUsed: file.size,
  });

  return docRef.id;
};

/**
 * Update document with storage information after file upload
 */
export const updateDocumentStorageInfo = async (
  documentId: string,
  userId: string,
  storagePath: string,
  downloadURL: string
): Promise<void> => {
  const documentRef = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments",
    documentId
  );

  // Get the current document to preserve existing metadata
  const docSnap = await getDoc(documentRef);
  if (!docSnap.exists()) {
    throw new Error("Document not found");
  }

  const currentData = docSnap.data();
  const currentMetadata = currentData.metadata || {};

  await updateDoc(documentRef, {
    metadata: {
      ...currentMetadata, // Preserve existing metadata (fileSize, fileName, mimeType)
      storagePath,
      downloadURL,
    },
    status: "ready",
    updatedAt: Timestamp.now(),
  });
};

/**
 * Create a YouTube video document
 */
export const createYouTubeDocument = async (
  userId: string,
  url: string,
  title?: string,
  spaceId?: string
): Promise<string> => {
  const now = Timestamp.now();

  // Extract video ID from YouTube URL for title if not provide
  const getYouTubeVideoId = (url: string) => {
    const regex =
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  };

  const videoId = getYouTubeVideoId(url);
  const defaultTitle = videoId ? `YouTube Video - ${videoId}` : "YouTube Video";

  const document: Omit<Document, "id"> = {
    userId,
    title: title || defaultTitle,
    type: "youtube",
    content: {
      raw: url,
      processed: "", // Will be populated after processing
    },
    metadata: {
      url,
      mimeType: "video/youtube",
    },
    ...(spaceId ? { spaceId } : {}),
    status: "processing",
    tags: ["youtube", "video"],
    isPublic: false,
    createdAt: now,
    updatedAt: now,
    lastAccessed: now,
  };

  // Create document in nested structure: documents/{userId}/userDocuments
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const docRef = await addDoc(userDocumentsRef, document);

  // Update user analytics
  await incrementUserAnalytics(userId, {
    documentsCreated: 1,
    totalStorageUsed: 0, // No file storage for links
  });

  return docRef.id;
};

/**
 * Create a website link document
 */
export const createWebsiteDocument = async (
  userId: string,
  url: string,
  title?: string,
  spaceId?: string
): Promise<string> => {
  const now = Timestamp.now();

  // Extract domain from URL for title if not provided
  const getDomainFromUrl = (url: string) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return "Website";
    }
  };

  const domain = getDomainFromUrl(url);
  const defaultTitle = title || `Website - ${domain}`;

  const document: Omit<Document, "id"> = {
    userId,
    title: defaultTitle,
    type: "website",
    content: {
      raw: url,
      processed: "", // Will be populated after processing
    },
    metadata: {
      url,
      mimeType: "text/html",
    },
    ...(spaceId ? { spaceId } : {}),
    status: "processing",
    tags: ["website", "link"],
    isPublic: false,
    createdAt: now,
    updatedAt: now,
    lastAccessed: now,
  };

  // Create document in nested structure: documents/{userId}/userDocuments
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const docRef = await addDoc(userDocumentsRef, document);

  // Update user analytics
  await incrementUserAnalytics(userId, {
    documentsCreated: 1,
    totalStorageUsed: 0, // No file storage for links
  });

  return docRef.id;
};

/**
 * Update a space
 */
export const updateSpace = async (
  userId: string,
  spaceId: string,
  updates: Partial<Pick<Space, "name" | "description">>
): Promise<void> => {
  const ref = doc(db, COLLECTIONS.SPACES, spaceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Space not found");
  const data = snap.data() as Space;
  if (data.userId !== userId) throw new Error("Permission denied");
  await updateDoc(ref, { ...updates, updatedAt: Timestamp.now() });
};

/**
 * Listen to a space in real-time
 */
export const listenToSpace = (
  spaceId: string,
  callback: (space: Space | null) => void
): Unsubscribe => {
  const ref = doc(db, COLLECTIONS.SPACES, spaceId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return callback(null);
    callback({ id: snap.id, ...snap.data() } as Space);
  });
};

export const deleteSpace = async (
  userId: string,
  spaceId: string
): Promise<void> => {
  const ref = doc(db, COLLECTIONS.SPACES, spaceId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Space not found");
  const data = snap.data() as Space;
  if (data.userId !== userId) throw new Error("Permission denied");
  await deleteDoc(ref);
};
