import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  Timestamp,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { Document, CreateDocumentData, UpdateDocumentData } from "../types";
import { COLLECTIONS } from "./constants";
import { incrementUserAnalytics } from "./analytics";

/** Create a new document */
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
  await incrementUserAnalytics(userId, {
    documentsCreated: 1,
    totalStorageUsed: documentData.metadata.fileSize || 0,
  });
  return docRef.id;
};

/** Get document by ID */
export const getDocument = async (
  documentId: string,
  userId: string
): Promise<Document | null> => {
  const ref = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments",
    documentId
  );
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() } as Document;
  return null;
};

/** Get documents for a user */
export const getUserDocuments = async (
  userId: string,
  limitCount: number = 50
): Promise<Document[]> => {
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const qy = query(
    userDocumentsRef,
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Document[];
};

/** Update document */
export const updateDocument = async (
  documentId: string,
  userId: string,
  updates: UpdateDocumentData
): Promise<void> => {
  const ref = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments",
    documentId
  );
  await updateDoc(ref, { ...updates, updatedAt: Timestamp.now() });
};

/** Update document status */
export const updateDocumentStatus = async (
  documentId: string,
  userId: string,
  status: Document["status"]
): Promise<void> => {
  await updateDocument(documentId, userId, { status });
};

/** Update (or create) stored AI summary for a document */
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

/** Delete document */
export const deleteDocument = async (
  documentId: string,
  userId: string
): Promise<void> => {
  const ref = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments",
    documentId
  );
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const documentData = snap.data() as Document;
    await incrementUserAnalytics(userId, {
      documentsCreated: -1,
      totalStorageUsed: -(documentData.metadata.fileSize || 0),
    });
    await deleteDoc(ref);
  }
};

/** Update document last accessed time */
export const updateDocumentLastAccessed = async (
  documentId: string,
  userId: string
): Promise<void> => {
  const ref = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments",
    documentId
  );
  await updateDoc(ref, { lastAccessed: Timestamp.now() });
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

// ===== REAL-TIME LISTENERS =====
/** Listen to user documents in real-time */
export const listenToUserDocuments = (
  userId: string,
  callback: (documents: Document[]) => void
): Unsubscribe => {
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const qy = query(userDocumentsRef, orderBy("createdAt", "desc"));
  return onSnapshot(qy, (querySnapshot: QuerySnapshot<DocumentData>) => {
    const documents = querySnapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as Document[];
    callback(documents);
  });
};

// ===== BATCH OPERATIONS =====
/** Create document and add to processing queue in a batch */
export const createDocumentWithProcessing = async (
  userId: string,
  documentData: CreateDocumentData,
  processingType: string
): Promise<{ documentId: string; taskId: string }> => {
  const batch = writeBatch(db);
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
  const taskRef = doc(collection(db, COLLECTIONS.PROCESSING_QUEUE));
  const task = {
    documentId: documentRef.id,
    userId,
    type: processingType,
    status: "pending",
    createdAt: now,
  };
  batch.set(taskRef, task);
  await batch.commit();
  return { documentId: documentRef.id, taskId: taskRef.id };
};

/** Create a document with file upload metadata */
export const createDocumentWithFile = async (
  userId: string,
  documentData: CreateDocumentData,
  file: File
): Promise<string> => {
  const now = Timestamp.now();
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
  const userDocumentsRef = collection(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments"
  );
  const docRef = await addDoc(userDocumentsRef, documentWithFile);
  await incrementUserAnalytics(userId, {
    documentsCreated: 1,
    totalStorageUsed: file.size,
  });
  return docRef.id;
};

/** Update document with storage information after file upload */
export const updateDocumentStorageInfo = async (
  documentId: string,
  userId: string,
  storagePath: string,
  downloadURL: string
): Promise<void> => {
  const ref = doc(
    db,
    COLLECTIONS.DOCUMENTS,
    userId,
    "userDocuments",
    documentId
  );
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Document not found");
  const currentData = snap.data();
  const currentMetadata = currentData.metadata || {};
  await updateDoc(ref, {
    metadata: { ...currentMetadata, storagePath, downloadURL },
    status: "ready",
    updatedAt: Timestamp.now(),
  });
};

/** Create a YouTube video document */
export const createYouTubeDocument = async (
  userId: string,
  url: string,
  title?: string,
  spaceId?: string
): Promise<string> => {
  const now = Timestamp.now();
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
    content: { raw: url, processed: "" },
    metadata: { url, mimeType: "video/youtube" },
    ...(spaceId ? { spaceId } : {}),
    status: "processing",
    tags: ["youtube", "video"],
    isPublic: false,
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
  await incrementUserAnalytics(userId, {
    documentsCreated: 1,
    totalStorageUsed: 0,
  });
  return docRef.id;
};

/** Create a website link document */
export const createWebsiteDocument = async (
  userId: string,
  url: string,
  title?: string,
  spaceId?: string
): Promise<string> => {
  const now = Timestamp.now();
  const getDomainFromUrl = (urlStr: string) => {
    try {
      const urlObj = new URL(urlStr);
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
    content: { raw: url, processed: "" },
    metadata: { url, mimeType: "text/html" },
    ...(spaceId ? { spaceId } : {}),
    status: "processing",
    tags: ["website", "link"],
    isPublic: false,
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
  await incrementUserAnalytics(userId, {
    documentsCreated: 1,
    totalStorageUsed: 0,
  });
  return docRef.id;
};
