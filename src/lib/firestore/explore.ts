import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { Timestamp } from "firebase/firestore";

export interface PublicDocumentMeta {
  id: string;
  ownerId: string;
  title: string;
  type: string;
  status: string;
  isPublic: boolean;
  tags?: string[];
  preview?: string;
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
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<PublicDocumentMeta, "id">),
  }));
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
    const docs = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<PublicDocumentMeta, "id">),
    }));
    callback(docs);
  });
};
