"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signInWithEmailLink, sendSignInLinkToEmail } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { createUserProfile, getUserProfile, initializeUserAnalytics } from '@/lib/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Function to create or get user profile with retry logic
  const ensureUserProfile = useCallback(async (firebaseUser: User, retryCount = 0): Promise<void> => {
    try {
      // Small delay on first attempt to ensure auth token is fully ready (avoids occasional permission-denied)
      if (retryCount === 0) {
        await new Promise(r => setTimeout(r, 150));
      }
      console.log('Ensuring user profile for:', firebaseUser.uid);
      const existingProfile = await getUserProfile(firebaseUser.uid);
      if (!existingProfile) {
        console.log('Creating new user profile...');
        await createUserProfile(firebaseUser.uid, {
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          photoURL: firebaseUser.photoURL || '',
        });
        console.log('User profile created successfully');
        try {
          await initializeUserAnalytics(firebaseUser.uid);
          console.log('User analytics initialized successfully');
        } catch (analyticsError) {
          console.warn('Failed to initialize analytics, will retry later:', analyticsError);
        }
      } else {
        console.log('User profile already exists');
      }
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code === 'permission-denied') {
        // Token propagation race; retry a couple of times with backoff
        if (retryCount < 2) {
          const delay = 250 * (retryCount + 1);
          console.warn(`Permission denied fetching profile; retrying in ${delay}ms (attempt ${retryCount + 1})`);
          await new Promise(r => setTimeout(r, delay));
          return ensureUserProfile(firebaseUser, retryCount + 1);
        }
        console.warn('Permission denied persists for user profile; proceeding without blocking.');
        return; // swallow
      }
      if (retryCount < 3 && error instanceof Error && error.message?.includes('offline')) {
        const delay = 500 * (retryCount + 1);
        console.log(`Offline error; retrying profile fetch in ${delay}ms (attempt ${retryCount + 1})`);
        await new Promise(r => setTimeout(r, delay));
        return ensureUserProfile(firebaseUser, retryCount + 1);
      }
      console.warn('Profile creation/fetch failed; non-blocking', error);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        console.log('User signed in:', firebaseUser.uid);
        
        // Set user immediately to avoid blocking the UI
        setUser(firebaseUser);
        setLoading(false);
        
        // Try to create profile in background (non-blocking)
        ensureUserProfile(firebaseUser).catch((error: unknown) => {
          console.warn('Background profile creation failed:', error);
        });
      } else {
        console.log('User signed out');
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [ensureUserProfile]);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        console.log('Google sign-in successful, redirecting to dashboard...');
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string) => {
    try {
      setLoading(true);
      
      // Check if this is a sign-in link
      if (window.location.href.includes('apiKey')) {
        console.log('Processing email sign-in link...');
        
        // User is returning with a sign-in link
        const result = await signInWithEmailLink(auth, email, window.location.href);
        if (result.user) {
          console.log('Email sign-in successful, redirecting to dashboard...');
          router.push('/dashboard');
        }
      } else {
        console.log('Sending sign-in link to email...');
        
        // Send sign-in link to email
        const actionCodeSettings = {
          url: window.location.href,
          handleCodeInApp: true,
        };
        
        await sendSignInLinkToEmail(auth, email, actionCodeSettings);
        
        // Save email to localStorage for when user returns
        window.localStorage.setItem('emailForSignIn', email);
        
        // Show success message
        alert('Check your email for the sign-in link!');
      }
    } catch (error) {
      console.error('Email sign-in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
      router.push('/signup');
    } catch (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 