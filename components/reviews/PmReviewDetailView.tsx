"use client";

import Link from "next/link";
import type { MockupSession, ReviewItem, UserEngagement } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { relativeTime } from "@lib/utils/review-ui";
import { ReviewCommunicationPanel } from "@/components/reviews/ReviewCommunicationPanel";
import { ReviewStatusChip } from "@/components/reviews/ReviewStatusChip";

interface Props {
  review: ReviewItem;
  session: MockupSession | null;
  engagement: UserEngagement[];
  onRefresh: () => void;
  threadKey: number;
}

export function PmReviewDetailView({ review, session, engagement, onRefresh, threadKey }: Props) {
  const needsChanges = review.status === "needs_changes";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: COLORS.bg }}>
      <header
        className="flex-none px-6 py-4 border-b"
        style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderColor: COLORS.border }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-4 flex-wrap">
          <Link href="/reviews" style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>← Reviews</Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ ...F.mono, fontSize: 14, fontWeight: 600, color: COLORS.accent }}>{review.ticketId}</span>
              <ReviewStatusChip status={review.status} />
            </div>
            <p className="truncate" style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>
              {review.ticketSummary}
            </p>
          </div>
          <p style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>{relativeTime(review.submittedAt)}</p>
        </div>
      </header>

      <div className="flex-1 max-w-3xl w-full mx-auto px-6 py-6 space-y-6">
        {needsChanges && (
          <Link
            href={`/workspace/${encodeURIComponent(review.ticketId)}`}
            className="block text-center py-3 text-sm font-semibold"
            style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
          >
            Open workspace to refine
          </Link>
        )}

        <div
          className="overflow-hidden border"
          style={{ borderColor: COLORS.border, borderRadius: RADIUS.lg, minHeight: 360, background: "#fff" }}
        >
          <iframe
            srcDoc={review.activeHtml}
            sandbox="allow-scripts"
            className="w-full"
            style={{ minHeight: 360, border: "none" }}
            title="Mockup"
          />
        </div>

        <div
          className="overflow-hidden flex flex-col min-h-[400px]"
          style={{ borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}
        >
          <ReviewCommunicationPanel
            review={review}
            session={session}
            engagement={engagement}
            onCommentAdded={onRefresh}
            refreshKey={threadKey}
          />
        </div>
      </div>
    </div>
  );
}
