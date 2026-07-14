"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@lib/auth/auth-context";
import { submitOrResubmitReview, retractReview } from "@lib/utils/review-workflow";
import type { MockupSession, ReviewItem } from "@lib/types";
import { buildRevisions } from "@lib/utils/session-history";
import { sumUsageRecords } from "@lib/utils/usage-cost";
import { downloadHtmlFile } from "@lib/utils/files";
import { MockCostBreakdownModal } from "@/components/workspace/MockCostBreakdownModal";
import { RetractReviewModal } from "@/components/workspace/RetractReviewModal";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { relativeTime } from "@lib/utils/review-ui";
import { ReviewCommunicationPanel } from "@/components/reviews/ReviewCommunicationPanel";
import { ReviewChannelDrawer, ReviewChannelChatIcon } from "@/components/reviews/ReviewChannelDrawer";
import { ReviewMockPreview } from "@/components/reviews/ReviewMockPreview";
import { ReviewStatusChip } from "@/components/reviews/ReviewStatusChip";
import { ReviewHeaderMoreMenu } from "@/components/reviews/ReviewHeaderMoreMenu";
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
      setToast("Mockup resubmitted — GCC will review the update");
      setChannelOpen(true);
      onRefresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not resubmit");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: COLORS.subtle }}>
      <Toast message={toast} onDone={() => setToast(null)} />

      <header
        className="relative z-50 flex-none flex items-center gap-3 px-4 py-2 shrink-0"
        style={{ background: COLORS.subtle, borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div className="flex-1 min-w-0">
          <div className="truncate" style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text }}>
            {review.ticketSummary}
          </div>
          <div className="flex items-center gap-2 mt-0.5 min-w-0 flex-wrap">
            <span style={{ ...F.mono, fontSize: 12, color: COLORS.muted }}>{review.ticketId}</span>
            <ReviewStatusChip status={review.status} compact />
            <span style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
              {relativeTime(review.submittedAt)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {pendingReview && (
            <IconButton label="Retract from review" onClick={() => setRetractModalOpen(true)}>
              Retract
            </IconButton>
          )}
          {needsChanges && (
            <IconButton
              label="Resubmit for review"
              onClick={handleResubmit}
              disabled={!canResubmit || busy}
              primary
            >
              {busy ? "Sending…" : "Resubmit"}
            </IconButton>
          )}
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
                style={{
                  background: COLORS.accent,
                  color: "#fff",
                  borderRadius: RADIUS.pill,
                  border: `2px solid ${COLORS.subtle}`,
                }}
              >
                {commentCount > 9 ? "9+" : commentCount}
              </span>
            )}
          </div>
          <ReviewHeaderMoreMenu
            onFullscreen={() => setMockFullscreen(true)}
            onDownload={() => downloadHtmlFile(previewHtml, `${review.ticketId}.html`)}
            onCost={() => setCostOpen(true)}
            showCost={showCost}
            costUsd={usageTotals.costUsd}
            fullscreenDisabled={!previewHtml}
            downloadDisabled={!previewHtml}
          />
        </div>
      </header>

      {pendingReview && (
        <div
          className="flex-none flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-4 py-2.5 border-b"
          style={{ background: "rgba(217,119,6,0.06)", borderColor: COLORS.border }}
        >
          <p className="flex-1 text-sm" style={{ ...F.body, color: COLORS.muted }}>
            Awaiting GCC review. Open the workspace to refine, or retract if you need more time.
          </p>
          <Link
            href={`/workspace/${encodeURIComponent(review.ticketId)}`}
            className="px-3.5 py-1.5 text-sm font-medium text-center shrink-0"
            style={{
              background: COLORS.surface,
              color: COLORS.text,
              borderRadius: RADIUS.pill,
              border: `1px solid ${COLORS.border}`,
              ...F.body,
            }}
          >
            Open workspace
          </Link>
        </div>
      )}

      {needsChanges && (
        <div
          className="flex-none flex flex-col sm:flex-row items-stretch sm:items-center gap-3 px-4 py-2.5 border-b"
          style={{ background: "rgba(217,119,6,0.06)", borderColor: COLORS.border }}
        >
          <p className="flex-1 text-sm" style={{ ...F.body, color: COLORS.muted }}>
            GCC requested changes. Refine in the workspace, then resubmit.
          </p>
          <Link
            href={`/workspace/${encodeURIComponent(review.ticketId)}`}
            className="px-3.5 py-1.5 text-sm font-medium text-center shrink-0"
            style={{
              background: COLORS.surface,
              color: COLORS.text,
              borderRadius: RADIUS.pill,
              border: `1px solid ${COLORS.border}`,
              ...F.body,
            }}
          >
            Open workspace
          </Link>
        </div>
      )}

      <ReviewMockPreview
        html={previewHtml}
        title="Mockup"
        annotationTargetId={review.id}
        onAnnotationsChange={onRefresh}
        className="flex-1 min-h-0"
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
