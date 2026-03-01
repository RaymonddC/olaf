'use client';

import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  type Auth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase Client SDK only runs in the browser. Guard against SSR to prevent
// "invalid-api-key" errors during static generation (env vars may be empty).
function getFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    // Return a dummy object during SSR — never used at runtime
    return {} as FirebaseApp;
  }
  return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

// Singleton — avoid re-initializing on hot reload
const app: FirebaseApp = getFirebaseApp();

const auth: Auth = typeof window !== 'undefined' ? getAuth(app) : ({} as Auth);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Get the current user's Firebase ID token.
 * Used to authenticate requests to the backend API.
 */
async function getAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

/**
 * Force-refresh the ID token (call when the token may be expired).
 */
async function refreshAuthToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken(/* forceRefresh */ true);
  } catch {
    return null;
  }
}

export {
  app,
  auth,
  googleProvider,
  getAuthToken,
  refreshAuthToken,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  type User,
};
