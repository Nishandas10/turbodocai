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
  where,
  updateDoc,
  Timestamp,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { MindMap, CreateMindMapData, UpdateMindMapData } from "../types";
import { COLLECTIONS } from "./constants";

export const createMindMap = async (
  userId: string,
  data: CreateMindMapData
): Promise<string> => {
  const now = Timestamp.now();
  const ref = await addDoc(collection(db, COLLECTIONS.MINDMAPS), {
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
  } as Omit<MindMap, "id">);
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

export const deleteMindMap = async (mindMapId: string): Promise<void> => {
  const ref = doc(db, COLLECTIONS.MINDMAPS, mindMapId);
  await deleteDoc(ref);
};

export const getMindMaps = async (
  userId: string,
  limitCount: number = 100
): Promise<MindMap[]> => {
  const colRef = collection(db, COLLECTIONS.MINDMAPS);
  const qy = query(
    colRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as MindMap[];
};

export const listenToMindMaps = (
  userId: string,
  callback: (maps: MindMap[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  const colRef = collection(db, COLLECTIONS.MINDMAPS);
  const qy = query(
    colRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(
    qy,
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
