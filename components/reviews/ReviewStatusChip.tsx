import { F, RADIUS, SESSION_STATUS_COLORS, SESSION_STATUS_LABELS, COLORS } from "@lib/design/tokens";
import type { ReviewStatus } from "@lib/types";

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  pending_review: "Awaiting review",
  approved: "Approved",
  needs_changes: "Changes requested",
  reviewed: "Reviewed",
  withdrawn: "Withdrawn",
};

const REVIEW_COLORS: Record<ReviewStatus, { color: string; bg: string }> = {
  pending_review: { color: "#f9b115", bg: "rgba(249,177,21,0.12)" },
  approved: { color: "#34C759", bg: "rgba(52,199,89,0.12)" },
  needs_changes: { color: "#FF3B30", bg: "rgba(255,59,48,0.1)" },
  reviewed: { color: "#2982cc", bg: "rgba(41,130,204,0.1)" },
  withdrawn: { color: COLORS.muted, bg: COLORS.subtle },
};

export function ReviewStatusChip({ status }: { status: ReviewStatus }) {
  const c = REVIEW_COLORS[status] ?? SESSION_STATUS_COLORS.in_progress;
  const label = REVIEW_LABELS[status] ?? SESSION_STATUS_LABELS[status] ?? status;
  return (
    <span
      style={{
        ...F.body,
        fontSize: 12,
        fontWeight: 600,
        color: c.color,
        background: c.bg,
        padding: "4px 12px",
        borderRadius: RADIUS.pill,
      }}
    >
      {label}
    </span>
  );
}
