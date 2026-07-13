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

const KEYS = {
  session: (userId: string, ticketId: string) => `gor-session-${userId}-${ticketId}`,
  reviews: "gor-reviews",
  shares: "gor-shares",
  comments: (targetId: string) => `gor-comments-${targetId}`,
  engagement: "gor-engagement",
  migration: (userId: string) => `gor-migration-done-${userId}`,
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class LocalStorageRepository implements IRepository {
  async getSessions(userId: string): Promise<MockupSession[]> {
    if (typeof window === "undefined") return [];
    const sessions: MockupSession[] = [];
    const prefix = `gor-session-${userId}-`;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) sessions.push(JSON.parse(raw) as MockupSession);
        } catch { /* skip corrupt */ }
      }
    }
    return sessions.sort((a, b) => b.savedAt - a.savedAt);
  }

  async getSession(userId: string, ticketId: string): Promise<MockupSession | null> {
    return readJson<MockupSession | null>(KEYS.session(userId, ticketId), null);
  }

  async saveSession(session: MockupSession): Promise<void> {
    writeJson(KEYS.session(session.userId, session.ticketId), session);
  }

  async deleteSession(userId: string, ticketId: string): Promise<void> {
    if (typeof window === "undefined") return;
    localStorage.removeItem(KEYS.session(userId, ticketId));
  }

  async getReviews(filter?: ReviewFilter): Promise<ReviewItem[]> {
    let items = readJson<ReviewItem[]>(KEYS.reviews, []);
    if (filter?.status) items = items.filter((r) => r.status === filter.status);
    if (filter?.userId) items = items.filter((r) => r.userId === filter.userId);
    return items.sort((a, b) => b.submittedAt - a.submittedAt);
  }

  async getReview(id: string): Promise<ReviewItem | null> {
    const items = await this.getReviews();
    return items.find((r) => r.id === id) ?? null;
  }

  async getReviewByTicket(ticketId: string, userId?: string): Promise<ReviewItem | null> {
    let items = await this.getReviews();
    items = items.filter((r) => r.ticketId === ticketId);
    if (userId) items = items.filter((r) => r.userId === userId);
    if (items.length === 0) return null;
    return items.sort((a, b) => {
      const aAt = Math.max(a.submittedAt, a.reviewedAt ?? 0);
      const bAt = Math.max(b.submittedAt, b.reviewedAt ?? 0);
      return bAt - aAt;
    })[0];
  }

  async createReview(item: ReviewItem): Promise<void> {
    const items = await this.getReviews();
    items.unshift(item);
    writeJson(KEYS.reviews, items);
  }

  async updateReview(id: string, patch: Partial<ReviewItem>): Promise<void> {
    const items = await this.getReviews();
    const idx = items.findIndex((r) => r.id === id);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...patch };
      writeJson(KEYS.reviews, items);
    }
  }

  async createShare(share: SharedMock): Promise<string> {
    const map = readJson<Record<string, SharedMock>>(KEYS.shares, {});
    map[share.shareId] = share;
    writeJson(KEYS.shares, map);
    return share.shareId;
  }

  async getShare(shareId: string): Promise<SharedMock | null> {
    const map = readJson<Record<string, SharedMock>>(KEYS.shares, {});
    return map[shareId] ?? null;
  }

  async getComments(targetId: string): Promise<Comment[]> {
    return readJson<Comment[]>(KEYS.comments(targetId), []).sort(
      (a, b) => a.createdAt - b.createdAt,
    );
  }

  async addComment(comment: Comment): Promise<void> {
    const existing = await this.getComments(comment.targetId);
    existing.push(comment);
    writeJson(KEYS.comments(comment.targetId), existing);
  }

  async saveEngagement(item: UserEngagement): Promise<void> {
    const all = readJson<UserEngagement[]>(KEYS.engagement, []);
    const idx = all.findIndex(
      (e) => e.userId === item.userId && e.sessionId === item.sessionId && e.type === item.type,
    );
    if (idx >= 0) all[idx] = item;
    else all.push(item);
    writeJson(KEYS.engagement, all);
  }

  async updateEngagement(id: string, patch: Partial<UserEngagement>): Promise<void> {
    const all = readJson<UserEngagement[]>(KEYS.engagement, []);
    const idx = all.findIndex((e) => e.id === id);
    if (idx >= 0) {
      all[idx] = { ...all[idx], ...patch };
      writeJson(KEYS.engagement, all);
    }
  }

  async getEngagement(filter: EngagementFilter): Promise<UserEngagement[]> {
    let items = readJson<UserEngagement[]>(KEYS.engagement, []);
    if (filter.sessionId) items = items.filter((e) => e.sessionId === filter.sessionId);
    if (filter.ticketId) items = items.filter((e) => e.ticketId === filter.ticketId);
    if (filter.userId) items = items.filter((e) => e.userId === filter.userId);
    if (filter.type) items = items.filter((e) => e.type === filter.type);
    return items.sort((a, b) => b.createdAt - a.createdAt);
  }

  async migrateLegacySessions(userId: string): Promise<void> {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEYS.migration(userId))) return;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("poc-mcp-v2-")) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const legacy = JSON.parse(raw) as {
          ticketId: string;
          ticketData: MockupSession["ticketData"];
          messages: MockupSession["messages"];
          activeHtml: string;
          usageRecords: MockupSession["usageRecords"];
          selectedModel: string;
          savedAt: number;
        };
        const session: MockupSession = {
          id: generateId(),
          userId,
          ticketId: legacy.ticketId,
          ticketData: legacy.ticketData,
          messages: legacy.messages ?? [],
          activeHtml: legacy.activeHtml ?? "",
          usageRecords: legacy.usageRecords ?? [],
          selectedModel: legacy.selectedModel ?? "",
          status: legacy.activeHtml ? "in_progress" : "draft",
          savedAt: legacy.savedAt ?? Date.now(),
        };
        await this.saveSession(session);
      } catch { /* skip */ }
    }

    localStorage.setItem(KEYS.migration(userId), "1");
  }
}

export { generateId };
