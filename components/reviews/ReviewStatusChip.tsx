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
  pending_review: { color: "#B45309", bg: "rgba(217,119,6,0.1)" },
  approved: { color: "#248A3D", bg: "rgba(52,199,89,0.1)" },
  needs_changes: { color: "#C62828", bg: "rgba(255,59,48,0.08)" },
  reviewed: { color: "#1D6FA5", bg: "rgba(41,130,204,0.1)" },
  withdrawn: { color: COLORS.muted, bg: COLORS.subtle },
};

export function ReviewStatusChip({
  status,
  compact = false,
}: {
  status: ReviewStatus;
  compact?: boolean;
}) {
  const c = REVIEW_COLORS[status] ?? SESSION_STATUS_COLORS.in_progress;
  const label = REVIEW_LABELS[status] ?? SESSION_STATUS_LABELS[status] ?? status;
  return (
    <span
      style={{
        ...F.body,
        fontSize: compact ? 11 : 12,
        fontWeight: 520,
        color: c.color,
        background: c.bg,
        padding: compact ? "2px 8px" : "4px 12px",
        borderRadius: RADIUS.pill,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
