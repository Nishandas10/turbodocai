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
  increment,
  type QuerySnapshot,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import type {
  UserProfile,
  Document,
  CreateDocumentData,
  UpdateDocumentData,
  ProcessingTask,
  UserAnalytics,
  MindMap,
  CreateMindMapData,
  UpdateMindMapData,
  Space,
  CreateSpaceData,
  SpaceTest,
  CreateSpaceTestData,
  Chat,
  OnboardingData,
  Feedback,
} from "./types";
import { db } from "./firebase";

// Collection names
const COLLECTIONS = {
  USERS: "users",
  DOCUMENTS: "documents",
  PROCESSING_QUEUE: "processing_queue",
  USER_ANALYTICS: "user_analytics",
  MINDMAPS: "mindmaps",
  CHATS: "chats",
  SPACES: "spaces",
  TESTS: "tests",
  FEEDBACK: "feedback",
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
  // (OnboardingData type imported for other helpers; not used here)

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

// ===== FEEDBACK OPERATIONS =====
/**
 * Create a feedback entry in /feedback/{autoId}
 */
export const createFeedback = async (
  userId: string,
  email: string,
  type: Feedback["type"],
  rating: number,
  message: string
): Promise<string> => {
  const ref = collection(db, COLLECTIONS.FEEDBACK);
  const docRef = await addDoc(ref, {
    userId,
    email,
    type,
    rating,
    message,
    createdAt: Timestamp.now(),
  } as Omit<Feedback, "id">);
  return docRef.id;
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
    collaborators: documentData.collaborators || { viewers: [], editors: [] },
    publicCanEdit: documentData.publicCanEdit || false,
    createdAt: now,
    updatedAt: now,
    lastAccessed: now,
  };
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const docRef = await addDoc(userDocumentsRef, document);
  // Increment totals
  await incrementUserAnalytics(userId, {
    documentsCreated: 1,
    totalStorageUsed: documentData.metadata.fileSize || 0,
  });
  // Monthly uploads
  try {
    await incrementMonthlyUploads(userId);
  } catch (e) {
    console.warn("Monthly upload increment failed; will recalc later", e);
  }
  return docRef.id;
};

// Helper: increment monthly uploads counter with rollover handling
async function incrementMonthlyUploads(userId: string): Promise<void> {
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const snap = await getDoc(analyticsRef);
  if (!snap.exists()) {
    await setDoc(
      analyticsRef,
      {
        uploadsThisMonth: 1,
        uploadsMonthKey: currentMonthKey,
        lastActiveDate: Timestamp.now(),
      },
      { merge: true }
    );
    return;
  }
  const data = snap.data() as Partial<UserAnalytics> | undefined;
  if (data?.uploadsMonthKey === currentMonthKey) {
    await updateDoc(analyticsRef, {
      uploadsThisMonth: increment(1),
      lastActiveDate: Timestamp.now(),
    });
  } else {
    await updateDoc(analyticsRef, {
      uploadsThisMonth: 1,
      uploadsMonthKey: currentMonthKey,
      lastActiveDate: Timestamp.now(),
    });
  }
}

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

// ===== SHARING HELPERS =====

export type ShareRole = "viewer" | "editor";

export interface ShareInfo {
  isPublic: boolean;
  publicCanEdit: boolean;
  collaborators: { viewers: string[]; editors: string[] };
  ownerId: string;
}

export const getShareInfo = async (
  documentId: string,
  userId: string
): Promise<ShareInfo | null> => {
  const ref = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments",
    documentId
  );
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Document;
  return {
    isPublic: !!data.isPublic,
    publicCanEdit: !!data.publicCanEdit,
    collaborators: {
      viewers: data.collaborators?.viewers || [],
      editors: data.collaborators?.editors || [],
    },
    ownerId: data.userId,
  };
};

export const setPublicAccess = async (
  documentId: string,
  userId: string,
  opts: { isPublic?: boolean; publicCanEdit?: boolean }
) => {
  await updateDocument(documentId, userId, {
    ...(opts.isPublic !== undefined ? { isPublic: opts.isPublic } : {}),
    ...(opts.publicCanEdit !== undefined
      ? { publicCanEdit: opts.publicCanEdit }
      : {}),
  });
};

