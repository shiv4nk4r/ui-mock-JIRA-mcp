"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import type { User } from "@lib/types";
import { MOCK_USERS, getMockUser } from "./mock-users";
import {
  ALLOWED_EMAIL_DOMAIN,
  isAllowedEmail,
  isFirebaseEnabled,
} from "@lib/firebase/config";
import { getFirebaseAuth } from "@lib/firebase/client";
import {
  clearUserProfileCache,
  ensureUserProfile,
  primeUserProfile,
} from "@lib/firebase/user-profile";

const AUTH_KEY = "gor-auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  authError: string | null;
  signInWithMockUser: (userId: string) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadMockSession(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { userId: string };
    return getMockUser(parsed.userId) ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const useFirebase = isFirebaseEnabled();

  useEffect(() => {
    if (!useFirebase) {
      setUser(loadMockSession());
      setIsLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthError("Firebase is not configured. Check your environment variables.");
      setIsLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        clearUserProfileCache();
        setIsLoading(false);
        return;
      }

      if (!isAllowedEmail(firebaseUser.email)) {
        await firebaseSignOut(auth);
        setUser(null);
        setAuthError(`Only @${ALLOWED_EMAIL_DOMAIN} Google accounts are allowed.`);
        setIsLoading(false);
        return;
      }

      try {
        const profile = await ensureUserProfile(firebaseUser);
        primeUserProfile(profile);
        setUser(profile);
        setAuthError(null);
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : "Failed to load profile");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsub();
  }, [useFirebase]);

  const signInWithMockUser = useCallback(
    (userId: string) => {
      if (useFirebase) return;
      const found = getMockUser(userId);
      if (!found) return;
      setUser(found);
      localStorage.setItem(AUTH_KEY, JSON.stringify({ userId: found.id }));
    },
    [useFirebase],
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const auth = getFirebaseAuth();
    if (!auth) {
      setAuthError("Firebase Auth is not configured.");
      return;
    }

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ hd: ALLOWED_EMAIL_DOMAIN });

    try {
      const result = await signInWithPopup(auth, provider);
      if (!isAllowedEmail(result.user.email)) {
        await firebaseSignOut(auth);
        setAuthError(`Only @${ALLOWED_EMAIL_DOMAIN} Google accounts are allowed.`);
        return;
      }
      const profile = await ensureUserProfile(result.user);
      primeUserProfile(profile);
      setUser(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Sign-in failed";
      if (!message.includes("popup-closed")) {
        setAuthError(message);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    if (useFirebase) {
      const auth = getFirebaseAuth();
      if (auth) await firebaseSignOut(auth);
      clearUserProfileCache();
    } else {
      localStorage.removeItem(AUTH_KEY);
    }
    setUser(null);
    setAuthError(null);
  }, [useFirebase]);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      authError,
      signInWithMockUser,
      signInWithGoogle,
      signOut,
      clearAuthError,
    }),
    [user, isLoading, authError, signInWithMockUser, signInWithGoogle, signOut, clearAuthError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function useRequireAuth(): { user: User; isLoading: boolean } {
  const { user, isLoading } = useAuth();
  return { user: user!, isLoading };
}

export { MOCK_USERS };
