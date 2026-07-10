"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { ReviewItem } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { FeatureRequestsPanel } from "@/components/feedback/FeatureRequestsPanel";
import { ReviewQueueCard } from "@/components/reviews/ReviewQueueCard";

type QueueTab = "pending" | "changes" | "done";

export default function ReviewsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<QueueTab>("pending");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);

  useEffect(() => {
    if (user?.role !== "internal") {
      router.replace("/dashboard");
      return;
    }
    repository.getReviews().then(setReviews);
  }, [user, router]);

  if (user?.role !== "internal") return null;

  const pending = reviews.filter((r) => r.status === "pending_review");
  const changes = reviews.filter((r) => r.status === "needs_changes");
  const done = reviews.filter((r) => r.status === "approved" || r.status === "reviewed");

  const visible =
    tab === "pending" ? pending : tab === "changes" ? changes : done;

  const tabs: { id: QueueTab; label: string; count: number }[] = [
    { id: "pending", label: "Awaiting review", count: pending.length },
    { id: "changes", label: "Changes requested", count: changes.length },
    { id: "done", label: "Completed", count: done.length },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 sm:py-14 space-y-8">
      <div className="space-y-1">
        <h1 style={{ ...F.body, fontSize: 32, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.03em" }}>
          Reviews
        </h1>
        <p style={{ ...F.body, fontSize: 16, color: COLORS.muted }}>
          Mockups from PMs — review, reply, and approve for build
        </p>
      </div>

      <FeatureRequestsPanel compact />

      <div
        className="flex gap-1 p-1 overflow-x-auto"
        style={{ background: COLORS.subtle, borderRadius: RADIUS.pill }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors"
            style={{
              borderRadius: RADIUS.pill,
              background: tab === t.id ? COLORS.surface : "transparent",
              color: tab === t.id ? COLORS.text : COLORS.muted,
              boxShadow: tab === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              ...F.body,
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold"
                style={{
                  background: t.id === "pending" && t.count > 0 ? COLORS.accent : COLORS.border,
                  color: t.id === "pending" && t.count > 0 ? "#fff" : COLORS.muted,
                  borderRadius: RADIUS.pill,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div
          className="py-16 text-center px-6"
          style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
        >
          <p style={{ ...F.body, fontSize: 17, fontWeight: 600, color: COLORS.text }}>
            {tab === "pending" ? "All caught up" : tab === "changes" ? "No open change requests" : "No completed reviews yet"}
          </p>
          <p className="mt-2" style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
            {tab === "pending"
              ? "New mockups will appear here when PMs send them for review"
              : "Completed reviews and approvals show in this tab"}
          </p>
          {tab !== "pending" && pending.length > 0 && (
            <button
              type="button"
              onClick={() => setTab("pending")}
              className="mt-4 text-sm font-semibold hover:underline"
              style={{ ...F.body, color: COLORS.accent }}
            >
              View {pending.length} pending
            </button>
          )}
        </div>
      ) : (
        <div
          className="overflow-hidden divide-y"
          style={{ borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}
        >
          {visible.map((r) => (
            <ReviewQueueCard key={r.id} review={r} />
          ))}
        </div>
      )}
    </div>
  );
}
