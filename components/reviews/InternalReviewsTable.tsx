import type { ReviewStatus } from "@lib/types";

/** Shared helper used by list rows and review detail. */
export function isBuildableReviewStatus(status: ReviewStatus): boolean {
  return status === "approved" || status === "reviewed";
}
