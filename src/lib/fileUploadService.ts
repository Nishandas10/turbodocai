import { createDocumentWithFile, updateDocumentStorageInfo } from "./firestore";
import {
  uploadDocument,
  uploadAudio,
  uploadImage,
  uploadSnapshot,
  base64ToFile,
} from "./storage";
import { CreateDocumentData, StorageUploadResult, Document } from "./types";

export interface FileUploadOptions {
  title?: string;
  tags?: string[];
  isPublic?: boolean;
  description?: string;
}

/**
 * Upload a document file (PDF, DOCX, PPTX, etc.) with complete metadata storage
 */
export const uploadDocumentFile = async (
  file: File,
  userId: string,
  options: FileUploadOptions = {}
): Promise<StorageUploadResult> => {
  try {
    // Determine document type based on file extension
    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    let documentType: Document["type"] = "pdf";

    if (fileExtension === "pdf") {
      documentType = "pdf";
    } else if (fileExtension === "docx" || fileExtension === "doc") {
      documentType = "docx";
    } else if (fileExtension === "pptx" || fileExtension === "ppt") {
      documentType = "pptx";
    }

    // Create document in Firestore first
    const documentData: CreateDocumentData = {
      title: options.title || file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
      type: documentType,
      content: {
        raw: "", // Will be populated after processing
        processed: "",
      },
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
      tags: options.tags || [],
      isPublic: options.isPublic || false,
    };

    const documentId = await createDocumentWithFile(userId, documentData, file);

    // Upload file to Firebase Storage
    const uploadResult = await uploadDocument(file, userId, documentId);

    if (
      uploadResult.success &&
      uploadResult.storagePath &&
      uploadResult.downloadURL
    ) {
      // Update Firestore with storage information
      await updateDocumentStorageInfo(
        documentId,
        uploadResult.storagePath,
        uploadResult.downloadURL
      );

      return {
        success: true,
        documentId,
        storagePath: uploadResult.storagePath,
        downloadURL: uploadResult.downloadURL,
      };
    } else {
      throw new Error(uploadResult.error || "Upload failed");
    }
  } catch (error) {
    console.error("Error in uploadDocumentFile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Document upload failed",
    };
  }
};

/**
 * Upload an audio file with complete metadata storage
 */
export const uploadAudioFile = async (
  file: File,
  userId: string,
  options: FileUploadOptions = {}
): Promise<StorageUploadResult> => {
  try {
    // Create document in Firestore first
    const documentData: CreateDocumentData = {
      title: options.title || file.name.replace(/\.[^/.]+$/, ""),
      type: "audio",
      content: {
        raw: "",
        processed: "",
      },
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
      tags: options.tags || [],
      isPublic: options.isPublic || false,
    };

    const documentId = await createDocumentWithFile(userId, documentData, file);

    // Upload file to Firebase Storage
    const uploadResult = await uploadAudio(file, userId, documentId);

    if (
      uploadResult.success &&
      uploadResult.storagePath &&
      uploadResult.downloadURL
    ) {
      // Update Firestore with storage information
      await updateDocumentStorageInfo(
        documentId,
        uploadResult.storagePath,
        uploadResult.downloadURL
      );

      return {
        success: true,
        documentId,
        storagePath: uploadResult.storagePath,
        downloadURL: uploadResult.downloadURL,
      };
    } else {
      throw new Error(uploadResult.error || "Upload failed");
    }
  } catch (error) {
    console.error("Error in uploadAudioFile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Audio upload failed",
    };
  }
};

/**
 * Upload a recording (live recorded audio) with complete metadata storage
 */
export const uploadRecordingFile = async (
  file: File,
  userId: string,
  options: FileUploadOptions = {}
): Promise<StorageUploadResult> => {
  try {
    // Create document in Firestore first
    const documentData: CreateDocumentData = {
      title: options.title || `Recording ${new Date().toLocaleString()}`,
      type: "audio",
      content: {
        raw: "",
        processed: "",
      },
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
      tags: options.tags || ["recording"],
      isPublic: options.isPublic || false,
    };

    const documentId = await createDocumentWithFile(userId, documentData, file);

    // Upload file to Firebase Storage
    const uploadResult = await uploadSnapshot(file, userId, documentId);

    if (
      uploadResult.success &&
      uploadResult.storagePath &&
      uploadResult.downloadURL
    ) {
      // Update Firestore with storage information
      await updateDocumentStorageInfo(
        documentId,
        uploadResult.storagePath,
        uploadResult.downloadURL
      );

      return {
        success: true,
        documentId,
        storagePath: uploadResult.storagePath,
        downloadURL: uploadResult.downloadURL,
      };
    } else {
      throw new Error(uploadResult.error || "Upload failed");
    }
  } catch (error) {
    console.error("Error in uploadRecordingFile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Recording upload failed",
    };
  }
};

