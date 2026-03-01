'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  auth,
  googleProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  firebaseSignOut,
  onAuthStateChanged,
  getAuthToken,
  type User,
} from '@/lib/firebase';

export type UserRole = 'elderly' | 'family';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  role: UserRole | null;
  /** Sign in with email + password */
  signIn: (email: string, password: string) => Promise<User>;
  /** Register a new account */
  signUp: (email: string, password: string) => Promise<User>;
  /** Sign out */
  signOut: () => Promise<void>;
  /** Sign in with Google popup */
  signInWithGoogle: () => Promise<User>;
  /** Set/persist the user role (stored in localStorage) */
  setRole: (role: UserRole) => void;
  /** Get the current auth token (attaches to API requests) */
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ROLE_KEY = 'caria_user_role';

function getStoredRole(): UserRole | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(ROLE_KEY);
  return stored === 'elderly' || stored === 'family' ? stored : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRoleState] = useState<UserRole | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        setRoleState(getStoredRole());
      } else {
        setRoleState(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const setRole = useCallback((newRole: UserRole) => {
    localStorage.setItem(ROLE_KEY, newRole);
    setRoleState(newRole);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return credential.user;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password,
    );
    return credential.user;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const credential = await signInWithPopup(auth, googleProvider);
    return credential.user;
  }, []);

  const signOut = useCallback(async () => {
    localStorage.removeItem(ROLE_KEY);
    await firebaseSignOut(auth);
  }, []);

  const getToken = useCallback(async () => {
    return getAuthToken();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        role,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        setRole,
        getToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
