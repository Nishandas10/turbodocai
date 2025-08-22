import { useState, useEffect, useCallback } from "react";
import {
  createDocument,
  getUserDocuments,
  updateDocument,
  deleteDocument,
  updateDocumentStatus,
  updateDocumentLastAccessed,
  listenToUserDocuments,
  createDocumentWithProcessing,
} from "@/lib/firestore";
import { Document, CreateDocumentData, UpdateDocumentData } from "@/lib/types";

export function useDocuments(userId: string | null) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load documents on mount
  useEffect(() => {
    if (!userId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const loadDocuments = async () => {
      try {
        const docs = await getUserDocuments(userId);
        setDocuments(docs);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load documents"
        );
      } finally {
        setLoading(false);
      }
    };

    loadDocuments();
  }, [userId]);

  // Set up real-time listener
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = listenToUserDocuments(userId, (docs) => {
      setDocuments(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  const addDocument = useCallback(
    async (documentData: CreateDocumentData) => {
      if (!userId) throw new Error("User not authenticated");

      try {
        setError(null);
        const documentId = await createDocument(userId, documentData);
        return documentId;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to create document";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [userId]
  );

  const addDocumentWithProcessing = useCallback(
    async (documentData: CreateDocumentData, processingType: string) => {
      if (!userId) throw new Error("User not authenticated");

      try {
        setError(null);
        const result = await createDocumentWithProcessing(
          userId,
          documentData,
          processingType
        );
        return result;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to create document with processing";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [userId]
  );

  const updateDocumentById = useCallback(
    async (documentId: string, updates: UpdateDocumentData) => {
      if (!userId) throw new Error("User not authenticated");

      try {
        setError(null);
        await updateDocument(documentId, userId, updates);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update document";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [userId]
  );

  const deleteDocumentById = useCallback(
    async (documentId: string) => {
      if (!userId) throw new Error("User not authenticated");

      try {
        setError(null);
        await deleteDocument(documentId, userId);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to delete document";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [userId]
  );

  const updateStatus = useCallback(
    async (documentId: string, status: Document["status"]) => {
      if (!userId) throw new Error("User not authenticated");

      try {
        setError(null);
        await updateDocumentStatus(documentId, userId, status);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to update document status";
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [userId]
  );

  const markAsAccessed = useCallback(
    async (documentId: string) => {
      if (!userId) throw new Error("User not authenticated");

      try {
        await updateDocumentLastAccessed(documentId, userId);
      } catch (err) {
        console.error("Failed to update last accessed time:", err);
      }
    },
    [userId]
  );

  const getDocumentById = useCallback(
    (documentId: string) => {
      return documents.find((doc) => doc.id === documentId);
    },
    [documents]
  );

  const getDocumentsByType = useCallback(
    (type: Document["type"]) => {
      return documents.filter((doc) => doc.type === type);
    },
    [documents]
  );

  const getDocumentsByStatus = useCallback(
    (status: Document["status"]) => {
      return documents.filter((doc) => doc.status === status);
    },
    [documents]
  );

  const searchDocuments = useCallback(
    (query: string) => {
      const lowercaseQuery = query.toLowerCase();
      return documents.filter(
        (doc) =>
          doc.title.toLowerCase().includes(lowercaseQuery) ||
          doc.tags.some((tag) => tag.toLowerCase().includes(lowercaseQuery))
      );
    },
    [documents]
  );

  return {
    documents,
    loading,
    error,
    addDocument,
    addDocumentWithProcessing,
    updateDocument: updateDocumentById,
    deleteDocument: deleteDocumentById,
    updateStatus,
    markAsAccessed,
    getDocumentById,
    getDocumentsByType,
    getDocumentsByStatus,
    searchDocuments,
  };
}