/**
 * Upload an image file with complete metadata storage
 */
export const uploadImageFile = async (
  file: File,
  userId: string,
  options: FileUploadOptions = {}
): Promise<StorageUploadResult> => {
  try {
    // Create document in Firestore first
    const documentData: CreateDocumentData = {
      title: options.title || file.name.replace(/\.[^/.]+$/, ""),
      type: "image",
      content: {
        raw: "",
        processed: "",
      },
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
      tags: options.tags || [],
      isPublic: options.isPublic || false,
    };

    const documentId = await createDocumentWithFile(userId, documentData, file);

    // Upload file to Firebase Storage
    const uploadResult = await uploadImage(file, userId, documentId);

    if (
      uploadResult.success &&
      uploadResult.storagePath &&
      uploadResult.downloadURL
    ) {
      // Update Firestore with storage information
      await updateDocumentStorageInfo(
        documentId,
        uploadResult.storagePath,
        uploadResult.downloadURL
      );

      return {
        success: true,
        documentId,
        storagePath: uploadResult.storagePath,
        downloadURL: uploadResult.downloadURL,
      };
    } else {
      throw new Error(uploadResult.error || "Upload failed");
    }
  } catch (error) {
    console.error("Error in uploadImageFile:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Image upload failed",
    };
  }
};

/**
 * Upload a camera snapshot with complete metadata storage
 */
export const uploadCameraSnapshot = async (
  base64Data: string,
  userId: string,
  options: FileUploadOptions = {}
): Promise<StorageUploadResult> => {
  try {
    // Convert base64 to file
    const file = base64ToFile(
      base64Data,
      `snapshot_${Date.now()}.jpg`,
      "image/jpeg"
    );

    // Create document in Firestore first
    const documentData: CreateDocumentData = {
      title: options.title || `Camera Snapshot ${new Date().toLocaleString()}`,
      type: "image",
      content: {
        raw: "",
        processed: "",
      },
      metadata: {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      },
      tags: options.tags || ["camera", "snapshot"],
      isPublic: options.isPublic || false,
    };

    const documentId = await createDocumentWithFile(userId, documentData, file);

    // Upload file to Firebase Storage
    const uploadResult = await uploadSnapshot(file, userId, documentId);

    if (
      uploadResult.success &&
      uploadResult.storagePath &&
      uploadResult.downloadURL
    ) {
      // Update Firestore with storage information
      await updateDocumentStorageInfo(
        documentId,
        uploadResult.storagePath,
        uploadResult.downloadURL
      );

      return {
        success: true,
        documentId,
        storagePath: uploadResult.storagePath,
        downloadURL: uploadResult.downloadURL,
      };
    } else {
      throw new Error(uploadResult.error || "Upload failed");
    }
  } catch (error) {
    console.error("Error in uploadCameraSnapshot:", error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Camera snapshot upload failed",
    };
  }
};

/**
 * Upload any file type with automatic type detection
 */
export const uploadAnyFile = async (
  file: File,
  userId: string,
  options: FileUploadOptions = {}
): Promise<StorageUploadResult> => {
  const mimeType = file.type;

  // Determine file type and use appropriate upload function
  if (mimeType.startsWith("audio/")) {
    return uploadAudioFile(file, userId, options);
  } else if (mimeType.startsWith("image/")) {
    return uploadImageFile(file, userId, options);
  } else if (
    mimeType.includes("pdf") ||
    mimeType.includes("document") ||
    mimeType.includes("presentation")
  ) {
    return uploadDocumentFile(file, userId, options);
  } else {
    // Default to document upload for unknown types
    return uploadDocumentFile(file, userId, options);
  }
};
