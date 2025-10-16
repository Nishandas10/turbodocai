import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { Document, Space, CreateSpaceData } from "../types";
import { COLLECTIONS } from "./constants";

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
