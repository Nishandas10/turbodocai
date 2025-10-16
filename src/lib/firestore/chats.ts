import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  deleteDoc,
  where,
  Timestamp,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { Chat } from "../types";
import { COLLECTIONS } from "./constants";

/** Listen to user chats in real-time (top-level collection /chats filtered by userId) */
export const listenToUserChats = (
  userId: string,
  callback: (chats: Chat[]) => void,
  onError?: (error: unknown) => void
): Unsubscribe => {
  const chatsRef = collection(db, COLLECTIONS.CHATS);
  const qy = query(
    chatsRef,
    where("userId", "==", userId),
    orderBy("updatedAt", "desc")
  );
  return onSnapshot(
    qy,
    (snapshot: QuerySnapshot<DocumentData>) => {
      const chats = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Chat[];
      callback(chats);
    },
    (err) => {
      if (onError) onError(err);
      else console.error("listenToUserChats error", err);
    }
  );
};

/** Update a chat (e.g., rename or adjust language/context docs) */
export const updateChat = async (
  chatId: string,
  updates: Partial<Pick<Chat, "title" | "language" | "contextDocIds">>
): Promise<void> => {
  const ref = doc(db, COLLECTIONS.CHATS, chatId);
  await updateDoc(ref, { ...updates, updatedAt: Timestamp.now() });
};

/** Delete a chat */
export const deleteChat = async (chatId: string): Promise<void> => {
  const ref = doc(db, COLLECTIONS.CHATS, chatId);
  await deleteDoc(ref);
};
