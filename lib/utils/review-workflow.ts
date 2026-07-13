import { repository, generateId } from "@lib/storage";
import type { Comment, ReviewEventKind, ReviewItem, User } from "@lib/types";
import { normalizeMockupHtml } from "@lib/utils/mockup-html";

export async function addReviewEvent(
  reviewId: string,
  user: Pick<User, "id" | "name" | "role">,
  text: string,
  kind: ReviewEventKind,
): Promise<Comment> {
  const comment: Comment = {
    id: generateId(),
    targetId: reviewId,
    authorName: user.name,
    authorId: user.id,
    authorRole: user.role,
    text,
    createdAt: Date.now(),
    kind,
  };
  await repository.addComment(comment);
  return comment;
}

export async function submitOrResubmitReview(params: {
  user: User;
  sessionId: string;
  ticketId: string;
  ticketSummary: string;
  activeHtml: string;
}): Promise<{ reviewId: string; resubmitted: boolean }> {
  const { user, sessionId, ticketId, ticketSummary, activeHtml } = params;
  const cleanHtml = normalizeMockupHtml(activeHtml);
  const existing = await repository.getReviewByTicket(ticketId, user.id);

  if (existing?.status === "pending_review") {
    throw new Error("This mockup is already awaiting review");
  }

  if (existing && existing.status !== "approved" && existing.status !== "reviewed") {
    await repository.updateReview(existing.id, {
      activeHtml: cleanHtml,
      status: "pending_review",
      sessionId,
      ticketSummary,
      reviewedAt: undefined,
      internalNotes: undefined,
    });
    await addReviewEvent(
      existing.id,
      user,
      "Updated the mockup and sent it back for review.",
      "resubmission",
    );
    return { reviewId: existing.id, resubmitted: true };
  }

  const reviewId = generateId();
  const now = Date.now();
  await repository.createReview({
    id: reviewId,
    sessionId,
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    ticketId,
    ticketSummary,
    activeHtml: cleanHtml,
    status: "pending_review",
    submittedAt: now,
  });
  await addReviewEvent(
    reviewId,
    user,
    "Submitted mockup for engineering review.",
    "submission",
  );
  return { reviewId, resubmitted: false };
}

export async function finalizeReview(params: {
  review: ReviewItem;
  user: Pick<User, "id" | "name" | "role">;
  status: Extract<ReviewItem["status"], "approved" | "needs_changes">;
  message?: string;
}): Promise<void> {
  const { review, user, status, message } = params;
  const trimmed = message?.trim() ?? "";
  if (status === "needs_changes" && !trimmed) {
    throw new Error("Add a message describing what needs to change.");
  }

  const kind: ReviewEventKind = status === "approved" ? "approval" : "changes_requested";
  const defaultText = "Approved for implementation — engineering can proceed with the build plan.";
  const text = status === "approved" ? trimmed || defaultText : trimmed;

  await addReviewEvent(review.id, user, text, kind);
  await repository.updateReview(review.id, {
    status,
    reviewedAt: Date.now(),
    internalNotes: trimmed || undefined,
  });

  const saved = await repository.getSession(review.userId, review.ticketId);
  if (saved) {
    await repository.saveSession({
      ...saved,
      status: status === "approved" ? "reviewed" : "needs_changes",
    });
  }
}

export async function retractReview(params: {
  review: ReviewItem;
  user: User;
}): Promise<void> {
  const { review, user } = params;

  if (review.userId !== user.id) {
    throw new Error("Only the person who submitted this mockup can retract it");
  }
  if (review.status !== "pending_review") {
    throw new Error("This mockup is not awaiting review");
  }

  await addReviewEvent(
    review.id,
    user,
    "Withdrew the mockup from review to continue refining in the workspace.",
    "retraction",
  );
  await repository.updateReview(review.id, {
    status: "withdrawn",
    reviewedAt: undefined,
  });

  const saved = await repository.getSession(review.userId, review.ticketId);
  if (saved) {
    await repository.saveSession({
      ...saved,
      status: "in_progress",
    });
  }
}

export function reviewActivityAt(review: ReviewItem): number {
  return Math.max(review.submittedAt, review.reviewedAt ?? 0);
}
