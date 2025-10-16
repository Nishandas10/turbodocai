import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { SpaceTest, CreateSpaceTestData } from "../types";
import { COLLECTIONS } from "./constants";

/** Create a test document under: tests/{userId}/spaces/{spaceId}/tests/{autoId} */
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
