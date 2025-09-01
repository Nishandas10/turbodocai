import { useState, useEffect } from "react";
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import {
  createUserProfile,
  getUserProfile,
  initializeUserAnalytics,
} from "@/lib/firestore";
import { UserProfile } from "@/lib/types";

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  profile: UserProfile | null;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          try {
            // Try to get existing user profile
            let profile = await getUserProfile(firebaseUser.uid);

            if (!profile) {
              // Create new user profile if it doesn't exist
              await createUserProfile(firebaseUser.uid, {
                email: firebaseUser.email || "",
                displayName: firebaseUser.displayName || "",
                photoURL: firebaseUser.photoURL || "",
              });

              // Initialize user analytics
              await initializeUserAnalytics(firebaseUser.uid);

              // Get the newly created profile
              profile = await getUserProfile(firebaseUser.uid);
            }

            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              profile: profile,
            });
          } catch (error) {
            console.error("Error setting up user profile:", error);
            // Set user without profile if there's an error
            setUser({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              profile: null,
            });
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  };

  return {
    user,
    loading,
    signInWithGoogle,
    logout,
  };
}
