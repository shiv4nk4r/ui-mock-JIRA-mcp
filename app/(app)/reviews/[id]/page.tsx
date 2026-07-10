"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { MockupSession, ReviewItem, UserEngagement } from "@lib/types";
import { buildExecutionDetails } from "@lib/utils/execution-details";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { EngagementSummary } from "@/components/feedback/InternalFeedbackWidget";
import { ExecutionDetailsPanel } from "@/components/reviews/ExecutionDetailsPanel";

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
  const [note, setNote] = useState("");

  useEffect(() => {
    if (user?.role !== "internal") {
      router.replace("/dashboard");
      return;
    }
    (async () => {
      const r = await repository.getReview(params.id);
      setReview(r);
      if (r) {
        const s = await repository.getSession(r.userId, r.ticketId);
        setSession(s);
        const eng = await repository.getEngagement({ sessionId: r.sessionId, ticketId: r.ticketId });
        setEngagement(eng);
        setNote(r.internalNotes ?? "");
      }
    })();
  }, [user, params.id, router]);

  const executionDetails = useMemo(
    () => (review ? buildExecutionDetails(review, session) : null),
    [review, session],
  );

  async function updateStatus(status: ReviewItem["status"]) {
    if (!review) return;
    await repository.updateReview(review.id, {
      status,
      reviewedAt: Date.now(),
      internalNotes: note.trim() || undefined,
    });
    const saved = await repository.getSession(review.userId, review.ticketId);
    if (saved) {
      await repository.saveSession({
        ...saved,
        status: status === "approved" || status === "reviewed" ? "reviewed" : status === "needs_changes" ? "needs_changes" : saved.status,
      });
    }
    router.push("/reviews");
  }

  if (!review || !executionDetails) {
    return (
      <div className="py-20 text-center" style={{ ...F.body, color: COLORS.muted }}>Loading review…</div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      <Link href="/reviews" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>← Back to queue</Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ ...F.body, fontSize: 28, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.02em" }}>
            {review.ticketId}
          </h1>
          <p style={{ ...F.body, fontSize: 15, color: COLORS.muted }}>{review.ticketSummary}</p>
          <p className="mt-2" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
            Submitted by {review.userName} · {new Date(review.submittedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ActionButton label="Approve" onClick={() => updateStatus("approved")} variant="success" />
          <ActionButton label="Needs changes" onClick={() => updateStatus("needs_changes")} variant="outline" />
          <ActionButton label="Mark reviewed" onClick={() => updateStatus("reviewed")} variant="primary" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div
          className="lg:col-span-2 border overflow-hidden"
          style={{ borderColor: COLORS.border, borderRadius: RADIUS.lg, minHeight: 480 }}
        >
          <iframe
            srcDoc={review.activeHtml}
            sandbox="allow-scripts"
            className="w-full h-full bg-white"
            style={{ minHeight: 480, border: "none" }}
            title="Review mockup"
          />
        </div>
        <div className="space-y-4">
          <EngagementSummary items={engagement} />
          <form onSubmit={(e: FormEvent) => e.preventDefault()} className="space-y-2">
            <label style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Internal notes
            </label>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border text-sm outline-none resize-none"
              style={{ borderColor: COLORS.border, borderRadius: RADIUS.sm, ...F.body }}
              placeholder="Notes for the team…"
            />
          </form>
          <Link
            href={`/workspace/${encodeURIComponent(review.ticketId)}`}
            style={{ ...F.body, fontSize: 13, color: COLORS.accent }}
          >
            Open full workspace →
          </Link>
        </div>
      </div>

      <ExecutionDetailsPanel
        review={review}
        session={session}
        details={executionDetails}
        effortMarkdown={latestEffortMarkdown(session)}
      />
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  variant,
}: {
  label: string;
  onClick: () => void;
  variant: "primary" | "success" | "outline";
}) {
  const styles = {
    primary: { background: COLORS.accent, color: "#fff", border: "none" },
    success: { background: "#34C759", color: "#fff", border: "none" },
    outline: { background: COLORS.surface, color: COLORS.text, border: `1px solid ${COLORS.border}` },
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      className="px-4 py-2 text-sm font-semibold"
      style={{ ...styles, borderRadius: RADIUS.pill, ...F.body }}
    >
      {label}
    </button>
  );
}