export const addCollaborator = async (
  documentId: string,
  ownerId: string,
  collaboratorUserId: string,
  role: ShareRole
) => {
  const ref = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    ownerId,
    "userDocuments",
    documentId
  );
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Document;
  const viewers = new Set(data.collaborators?.viewers || []);
  const editors = new Set(data.collaborators?.editors || []);
  if (role === "viewer") {
    editors.delete(collaboratorUserId);
    viewers.add(collaboratorUserId);
  } else {
    viewers.delete(collaboratorUserId);
    editors.add(collaboratorUserId);
  }
  await updateDoc(ref, {
    collaborators: {
      viewers: Array.from(viewers),
      editors: Array.from(editors),
    },
    updatedAt: Timestamp.now(),
  });
};

export const removeCollaborator = async (
  documentId: string,
  ownerId: string,
  collaboratorUserId: string
) => {
  const ref = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    ownerId,
    "userDocuments",
    documentId
  );
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as Document;
  const viewers = new Set(data.collaborators?.viewers || []);
  const editors = new Set(data.collaborators?.editors || []);
  viewers.delete(collaboratorUserId);
  editors.delete(collaboratorUserId);
  await updateDoc(ref, {
    collaborators: {
      viewers: Array.from(viewers),
      editors: Array.from(editors),
    },
    updatedAt: Timestamp.now(),
  });
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

// ===== TESTS (per space and user) =====

/**
 * Create a test document under: tests/{userId}/spaces/{spaceId}/tests/{autoId}
 * Stores metadata and selected document ids.
 * Returns testId.
 */
export const createSpaceTest = async (
  userId: string,
  spaceId: string,
  data: CreateSpaceTestData
): Promise<string> => {
  const now = Timestamp.now();
  const testsCol = collection(
    db,
    COLLECTIONS.TESTS,
    userId,
    "spaces",
    spaceId,
    "tests"
  );
  const docRef = await addDoc(testsCol, {
    userId,
    spaceId,
    documentIds: data.documentIds,
    type: data.type,
    difficulty: data.difficulty,
    questionCount: data.questionCount,
    durationMin: data.durationMin,
    title: data.title || "Untitled Test",
    createdAt: now,
    updatedAt: now,
  } as Omit<SpaceTest, "id">);
  return docRef.id;
};

/** Listen to tests for a given user and space */
export const listenToSpaceTests = (
  userId: string,
  spaceId: string,
  callback: (tests: SpaceTest[]) => void
): Unsubscribe => {
  const testsCol = collection(
    db,
    COLLECTIONS.TESTS,
    userId,
    "spaces",
    spaceId,
    "tests"
  );
  const qy = query(testsCol, orderBy("createdAt", "desc"));
  return onSnapshot(qy, (snap) => {
    const tests = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as SpaceTest[];
    callback(tests);
  });
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
    uploadsThisMonth: 0,
    uploadsMonthKey: new Date().toISOString().slice(0, 7),
    aiChatsUsed: 0,
  };
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
  const existingAnalytics = await getUserAnalytics(userId);
  if (!existingAnalytics) {
    await initializeUserAnalytics(userId);
  }
  const updates: {
    lastActiveDate: Timestamp;
    documentsCreated?: ReturnType<typeof increment>;
    totalStorageUsed?: ReturnType<typeof increment>;
  } = { lastActiveDate: Timestamp.now() };
  if (
    increments.documentsCreated !== undefined &&
    increments.documentsCreated !== 0
  ) {
    updates.documentsCreated = increment(increments.documentsCreated);
  }
  if (
    increments.totalStorageUsed !== undefined &&
    increments.totalStorageUsed !== 0
  ) {
    updates.totalStorageUsed = increment(increments.totalStorageUsed);
  }
  if (Object.keys(updates).length > 0) {
    await updateDoc(analyticsRef, updates);
  }
};

