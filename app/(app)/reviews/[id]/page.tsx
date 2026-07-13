"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { MockupSession, ReviewItem } from "@lib/types";
import { buildExecutionDetails } from "@lib/utils/execution-details";
import { finalizeReview } from "@lib/utils/review-workflow";
import { relativeTime } from "@lib/utils/review-ui";
import { buildRevisions } from "@lib/utils/session-history";
import { sumUsageRecords } from "@lib/utils/usage-cost";
import { MockCostBreakdownModal, MockCostBadge } from "@/components/workspace/MockCostBreakdownModal";
import { downloadHtmlFile } from "@lib/utils/files";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { ImplementationPlanModal, ImplementationPlanIcon } from "@/components/reviews/ImplementationPlanModal";
import { PmReviewDetailView } from "@/components/reviews/PmReviewDetailView";
import { ReviewDecisionFab } from "@/components/reviews/ReviewDecisionFab";
import { ReviewHandoffPanel } from "@/components/reviews/ReviewHandoffPanel";
import { ReviewCommunicationPanel } from "@/components/reviews/ReviewCommunicationPanel";
import { ReviewChannelDrawer, ReviewChannelChatIcon } from "@/components/reviews/ReviewChannelDrawer";
import { ReviewMockPreview } from "@/components/reviews/ReviewMockPreview";
import { ReviewStatusChip } from "@/components/reviews/ReviewStatusChip";
import { MockupFullscreenOverlay } from "@/components/shared/MockupFullscreenOverlay";
import { DownloadIcon } from "@/components/shared/DownloadIcon";
import { IconButton } from "@/components/shared/Toast";

function latestEffortMarkdown(session: MockupSession | null): string | undefined {
  if (!session) return undefined;
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const m = session.messages[i];
    if (m.role === "assistant" && m.effortEstimation) return m.effortEstimation;
  }
  return undefined;
}

export default function ReviewDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const [review, setReview] = useState<ReviewItem | null>(null);
  const [session, setSession] = useState<MockupSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [threadKey, setThreadKey] = useState(0);
  const [mockFullscreen, setMockFullscreen] = useState(false);
  const [channelOpen, setChannelOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [costOpen, setCostOpen] = useState(false);

  async function load() {
    const r = await repository.getReview(params.id);
    if (!r) {
      setReview(null);
      return;
    }
    if (user && user.role === "external" && r.userId !== user.id) {
      router.replace("/reviews");
      return;
    }
    setReview(r);
    const s = await repository.getSession(r.userId, r.ticketId);
    setSession(s);
    const comments = await repository.getComments(r.id);
    setCommentCount(comments.length);
    setThreadKey((k) => k + 1);
  }

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, params.id, router]);

  const executionDetails = useMemo(
    () => (review ? buildExecutionDetails(review, session) : null),
    [review, session],
  );

  const previewHtml = session?.activeHtml || review?.activeHtml || "";

  const revisions = useMemo(
    () => (session && user ? buildRevisions(session, user.role) : []),
    [session, user],
  );
  const usageRecords = session?.usageRecords ?? [];
  const usageTotals = useMemo(() => sumUsageRecords(usageRecords), [usageRecords]);
  const showCost = usageRecords.length > 0 || revisions.some((r) => r.usage);

  async function finalize(status: "approved" | "needs_changes", message?: string) {
    if (!review || !user) return;
    setBusy(true);
    try {
      await finalizeReview({ review, user, status, message });
      setChannelOpen(true);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!review) {
    return (
      <div className="py-20 flex justify-center" style={{ background: COLORS.bg }}>
        <div className="signal-bars"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  if (user?.role === "external") {
    return (
      <PmReviewDetailView
        review={review}
        session={session}
        onRefresh={load}
        threadKey={threadKey}
        commentCount={commentCount}
      />
    );
  }

  if (!executionDetails) {
    return (
      <div className="py-20 flex justify-center" style={{ background: COLORS.bg }}>
        <div className="signal-bars"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: COLORS.bg }}>
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
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
            <IconButton
              label={planOpen ? "Close implementation plan" : "Open implementation plan"}
              onClick={() => setPlanOpen((v) => !v)}
              primary={planOpen}
            >
              {planOpen ? "×" : <ImplementationPlanIcon />}
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
            <span
              className="w-7 h-7 flex items-center justify-center text-xs font-semibold"
              style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: "50%" }}
            >
              {review.userName.charAt(0)}
            </span>
            <span style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>{relativeTime(review.submittedAt)}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="lg:hidden">
            <ReviewHandoffPanel
              variant="strip"
              details={executionDetails}
              effortMarkdown={latestEffortMarkdown(session)}
              onOpenFullPlan={() => setPlanOpen(true)}
            />
          </div>
          <ReviewMockPreview
            html={previewHtml}
            title="Review mockup"
            annotationTargetId={review.id}
            onAnnotationsChange={load}
            className="flex-1 min-h-0"
          />
        </div>
        <div className="hidden lg:flex">
          <ReviewHandoffPanel
            details={executionDetails}
            effortMarkdown={latestEffortMarkdown(session)}
            onOpenFullPlan={() => setPlanOpen(true)}
          />
        </div>
      </div>

      {review.status === "pending_review" && !mockFullscreen && (
        <ReviewDecisionFab
          busy={busy}
          channelOpen={channelOpen}
          onApprove={(note) => finalize("approved", note)}
          onRequestChanges={(msg) => finalize("needs_changes", msg)}
        />
      )}

      <ImplementationPlanModal
        open={planOpen}
        onClose={() => setPlanOpen(false)}
        review={review}
        session={session}
        details={executionDetails}
        effortMarkdown={latestEffortMarkdown(session)}
      />

      {!mockFullscreen && (
        <ReviewChannelDrawer open={channelOpen} onOpenChange={setChannelOpen} messageCount={commentCount} showFab={false}>
          <ReviewCommunicationPanel
            review={review}
            session={session}
            onCommentAdded={load}
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
