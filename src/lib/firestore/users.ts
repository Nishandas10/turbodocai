import { doc, getDoc, setDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { UserProfile } from "../types";
import { COLLECTIONS } from "./constants";

/** Create a new user profile on first login/signup */
export const createUserProfile = async (
  userId: string,
  profileData: Omit<UserProfile, "createdAt" | "subscription">
): Promise<void> => {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  const profile: UserProfile = {
    ...profileData,
    createdAt: Timestamp.now(),
    subscription: "free",
  };
  await setDoc(userRef, profile);
};

/** Get user profile */
export const getUserProfile = async (
  userId: string
): Promise<UserProfile | null> => {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) return userSnap.data() as UserProfile;
  return null;
};

/** Update user profile */
export const updateUserProfile = async (
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> => {
  const userRef = doc(db, COLLECTIONS.USERS, userId);
  await updateDoc(userRef, updates);
};

/** Update user subscription */
export const updateUserSubscription = async (
  userId: string,
  subscription: "free" | "premium"
): Promise<void> => {
  await updateUserProfile(userId, { subscription });
};