// Recalculate monthly uploads count (can be used for manual sync)
export const updateMonthlyUploadsCount = async (
  userId: string
): Promise<void> => {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const qy = query(
    userDocumentsRef,
    where("createdAt", ">=", Timestamp.fromDate(start)),
    where("createdAt", "<", Timestamp.fromDate(end))
  );
  const snap = await getDocs(qy);
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  await updateDoc(analyticsRef, {
    uploadsThisMonth: snap.size,
    uploadsMonthKey: start.toISOString().slice(0, 7),
    lastActiveDate: Timestamp.now(),
  });
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

// ===== ONBOARDING HELPERS =====

/** Get whether onboarding is completed and the saved payload */
export const getUserOnboarding = async (
  userId: string
): Promise<{ completed: boolean; data: OnboardingData | null }> => {
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  const snap = await getDoc(analyticsRef);
  if (!snap.exists()) {
    return { completed: false, data: null };
  }
  const data = snap.data() as Partial<UserAnalytics> & {
    onboarding?: OnboardingData;
  };
  return {
    completed: !!data.onboardingCompleted && !!data.onboarding,
    data: (data.onboarding as OnboardingData) || null,
  };
};

/** Save onboarding data and mark as completed */
export const saveUserOnboarding = async (
  userId: string,
  onboarding: Omit<OnboardingData, "completedAt"> & {
    completedAt?: OnboardingData["completedAt"];
  }
): Promise<void> => {
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);

  // Ensure analytics exists; if not, initialize first
  const exists = await getDoc(analyticsRef);
  if (!exists.exists()) {
    await initializeUserAnalytics(userId);
  }

  const payload: OnboardingData = {
    completedAt: Timestamp.now(),
    ...onboarding,
  } as OnboardingData;

  // Use setDoc merge to avoid clobbering counters
  await setDoc(
    analyticsRef,
    {
      onboardingCompleted: true,
      onboarding: payload,
      lastActiveDate: Timestamp.now(),
    },
    { merge: true }
  );
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

/**
 * Listen to user chats in real-time (top-level collection /chats filtered by userId)
 */
export const listenToUserChats = (
  userId: string,
  callback: (chats: Chat[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  const chatsRef = collection(db, COLLECTIONS.CHATS);
  const q = query(
    chatsRef,
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(
    q,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const chats = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Chat[];
      callback(chats);

      // Keep aiChatsUsed in sync with actual number of chats
      (async () => {
        try {
          const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
          // Ensure doc exists, then set exact count
          await setDoc(
            analyticsRef,
            {
              aiChatsUsed: snapshot.size,
              lastActiveDate: Timestamp.now(),
            },
            { merge: true }
          );
        } catch (e) {
          console.warn("Failed to sync aiChatsUsed from chats query", e);
        }
      })();
    },
    (err) => {
      if (onError) onError(err);
      else console.error("listenToUserChats error", err);
    }
  );
};

/** Manually sync aiChatsUsed by counting top-level /chats for the user */
export const syncAiChatsUsedFromChats = async (
  userId: string
): Promise<number> => {
  const chatsRef = collection(db, COLLECTIONS.CHATS);
  const q = query(chatsRef, where("userId", "==", userId));
  const snap = await getDocs(q);
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  await setDoc(
    analyticsRef,
    { aiChatsUsed: snap.size, lastActiveDate: Timestamp.now() },
    { merge: true }
  );
  return snap.size;
};

// Update a chat (e.g., rename or adjust language/context docs)
export const updateChat = async (
  chatId: string,
  updates: Partial<Pick<Chat, "title" | "language" | "contextDocIds">>
): Promise<void> => {
  const ref = doc(db, COLLECTIONS.CHATS, chatId);
  await updateDoc(ref, { ...updates, updatedAt: Timestamp.now() });
};

// Delete a chat
export const deleteChat = async (chatId: string): Promise<void> => {
  const ref = doc(db, COLLECTIONS.CHATS, chatId);
  await deleteDoc(ref);
};

// Create chat + increment aiChatsUsed
export const createChat = async (
  userId: string,
  data: {
    title: string;
    language: string;
    model?: string;
    contextDocIds?: string[];
  }
): Promise<string> => {
  const now = Timestamp.now();
  const chatsRef = collection(db, COLLECTIONS.CHATS);
  const chat: Omit<Chat, "id"> = {
    userId,
    title: data.title,
    language: data.language,
    model: data.model,
    contextDocIds: data.contextDocIds || [],
    createdAt: now,
    updatedAt: now,
    lastAccessed: now,
  };
  const ref = await addDoc(chatsRef, chat);
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  const snap = await getDoc(analyticsRef);
  if (!snap.exists()) await initializeUserAnalytics(userId);
  await updateDoc(analyticsRef, {
    aiChatsUsed: increment(1),
    lastActiveDate: Timestamp.now(),
  });
  return ref.id;
};

// Explore (public) operations removed

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

// Hard delete a mind map
export const deleteMindMap = async (mindMapId: string): Promise<void> => {
  const ref = doc(db, COLLECTIONS.MINDMAPS, mindMapId);
  await deleteDoc(ref);
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

  // Update analytics
  try {
    await incrementUserAnalytics(userId, {
      documentsCreated: 1,
      totalStorageUsed: document.metadata?.fileSize || 0,
    });
    await incrementMonthlyUploads(userId);
  } catch (e) {
    console.warn("Analytics update failed (createDocumentWithProcessing)", e);
  }

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
  try {
    await incrementMonthlyUploads(userId);
  } catch {}

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
  try {
    await incrementMonthlyUploads(userId);
  } catch {}

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
  try {
    await incrementMonthlyUploads(userId);
  } catch {}

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
