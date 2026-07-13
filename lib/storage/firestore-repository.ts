import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import type {
  Comment,
  EngagementFilter,
  MockupSession,
  ReviewFilter,
  ReviewItem,
  SharedMock,
  UserEngagement,
} from "@lib/types";
import type { IRepository } from "./repository";
import { getFirebaseDb } from "@lib/firebase/client";
import {
  downloadHtml,
  reviewHtmlPath,
  sessionHtmlPath,
  shareHtmlPath,
  shouldStoreHtmlInStorage,
  uploadHtml,
} from "./html-storage";
import { generateId } from "./local-storage";

type StoredSession = Omit<MockupSession, "activeHtml"> & {
  activeHtml?: string;
  activeHtmlPath?: string;
};

type StoredReview = Omit<ReviewItem, "activeHtml"> & {
  activeHtml?: string;
  activeHtmlPath?: string;
};

type StoredShare = Omit<SharedMock, "activeHtml"> & {
  activeHtml?: string;
  activeHtmlPath?: string;
};

function requireDb() {
  if (typeof window === "undefined") throw new Error("Firestore repository is client-only");
  const db = getFirebaseDb();
  if (!db) throw new Error("Firestore is not configured");
  return db;
}

async function persistHtml(
  html: string,
  path: string,
): Promise<{ activeHtml?: string; activeHtmlPath?: string }> {
  if (!html) return {};
  if (shouldStoreHtmlInStorage(html)) {
    await uploadHtml(path, html);
    return { activeHtmlPath: path };
  }
  return { activeHtml: html };
}

async function hydrateHtml(
  data: { activeHtml?: string; activeHtmlPath?: string },
): Promise<string> {
  if (data.activeHtml) return data.activeHtml;
  if (data.activeHtmlPath) {
    try {
      return await downloadHtml(data.activeHtmlPath);
    } catch {
      return "";
    }
  }
  return "";
}

