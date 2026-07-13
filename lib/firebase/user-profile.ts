import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import type { User as FirebaseUser } from "firebase/auth";
import type { User, UserRole } from "@lib/types";
import { getMockUser } from "@lib/auth/mock-users";
import { getFirebaseDb } from "@lib/firebase/client";
import { isFirebaseEnabled } from "@lib/firebase/config";

const profileCache = new Map<string, User>();

function defaultRoleForEmail(email: string): UserRole {
  const lower = email.toLowerCase();
  const internalList = (process.env.NEXT_PUBLIC_INTERNAL_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (internalList.includes(lower)) return "internal";
  // Default GreyOrange employees to internal; override via Firestore user doc if needed.
  return "internal";
}

export async function ensureUserProfile(firebaseUser: FirebaseUser): Promise<User> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase is not configured");

  const ref = doc(db, "users", firebaseUser.uid);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const data = existing.data() as User;
    const user: User = {
      id: firebaseUser.uid,
      email: data.email ?? firebaseUser.email ?? "",
      name: data.name ?? firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "User",
      role: data.role ?? defaultRoleForEmail(firebaseUser.email ?? ""),
      avatarUrl: data.avatarUrl ?? firebaseUser.photoURL ?? undefined,
    };
    profileCache.set(user.id, user);
    return user;
  }

  const user: User = {
    id: firebaseUser.uid,
    email: firebaseUser.email ?? "",
    name: firebaseUser.displayName ?? firebaseUser.email?.split("@")[0] ?? "User",
    role: defaultRoleForEmail(firebaseUser.email ?? ""),
    avatarUrl: firebaseUser.photoURL ?? undefined,
  };

  await setDoc(ref, {
    ...user,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  profileCache.set(user.id, user);
  return user;
}

export async function getUserProfile(userId: string): Promise<User | undefined> {
  if (profileCache.has(userId)) return profileCache.get(userId);

  if (!isFirebaseEnabled()) return getMockUser(userId);

  const db = getFirebaseDb();
  if (!db) return getMockUser(userId);

  const snap = await getDoc(doc(db, "users", userId));
  if (!snap.exists()) return getMockUser(userId);

  const data = snap.data() as User;
  const user: User = {
    id: userId,
    email: data.email,
    name: data.name,
    role: data.role,
    avatarUrl: data.avatarUrl,
  };
  profileCache.set(userId, user);
  return user;
}

export function primeUserProfile(user: User) {
  profileCache.set(user.id, user);
}

export function clearUserProfileCache() {
  profileCache.clear();
}
