"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@lib/auth/auth-context";
import { submitOrResubmitReview, retractReview } from "@lib/utils/review-workflow";
import type { MockupSession, ReviewItem } from "@lib/types";
import { buildRevisions } from "@lib/utils/session-history";
import { sumUsageRecords } from "@lib/utils/usage-cost";
import { downloadHtmlFile } from "@lib/utils/files";
import { DownloadIcon } from "@/components/shared/DownloadIcon";
import { MockCostBreakdownModal, MockCostBadge } from "@/components/workspace/MockCostBreakdownModal";
import { RetractReviewModal } from "@/components/workspace/RetractReviewModal";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { relativeTime } from "@lib/utils/review-ui";
import { ReviewCommunicationPanel } from "@/components/reviews/ReviewCommunicationPanel";
import { ReviewChannelDrawer, ReviewChannelChatIcon } from "@/components/reviews/ReviewChannelDrawer";
import { ReviewMockPreview } from "@/components/reviews/ReviewMockPreview";
import { ReviewStatusChip } from "@/components/reviews/ReviewStatusChip";
import { MockupFullscreenOverlay } from "@/components/shared/MockupFullscreenOverlay";
import { IconButton, Toast } from "@/components/shared/Toast";

interface Props {
  review: ReviewItem;
  session: MockupSession | null;
  onRefresh: () => void;
  threadKey: number;
  commentCount?: number;
}

export function PmReviewDetailView({ review, session, onRefresh, threadKey, commentCount = 0 }: Props) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [mockFullscreen, setMockFullscreen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [retractModalOpen, setRetractModalOpen] = useState(false);
  const [retractingReview, setRetractingReview] = useState(false);

  const needsChanges = review.status === "needs_changes";
  const pendingReview = review.status === "pending_review";
  const canResubmit = needsChanges && !!session?.activeHtml;
  const previewHtml = session?.activeHtml || review.activeHtml;
  const revisions = useMemo(
    () => (session && user ? buildRevisions(session, user.role) : []),
    [session, user],
  );
  const usageRecords = session?.usageRecords ?? [];
  const usageTotals = useMemo(() => sumUsageRecords(usageRecords), [usageRecords]);
  const showCost = usageRecords.length > 0 || revisions.some((r) => r.usage);

  async function handleRetractReview() {
    if (!user) return;
    setRetractingReview(true);
    try {
      await retractReview({ review, user });
      setToast("Mockup retracted — continue refining in the workspace");
      setRetractModalOpen(false);
      onRefresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not retract review");
    } finally {
      setRetractingReview(false);
    }
  }

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
        session,
      });
      setToast("Mockup resubmitted — engineering will review the update");
      setChannelOpen(true);
      onRefresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not resubmit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: COLORS.bg }}>
      <Toast message={toast} onDone={() => setToast(null)} />

      <header
        className="relative z-50 flex-none px-4 py-3 border-b"
        style={{ background: "rgba(255,255,255,0.92)", backdropFilter: "blur(12px)", borderColor: COLORS.border }}
      >
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/reviews" style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>← Channels</Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="truncate" style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text }}>
                {review.ticketSummary}
              </p>
              <ReviewStatusChip status={review.status} />
            </div>
            <p style={{ ...F.mono, fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{review.ticketId}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {showCost && (
              <MockCostBadge costUsd={usageTotals.costUsd} onClick={() => setCostOpen(true)} />
            )}
            <IconButton
              label="Download mockup as HTML"
              onClick={() => downloadHtmlFile(previewHtml, `${review.ticketId}.html`)}
              disabled={!previewHtml}
            >
              <DownloadIcon />
            </IconButton>
            <IconButton
              label="Full screen"
              onClick={() => setMockFullscreen(true)}
              disabled={!previewHtml}
            >
              ⛶
            </IconButton>
            <div className="relative">
              <IconButton
                label={channelOpen ? "Close review channel" : "Open review channel"}
                onClick={() => setChannelOpen((v) => !v)}
                primary={channelOpen}
              >
                {channelOpen ? "×" : <ReviewChannelChatIcon />}
              </IconButton>
              {!channelOpen && commentCount > 0 && (
                <span
                  className="pointer-events-none absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold"
                  style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill, border: `2px solid ${COLORS.surface}` }}
                >
                  {commentCount > 9 ? "9+" : commentCount}
                </span>
              )}
            </div>
            <p style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>{relativeTime(review.submittedAt)}</p>
          </div>
        </div>
      </header>

      {pendingReview && (
        <div
          className="flex-none flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-4 py-3 border-b"
          style={{ background: "rgba(249,177,21,0.08)", borderColor: "rgba(249,177,21,0.2)" }}
        >
          <p className="flex-1 text-sm" style={{ ...F.body, color: COLORS.text }}>
            This mockup is awaiting engineering review. Retract it if you want more time to refine before they review.
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
              disabled={retractingReview}
              onClick={() => setRetractModalOpen(true)}
              className="px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ background: COLORS.text, color: "#fff", borderRadius: RADIUS.pill }}
            >
              Retract from review
            </button>
          </div>
        </div>
      )}

      {needsChanges && (
        <div
          className="flex-none flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-4 py-3 border-b"
          style={{ background: "rgba(255,149,0,0.08)", borderColor: "rgba(255,149,0,0.2)" }}
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

      <ReviewMockPreview
        html={previewHtml}
        title="Mockup"
        annotationTargetId={review.id}
        onAnnotationsChange={onRefresh}
      />

      {!mockFullscreen && (
        <ReviewChannelDrawer open={channelOpen} onOpenChange={setChannelOpen} messageCount={commentCount} showFab={false}>
          <ReviewCommunicationPanel
            review={review}
            session={session}
            onCommentAdded={onRefresh}
            refreshKey={threadKey}
            onClose={() => setChannelOpen(false)}
          />
        </ReviewChannelDrawer>
      )}

      <MockupFullscreenOverlay
        open={mockFullscreen}
        onClose={() => setMockFullscreen(false)}
        html={previewHtml}
        title={review.ticketSummary}
        subtitle={review.ticketId}
        downloadFilename={`${review.ticketId}.html`}
      />

      <RetractReviewModal
        open={retractModalOpen}
        busy={retractingReview}
        onCancel={() => setRetractModalOpen(false)}
        onConfirm={handleRetractReview}
      />

      <MockCostBreakdownModal
        open={costOpen}
        onClose={() => setCostOpen(false)}
        records={usageRecords}
        revisions={revisions}
        ticketLabel={review.ticketId}
      />
    </div>
  );
}
