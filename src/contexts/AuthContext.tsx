"use client"

import React, { createContext, useContext, useEffect, useState } from 'react';
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
  const ensureUserProfile = async (firebaseUser: User, retryCount = 0): Promise<void> => {
    try {
      console.log('Ensuring user profile for:', firebaseUser.uid);
      console.log('Using Firestore database: turbonotesai');
      
      // Check if user profile already exists
      const existingProfile = await getUserProfile(firebaseUser.uid);
      
      if (!existingProfile) {
        console.log('Creating new user profile...');
        
        // Create new user profile
        await createUserProfile(firebaseUser.uid, {
          email: firebaseUser.email || '',
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          photoURL: firebaseUser.photoURL || '',
        });
        
        console.log('User profile created successfully');
        
        // Initialize user analytics
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
      console.error('Error ensuring user profile:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: error instanceof Error && 'code' in error ? error.code : 'Unknown code',
        userId: firebaseUser.uid
      });
      
      // Retry logic for network issues
      if (retryCount < 3 && error instanceof Error && error.message?.includes('offline')) {
        console.log(`Retrying profile creation (attempt ${retryCount + 1}/3)...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
        return ensureUserProfile(firebaseUser, retryCount + 1);
      }
      
      // If all retries failed, log the error but don't block the user
      console.warn('Profile creation failed after retries, user can still proceed');
    }
  };

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
  }, []);

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