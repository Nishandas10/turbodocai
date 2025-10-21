import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "./firebase";
import { StorageUploadResult } from "./types";

// Storage folder structure constants
const STORAGE_PATHS = {
  USERS: "users",
  DOCUMENTS: "documents",
  AUDIO: "audio",
  RECORDINGS: "recordings",
  IMAGES: "images",
  SNAPSHOTS: "snapshots",
} as const;

/**
 * Get the storage path for a user's documents
 */
export const getUserDocumentsPath = (userId: string): string => {
  return `${STORAGE_PATHS.USERS}/${userId}/${STORAGE_PATHS.DOCUMENTS}`;
};

/**
 * Get the storage path for a user's audio files
 */
export const getUserAudioPath = (userId: string): string => {
  return `${STORAGE_PATHS.USERS}/${userId}/${STORAGE_PATHS.AUDIO}`;
};

/**
 * Get the storage path for a user's recordings
 */
export const getUserRecordingsPath = (userId: string): string => {
  return `${STORAGE_PATHS.USERS}/${userId}/${STORAGE_PATHS.AUDIO}/${STORAGE_PATHS.RECORDINGS}`;
};

/**
 * Get the storage path for a user's images
 */
export const getUserImagesPath = (userId: string): string => {
  return `${STORAGE_PATHS.USERS}/${userId}/${STORAGE_PATHS.IMAGES}`;
};

/**
 * Get the storage path for a user's snapshots
 */
export const getUserSnapshotsPath = (userId: string): string => {
  return `${STORAGE_PATHS.USERS}/${userId}/${STORAGE_PATHS.IMAGES}/${STORAGE_PATHS.SNAPSHOTS}`;
};

/**
 * Upload a document file (PDF, DOCX, PPTX, etc.)
 */
export const uploadDocument = async (
  file: File,
  userId: string,
  documentId: string
): Promise<StorageUploadResult> => {
  try {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const storagePath = `${getUserDocumentsPath(
      userId
    )}/${documentId}.${fileExtension}`;

    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      success: true,
      documentId,
      storagePath,
      downloadURL,
    };
  } catch (error) {
    console.error("Error uploading document:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
};

/**
 * Upload an audio file
 */
export const uploadAudio = async (
  file: File,
  userId: string,
  documentId: string
): Promise<StorageUploadResult> => {
  try {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const storagePath = `${getUserAudioPath(
      userId
    )}/${documentId}.${fileExtension}`;

    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      success: true,
      documentId,
      storagePath,
      downloadURL,
    };
  } catch (error) {
    console.error("Error uploading audio:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
};

/**
 * Upload a recording (live recorded audio)
 */
export const uploadRecording = async (
  file: File,
  userId: string,
  documentId: string
): Promise<StorageUploadResult> => {
  try {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const storagePath = `${getUserRecordingsPath(
      userId
    )}/${documentId}.${fileExtension}`;

    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      success: true,
      documentId,
      storagePath,
      downloadURL,
    };
  } catch (error) {
    console.error("Error uploading recording:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
};

/**
 * Upload an image file
 */
export const uploadImage = async (
  file: File,
  userId: string,
  documentId: string
): Promise<StorageUploadResult> => {
  try {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const storagePath = `${getUserImagesPath(
      userId
    )}/${documentId}.${fileExtension}`;

    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      success: true,
      documentId,
      storagePath,
      downloadURL,
    };
  } catch (error) {
    console.error("Error uploading image:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
};

/**
 * Upload a camera snapshot
 */
export const uploadSnapshot = async (
  file: File,
  userId: string,
  documentId: string
): Promise<StorageUploadResult> => {
  try {
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    const storagePath = `${getUserSnapshotsPath(
      userId
    )}/${documentId}.${fileExtension}`;

    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);

    return {
      success: true,
      documentId,
      storagePath,
      downloadURL,
    };
  } catch (error) {
    console.error("Error uploading snapshot:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
};

/**
 * Upload any file type and determine the appropriate storage location
 */
export const uploadFile = async (
  file: File,
  userId: string,
  documentId: string
): Promise<StorageUploadResult> => {
  const mimeType = file.type;

  // Determine file type and upload to appropriate location
  if (mimeType.startsWith("audio/")) {
    return uploadAudio(file, userId, documentId);
  } else if (mimeType.startsWith("image/")) {
    return uploadImage(file, userId, documentId);
  } else if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("presentation") ||
    mimeType.includes("text/plain")
  ) {
    return uploadDocument(file, userId, documentId);
  } else {
    // Default to documents folder for unknown types
    return uploadDocument(file, userId, documentId);
  }
};

/**
 * Delete a file from storage
 */
export const deleteFile = async (storagePath: string): Promise<boolean> => {
  try {
    const storageRef = ref(storage, storagePath);
    await deleteObject(storageRef);
    return true;
  } catch (error) {
    console.error("Error deleting file:", error);
    return false;
  }
};

/**
 * Get download URL for a file
 */
export const getFileDownloadURL = async (
  storagePath: string
): Promise<string | null> => {
  try {
    const storageRef = ref(storage, storagePath);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Error getting download URL:", error);
    return null;
  }
};

/**
 * Convert base64 image data to a File object
 */
export const base64ToFile = (
  base64Data: string,
  filename: string,
  mimeType: string
): File => {
  const arr = base64Data.split(",");
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);

  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }

  return new File([u8arr], filename, { type: mimeType });
};