export class FirestoreRepository implements IRepository {
  async getSessions(userId: string): Promise<MockupSession[]> {
    const db = requireDb();
    const q = query(
      collection(db, "sessions"),
      where("userId", "==", userId),
      orderBy("savedAt", "desc"),
    );
    const snap = await getDocs(q);
    return Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data() as StoredSession;
        const activeHtml = await hydrateHtml(data);
        return { ...data, id: d.id, activeHtml } as MockupSession;
      }),
    );
  }

  async getSession(userId: string, ticketId: string): Promise<MockupSession | null> {
    const db = requireDb();
    const q = query(
      collection(db, "sessions"),
      where("userId", "==", userId),
      where("ticketId", "==", ticketId),
      limit(1),
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    const data = d.data() as StoredSession;
    const activeHtml = await hydrateHtml(data);
    return { ...data, id: d.id, activeHtml } as MockupSession;
  }

  async saveSession(session: MockupSession): Promise<void> {
    const db = requireDb();
    const path = sessionHtmlPath(session.userId, session.id);
    const htmlFields = await persistHtml(session.activeHtml, path);
    const payload: StoredSession = {
      id: session.id,
      userId: session.userId,
      ticketId: session.ticketId,
      ticketData: session.ticketData,
      messages: session.messages.map((m) => ({ ...m, isStreaming: false })),
      usageRecords: session.usageRecords,
      selectedModel: session.selectedModel,
      status: session.status,
      savedAt: session.savedAt,
      reviewId: session.reviewId,
      ...htmlFields,
    };
    await setDoc(doc(db, "sessions", session.id), payload, { merge: true });
  }

  async deleteSession(userId: string, ticketId: string): Promise<void> {
    const session = await this.getSession(userId, ticketId);
    if (!session) return;
    await deleteDoc(doc(requireDb(), "sessions", session.id));
  }

  async getReviews(filter?: ReviewFilter): Promise<ReviewItem[]> {
    const db = requireDb();
    let q = query(collection(db, "reviews"), orderBy("submittedAt", "desc"));
    if (filter?.userId) {
      q = query(collection(db, "reviews"), where("userId", "==", filter.userId), orderBy("submittedAt", "desc"));
    }
    const snap = await getDocs(q);
    let items = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data() as StoredReview;
        const activeHtml = await hydrateHtml(data);
        return { ...data, id: d.id, activeHtml } as ReviewItem;
      }),
    );
    if (filter?.status) items = items.filter((r) => r.status === filter.status);
    return items;
  }

  async getReview(id: string): Promise<ReviewItem | null> {
    const db = requireDb();
    const snap = await getDoc(doc(db, "reviews", id));
    if (!snap.exists()) return null;
    const data = snap.data() as StoredReview;
    const activeHtml = await hydrateHtml(data);
    return { ...data, id: snap.id, activeHtml } as ReviewItem;
  }

  async getReviewByTicket(ticketId: string, userId?: string): Promise<ReviewItem | null> {
    const db = requireDb();
    const constraints = [where("ticketId", "==", ticketId)];
    if (userId) constraints.push(where("userId", "==", userId));
    const snap = await getDocs(query(collection(db, "reviews"), ...constraints));
    if (snap.empty) return null;
    const items = await Promise.all(
      snap.docs.map(async (d) => {
        const data = d.data() as StoredReview;
        const activeHtml = await hydrateHtml(data);
        return { ...data, id: d.id, activeHtml } as ReviewItem;
      }),
    );
    return items.sort((a, b) => {
      const aAt = Math.max(a.submittedAt, a.reviewedAt ?? 0);
      const bAt = Math.max(b.submittedAt, b.reviewedAt ?? 0);
      return bAt - aAt;
    })[0];
  }

  async createReview(item: ReviewItem): Promise<void> {
    const db = requireDb();
    const htmlFields = await persistHtml(item.activeHtml, reviewHtmlPath(item.id));
    const payload: StoredReview = {
      id: item.id,
      sessionId: item.sessionId,
      userId: item.userId,
      userName: item.userName,
      userEmail: item.userEmail,
      ticketId: item.ticketId,
      ticketSummary: item.ticketSummary,
      status: item.status,
      submittedAt: item.submittedAt,
      reviewedAt: item.reviewedAt,
      internalNotes: item.internalNotes,
      ...htmlFields,
    };
    await setDoc(doc(db, "reviews", item.id), payload);
  }

  async updateReview(id: string, patch: Partial<ReviewItem>): Promise<void> {
    const db = requireDb();
    const { activeHtml, ...rest } = patch;
    const payload: Partial<StoredReview> = { ...rest };
    if (activeHtml !== undefined) {
      Object.assign(payload, await persistHtml(activeHtml, reviewHtmlPath(id)));
      if (!shouldStoreHtmlInStorage(activeHtml)) payload.activeHtmlPath = undefined;
    }
    await setDoc(doc(db, "reviews", id), payload, { merge: true });
  }

  async createShare(share: SharedMock): Promise<string> {
    const db = requireDb();
    const htmlFields = await persistHtml(share.activeHtml, shareHtmlPath(share.shareId));
    const payload: StoredShare = {
      id: share.id,
      shareId: share.shareId,
      sessionId: share.sessionId,
      ticketId: share.ticketId,
      ticketSummary: share.ticketSummary,
      createdBy: share.createdBy,
      createdByName: share.createdByName,
      createdAt: share.createdAt,
      ...htmlFields,
    };
    await setDoc(doc(db, "shares", share.shareId), payload);
    return share.shareId;
  }

  async getShare(shareId: string): Promise<SharedMock | null> {
    const db = requireDb();
    const snap = await getDoc(doc(db, "shares", shareId));
    if (!snap.exists()) return null;
    const data = snap.data() as StoredShare;
    const activeHtml = await hydrateHtml(data);
    return { ...data, id: data.id ?? snap.id, activeHtml } as SharedMock;
  }

  async getComments(targetId: string): Promise<Comment[]> {
    const db = requireDb();
    const q = query(
      collection(db, "comments"),
      where("targetId", "==", targetId),
      orderBy("createdAt", "asc"),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Comment));
  }

  async addComment(comment: Comment): Promise<void> {
    const db = requireDb();
    await setDoc(doc(db, "comments", comment.id), comment);
  }

  async saveEngagement(item: UserEngagement): Promise<void> {
    const db = requireDb();
    const docId = `${item.userId}_${item.sessionId}_${item.type}`;
    await setDoc(doc(db, "engagement", docId), item, { merge: true });
  }

  async getEngagement(filter: EngagementFilter): Promise<UserEngagement[]> {
    const db = requireDb();
    let items: UserEngagement[];

    if (filter.userId) {
      const snap = await getDocs(query(collection(db, "engagement"), where("userId", "==", filter.userId)));
      items = snap.docs.map((d) => d.data() as UserEngagement);
    } else if (filter.sessionId) {
      const snap = await getDocs(query(collection(db, "engagement"), where("sessionId", "==", filter.sessionId)));
      items = snap.docs.map((d) => d.data() as UserEngagement);
    } else if (filter.ticketId) {
      const snap = await getDocs(query(collection(db, "engagement"), where("ticketId", "==", filter.ticketId)));
      items = snap.docs.map((d) => d.data() as UserEngagement);
    } else {
      const snap = await getDocs(query(collection(db, "engagement"), orderBy("createdAt", "desc")));
      items = snap.docs.map((d) => d.data() as UserEngagement);
    }

    if (filter.sessionId) items = items.filter((e) => e.sessionId === filter.sessionId);
    if (filter.ticketId) items = items.filter((e) => e.ticketId === filter.ticketId);
    if (filter.userId) items = items.filter((e) => e.userId === filter.userId);
    if (filter.type) items = items.filter((e) => e.type === filter.type);
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }

  async migrateLegacySessions(userId: string): Promise<void> {
    if (typeof window === "undefined") return;
    const flagKey = `gor-firebase-migration-done-${userId}`;
    if (localStorage.getItem(flagKey)) return;

    const { LocalStorageRepository } = await import("./local-storage");
    const local = new LocalStorageRepository();
    const sessions = await local.getSessions(userId);
    for (const session of sessions) {
      await this.saveSession(session);
    }

    const reviews = await local.getReviews();
    for (const review of reviews) {
      const existing = await this.getReview(review.id);
      if (!existing) await this.createReview(review);
    }

    localStorage.setItem(flagKey, "1");
  }
}

export { generateId };
