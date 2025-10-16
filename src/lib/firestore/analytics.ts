import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { UserAnalytics } from "../types";
import { COLLECTIONS } from "./constants";

/** Get user analytics */
export const getUserAnalytics = async (
  userId: string
): Promise<UserAnalytics | null> => {
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  const analyticsSnap = await getDoc(analyticsRef);
  if (analyticsSnap.exists()) {
    return { id: analyticsSnap.id, ...analyticsSnap.data() } as UserAnalytics;
  }
  return null;
};

/** Initialize user analytics */
export const initializeUserAnalytics = async (
  userId: string
): Promise<void> => {
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  const analytics: Omit<UserAnalytics, "id"> = {
    documentsCreated: 0,
    totalStorageUsed: 0,
    lastActiveDate: Timestamp.now(),
    featureUsage: {},
  };
  await setDoc(analyticsRef, analytics);
};

/** Increment user analytics counters */
export const incrementUserAnalytics = async (
  userId: string,
  increments: Partial<
    Pick<UserAnalytics, "documentsCreated" | "totalStorageUsed">
  >
): Promise<void> => {
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  const existing = await getUserAnalytics(userId);
  if (!existing) await initializeUserAnalytics(userId);

  const updates: Record<string, number | Timestamp> = {
    lastActiveDate: Timestamp.now(),
  };
  if (increments.documentsCreated !== undefined) {
    updates.documentsCreated = increments.documentsCreated;
  }
  if (increments.totalStorageUsed !== undefined) {
    updates.totalStorageUsed = increments.totalStorageUsed;
  }
  await updateDoc(analyticsRef, updates);
};

/** Track feature usage */
export const trackFeatureUsage = async (
  userId: string,
  feature: string,
  increment: number = 1
): Promise<void> => {
  const analyticsRef = doc(db, COLLECTIONS.USER_ANALYTICS, userId);
  const analytics = await getUserAnalytics(userId);
  if (analytics) {
    const currentUsage = analytics.featureUsage[feature] || 0;
    const newUsage = currentUsage + increment;
    await updateDoc(analyticsRef, {
      [`featureUsage.${feature}`]: newUsage,
      lastActiveDate: Timestamp.now(),
    });
  }
};
