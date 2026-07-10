import type { ReviewItem, UserRole } from "@lib/types";

/** Badge count shown on the Reviews nav tab. */
export function reviewNavBadgeCount(reviews: ReviewItem[], role: UserRole): number {
  if (role === "internal") {
    return reviews.filter((r) => r.status === "pending_review").length;
  }
  return reviews.filter((r) => r.status === "needs_changes").length;
}

export async function fetchReviewsForNav(
  userId: string,
  role: UserRole,
  getReviews: (filter?: { status?: ReviewItem["status"]; userId?: string }) => Promise<ReviewItem[]>,
): Promise<number> {
  if (role === "internal") {
    const pending = await getReviews({ status: "pending_review" });
    return pending.length;
  }
  const mine = await getReviews({ userId });
  return reviewNavBadgeCount(mine, "external");
}
