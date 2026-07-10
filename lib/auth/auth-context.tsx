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
import type { User } from "@lib/types";
import { MOCK_USERS, getMockUser } from "./mock-users";

const AUTH_KEY = "gor-auth";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  signInWithMockUser: (userId: string) => void;
  signInWithGoogle: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { userId: string };
        const found = getMockUser(parsed.userId);
        if (found) setUser(found);
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  }, []);

  const signInWithMockUser = useCallback((userId: string) => {
    const found = getMockUser(userId);
    if (!found) return;
    setUser(found);
    localStorage.setItem(AUTH_KEY, JSON.stringify({ userId: found.id }));
  }, []);

  const signInWithGoogle = useCallback(() => {
    signInWithMockUser(MOCK_USERS[0].id);
  }, [signInWithMockUser]);

  const signOut = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, signInWithMockUser, signInWithGoogle, signOut }),
    [user, isLoading, signInWithMockUser, signInWithGoogle, signOut],
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
