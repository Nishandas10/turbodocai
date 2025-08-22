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
} from "./types";

// Collection names
const COLLECTIONS = {
  USERS: "users",
  DOCUMENTS: "documents",
  PROCESSING_QUEUE: "processing_queue",
  USER_ANALYTICS: "user_analytics",
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
