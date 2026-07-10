"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@lib/auth/auth-context";
import { submitOrResubmitReview } from "@lib/utils/review-workflow";
import type { MockupSession, ReviewItem } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { relativeTime } from "@lib/utils/review-ui";
import { ReviewCommunicationPanel } from "@/components/reviews/ReviewCommunicationPanel";
import { ReviewStatusChip } from "@/components/reviews/ReviewStatusChip";
import { MockupIframe } from "@/components/shared/MockupIframe";
import { MockupFullscreenOverlay } from "@/components/shared/MockupFullscreenOverlay";
import { IconButton, Toast } from "@/components/shared/Toast";

interface Props {
  review: ReviewItem;
  session: MockupSession | null;
  onRefresh: () => void;
  threadKey: number;
}

export function PmReviewDetailView({ review, session, onRefresh, threadKey }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mockFullscreen, setMockFullscreen] = useState(false);

  const needsChanges = review.status === "needs_changes";
  const canResubmit = needsChanges && !!session?.activeHtml;
  const previewHtml = session?.activeHtml || review.activeHtml;

  async function handleResubmit() {
    if (!user || !session?.activeHtml) return;
    setBusy(true);
    try {
      await submitOrResubmitReview({
        user,
        sessionId: session.id,
        ticketId: review.ticketId,
        ticketSummary: review.ticketSummary,
        activeHtml: session.activeHtml,
      });
      setToast("Mockup resubmitted — engineering will review the update");
      onRefresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not resubmit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: COLORS.bg }}>
      <Toast message={toast} onDone={() => setToast(null)} />

      <header
        className="flex-none px-6 py-4 border-b"
        style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderColor: COLORS.border }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-4 flex-wrap">
          <Link href="/reviews" style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>← Channels</Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="truncate" style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>
                {review.ticketSummary}
              </p>
              <ReviewStatusChip status={review.status} />
            </div>
            <p style={{ ...F.mono, fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{review.ticketId}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <IconButton
              label="Full screen"
              onClick={() => setMockFullscreen(true)}
              disabled={!previewHtml}
            >
              ⛶
            </IconButton>
            <p style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>{relativeTime(review.submittedAt)}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-4">
        {needsChanges && (
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4"
            style={{ background: "rgba(255,149,0,0.08)", borderRadius: RADIUS.lg, border: `1px solid rgba(255,149,0,0.2)` }}
          >
            <p className="flex-1 text-sm" style={{ ...F.body, color: COLORS.text }}>
              Engineering requested changes. Refine in the workspace, then resubmit to continue the thread.
            </p>
            <div className="flex gap-2 shrink-0">
              <Link
                href={`/workspace/${encodeURIComponent(review.ticketId)}`}
                className="px-4 py-2 text-sm font-semibold text-center"
                style={{ background: COLORS.surface, color: COLORS.text, borderRadius: RADIUS.pill, border: `1px solid ${COLORS.border}` }}
              >
                Open workspace
              </Link>
              <button
                type="button"
                disabled={!canResubmit || busy}
                onClick={handleResubmit}
                className="px-4 py-2 text-sm font-semibold disabled:opacity-50"
                style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
              >
                {busy ? "Sending…" : "Resubmit mockup"}
              </button>
            </div>
          </div>
        )}

        <div
          className="grid grid-cols-1 lg:grid-cols-5 overflow-hidden min-h-[520px]"
          style={{ borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}
        >
          <div className="lg:col-span-3 min-h-[360px] lg:min-h-[560px] bg-white border-b lg:border-b-0 lg:border-r" style={{ borderColor: COLORS.border }}>
            <MockupIframe
              html={previewHtml}
              className="w-full h-full min-h-[360px] lg:min-h-[560px]"
              title="Mockup"
            />
          </div>
          <div className="lg:col-span-2 flex flex-col min-h-[420px] lg:min-h-[560px]">
            <ReviewCommunicationPanel
              review={review}
              session={session}
              onCommentAdded={onRefresh}
              refreshKey={threadKey}
            />
          </div>
        </div>
      </div>

      <MockupFullscreenOverlay
        open={mockFullscreen}
        onClose={() => setMockFullscreen(false)}
        html={previewHtml}
        title={review.ticketSummary}
        subtitle={review.ticketId}
      />
    </div>
  );
}
