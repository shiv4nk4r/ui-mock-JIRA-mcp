"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository, generateId } from "@lib/storage";
import type { MockupSession, ReviewItem, UserEngagement } from "@lib/types";
import { buildExecutionDetails } from "@lib/utils/execution-details";
import { relativeTime } from "@lib/utils/review-ui";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { ExecutionDetailsPanel } from "@/components/reviews/ExecutionDetailsPanel";
import { PmReviewDetailView } from "@/components/reviews/PmReviewDetailView";
import { ReviewActionBar } from "@/components/reviews/ReviewActionBar";
import { ReviewCommunicationPanel } from "@/components/reviews/ReviewCommunicationPanel";
import { ReviewStatusChip } from "@/components/reviews/ReviewStatusChip";

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
  const [engagement, setEngagement] = useState<UserEngagement[]>([]);
  const [busy, setBusy] = useState(false);
  const [planOpen, setPlanOpen] = useState(true);
  const [threadKey, setThreadKey] = useState(0);

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
    setEngagement(await repository.getEngagement({ sessionId: r.sessionId, ticketId: r.ticketId }));
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

  async function addComment(text: string) {
    if (!user || !review) return;
    await repository.addComment({
      id: generateId(),
      targetId: review.id,
      authorName: user.name,
      authorId: user.id,
      text,
      createdAt: Date.now(),
    });
  }

  async function finalize(status: ReviewItem["status"], message?: string) {
    if (!review || !user) return;
    setBusy(true);
    try {
      if (message) await addComment(message);
      else if (status === "approved") {
        await addComment("Approved for implementation — engineering can proceed with the build plan.");
      }
      await repository.updateReview(review.id, {
        status,
        reviewedAt: Date.now(),
        internalNotes: message,
      });
      const saved = await repository.getSession(review.userId, review.ticketId);
      if (saved) {
        await repository.saveSession({
          ...saved,
          status:
            status === "approved" || status === "reviewed"
              ? "reviewed"
              : status === "needs_changes"
                ? "needs_changes"
                : saved.status,
        });
      }
      router.push("/reviews");
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
        engagement={engagement}
        onRefresh={load}
        threadKey={threadKey}
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
    <div className="min-h-screen flex flex-col" style={{ background: COLORS.bg }}>
      <header
        className="flex-none px-6 py-4 border-b"
        style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(12px)", borderColor: COLORS.border }}
      >
        <div className="max-w-7xl mx-auto flex items-center gap-4 flex-wrap">
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
          <div className="text-right shrink-0" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
            <div className="flex items-center gap-2 justify-end">
              <span
                className="w-7 h-7 flex items-center justify-center text-xs font-semibold"
                style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: "50%" }}
              >
                {review.userName.charAt(0)}
              </span>
              <span>{review.userName}</span>
            </div>
            <p>{relativeTime(review.submittedAt)}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        <div
          className="grid grid-cols-1 lg:grid-cols-5 overflow-hidden min-h-[520px]"
          style={{ borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}
        >
          <div className="lg:col-span-3 min-h-[400px] lg:min-h-[560px] bg-white border-b lg:border-b-0 lg:border-r" style={{ borderColor: COLORS.border }}>
            <iframe
              srcDoc={review.activeHtml}
              sandbox="allow-scripts"
              className="w-full h-full min-h-[400px] lg:min-h-[560px]"
              style={{ border: "none" }}
              title="Review mockup"
            />
          </div>
          <div className="lg:col-span-2 flex flex-col min-h-[420px] lg:min-h-[560px]">
            <ReviewCommunicationPanel
              review={review}
              session={session}
              engagement={engagement}
              onCommentAdded={load}
              refreshKey={threadKey}
            />
          </div>
        </div>

        {review.status === "pending_review" && (
          <ReviewActionBar
            review={review}
            busy={busy}
            onApprove={(note) => finalize("approved", note)}
            onRequestChanges={(msg) => finalize("needs_changes", msg)}
          />
        )}

        <div>
          <button
            type="button"
            onClick={() => setPlanOpen((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-left"
            style={{
              background: COLORS.surface,
              borderRadius: planOpen ? `${RADIUS.lg}px ${RADIUS.lg}px 0 0` : RADIUS.lg,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div>
              <span style={{ ...F.body, fontSize: 17, fontWeight: 600, color: COLORS.text }}>Implementation plan</span>
              <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
                Execution breakdown and AI agent prompt
              </p>
            </div>
            <span style={{ ...F.body, fontSize: 18, color: COLORS.muted }}>{planOpen ? "−" : "+"}</span>
          </button>
          {planOpen && (
            <div className="border border-t-0 overflow-hidden" style={{ borderColor: COLORS.border, borderRadius: `0 0 ${RADIUS.lg}px ${RADIUS.lg}px` }}>
              <ExecutionDetailsPanel
                review={review}
                session={session}
                details={executionDetails}
                effortMarkdown={latestEffortMarkdown(session)}
                embedded
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
