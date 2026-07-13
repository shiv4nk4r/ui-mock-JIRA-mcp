import type {
  Comment,
  EngagementFilter,
  MockupSession,
  ReviewFilter,
  ReviewItem,
  SharedMock,
  UserEngagement,
} from "@lib/types";

export interface IRepository {
  getSessions(userId: string): Promise<MockupSession[]>;
  getSession(userId: string, ticketId: string): Promise<MockupSession | null>;
  saveSession(session: MockupSession): Promise<void>;
  deleteSession(userId: string, ticketId: string): Promise<void>;

  getReviews(filter?: ReviewFilter): Promise<ReviewItem[]>;
  getReview(id: string): Promise<ReviewItem | null>;
  getReviewByTicket(ticketId: string, userId?: string): Promise<ReviewItem | null>;
  createReview(item: ReviewItem): Promise<void>;
  updateReview(id: string, patch: Partial<ReviewItem>): Promise<void>;

  createShare(share: SharedMock): Promise<string>;
  getShare(shareId: string): Promise<SharedMock | null>;

  getComments(targetId: string): Promise<Comment[]>;
  addComment(comment: Comment): Promise<void>;

  saveEngagement(item: UserEngagement): Promise<void>;
  updateEngagement(id: string, patch: Partial<UserEngagement>): Promise<void>;
  getEngagement(filter: EngagementFilter): Promise<UserEngagement[]>;

  migrateLegacySessions(userId: string): Promise<void>;
}
