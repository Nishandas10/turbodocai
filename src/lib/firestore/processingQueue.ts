import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QuerySnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { ProcessingTask } from "../types";
import { COLLECTIONS } from "./constants";

/** Add a task to the processing queue */
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

/** Update processing task status */
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

/** Get pending processing tasks */
export const getPendingProcessingTasks = async (): Promise<
  ProcessingTask[]
> => {
  const qy = query(
    collection(db, COLLECTIONS.PROCESSING_QUEUE),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc")
  );
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as ProcessingTask[];
};

/** Listen to processing queue in real-time */
export const listenToProcessingQueue = (
  callback: (tasks: ProcessingTask[]) => void
): Unsubscribe => {
  const qy = query(
    collection(db, COLLECTIONS.PROCESSING_QUEUE),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(qy, (snap: QuerySnapshot<DocumentData>) => {
    const tasks = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as ProcessingTask[];
    callback(tasks);
  });
};
