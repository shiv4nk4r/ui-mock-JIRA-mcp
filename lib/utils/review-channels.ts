import { repository } from "@lib/storage";
import type { Comment, ReviewItem } from "@lib/types";
import { reviewActivityAt } from "@lib/utils/review-workflow";
import { relativeTime } from "@lib/utils/review-ui";

export interface TicketReviewChannel {
  ticketId: string;
  ticketSummary: string;
  review: ReviewItem;
  lastActivityAt: number;
  lastMessagePreview: string;
  messageCount: number;
  lastAuthor?: string;
}

function previewForComment(comment: Comment | undefined, review: ReviewItem): string {
  if (!comment) {
    if (review.status === "needs_changes") return "Engineering requested changes";
    if (review.status === "approved") return "Approved for implementation";
    if (review.status === "pending_review") return "Awaiting engineering review";
    return "Review channel opened";
  }

  switch (comment.kind) {
    case "submission":
      return "Mockup submitted for review";
    case "resubmission":
      return "Updated mockup resubmitted";
    case "approval":
      return comment.text;
    case "changes_requested":
      return comment.text;
    default:
      return comment.text;
  }
}

function dedupeReviewsByTicket(reviews: ReviewItem[]): ReviewItem[] {
  const byTicket = new Map<string, ReviewItem>();
  for (const review of reviews) {
    const key = `${review.ticketId}:${review.userId}`;
    const existing = byTicket.get(key);
    if (!existing || reviewActivityAt(review) > reviewActivityAt(existing)) {
      byTicket.set(key, review);
    }
  }
  return Array.from(byTicket.values());
}

export async function loadReviewChannels(reviews: ReviewItem[]): Promise<TicketReviewChannel[]> {
  const unique = dedupeReviewsByTicket(reviews);
  const channels = await Promise.all(
    unique.map(async (review) => {
      const comments = await repository.getComments(review.id);
      const last = comments[comments.length - 1];
      const lastActivityAt = Math.max(reviewActivityAt(review), last?.createdAt ?? 0);
      return {
        ticketId: review.ticketId,
        ticketSummary: review.ticketSummary,
        review,
        lastActivityAt,
        lastMessagePreview: previewForComment(last, review),
        messageCount: comments.length + (comments.some((c) => c.kind === "submission") ? 0 : 1),
        lastAuthor: last?.authorName,
      };
    }),
  );
  return channels.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
}

export function channelActivityLabel(ts: number): string {
  return relativeTime(ts);
}
