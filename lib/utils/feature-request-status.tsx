import { F, COLORS, RADIUS } from "@lib/design/tokens";
import type { FeatureRequestStatus } from "@lib/types";

export const FEATURE_REQUEST_STATUSES: FeatureRequestStatus[] = [
  "submitted",
  "under_review",
  "planned",
  "in_progress",
  "shipped",
  "declined",
];

export const FEATURE_REQUEST_LABELS: Record<FeatureRequestStatus, string> = {
  submitted: "Submitted",
  under_review: "Under review",
  planned: "Planned",
  in_progress: "In progress",
  shipped: "Shipped",
  declined: "Declined",
};

export const FEATURE_REQUEST_COLORS: Record<FeatureRequestStatus, { color: string; bg: string }> = {
  submitted: { color: "#f9b115", bg: "rgba(249,177,21,0.12)" },
  under_review: { color: "#2982cc", bg: "rgba(41,130,204,0.12)" },
  planned: { color: "#AF52DE", bg: "rgba(175,82,222,0.12)" },
  in_progress: { color: COLORS.accent, bg: "rgba(217,119,6,0.12)" },
  shipped: { color: "#34C759", bg: "rgba(52,199,89,0.12)" },
  declined: { color: "#FF3B30", bg: "rgba(255,59,48,0.1)" },
};

export function normalizeFeatureRequestStatus(status?: FeatureRequestStatus): FeatureRequestStatus {
  return status ?? "submitted";
}

export function FeatureRequestStatusChip({ status }: { status?: FeatureRequestStatus }) {
  const s = normalizeFeatureRequestStatus(status);
  const c = FEATURE_REQUEST_COLORS[s];
  return (
    <span
      style={{
        ...F.body,
        fontSize: 11,
        fontWeight: 600,
        color: c.color,
        background: c.bg,
        padding: "4px 10px",
        borderRadius: RADIUS.pill,
        whiteSpace: "nowrap",
      }}
    >
      {FEATURE_REQUEST_LABELS[s]}
    </span>
  );
}
