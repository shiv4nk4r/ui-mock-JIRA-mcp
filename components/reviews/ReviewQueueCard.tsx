"use client";

import Link from "next/link";
import type { ReviewItem } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { relativeTime } from "@lib/utils/review-ui";
import { ReviewStatusChip } from "@/components/reviews/ReviewStatusChip";

function MockThumb({ html }: { html: string }) {
  return (
    <div
      className="shrink-0 overflow-hidden border"
      style={{ width: 88, height: 64, borderRadius: RADIUS.sm, borderColor: COLORS.border, background: "#fff" }}
    >
      <iframe
        srcDoc={html}
        sandbox="allow-scripts"
        title="Preview"
        className="w-[200%] h-[200%] origin-top-left pointer-events-none"
        style={{ transform: "scale(0.5)", border: "none" }}
      />
    </div>
  );
}

export function ReviewQueueCard({ review }: { review: ReviewItem }) {
  return (
    <Link
      href={`/reviews/${review.id}`}
      className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50/90"
      style={{ background: COLORS.surface }}
    >
      <MockThumb html={review.activeHtml} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ ...F.mono, fontSize: 13, fontWeight: 600, color: COLORS.accent }}>{review.ticketId}</span>
          <ReviewStatusChip status={review.status} />
        </div>
        <p className="truncate" style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>
          {review.ticketSummary}
        </p>
        <div className="flex items-center gap-2 flex-wrap" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
          <span
            className="inline-flex items-center justify-center w-6 h-6 text-xs font-semibold"
            style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: "50%" }}
          >
            {review.userName.charAt(0)}
          </span>
          <span>{review.userName}</span>
          <span>·</span>
          <span>{relativeTime(review.submittedAt)}</span>
        </div>
      </div>
      <span className="shrink-0 text-lg" style={{ color: COLORS.muted }}>›</span>
    </Link>
  );
}
