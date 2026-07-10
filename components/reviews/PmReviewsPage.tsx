"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { Comment, ReviewItem } from "@lib/types";
import { getMockUser } from "@lib/auth/mock-users";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { PmReviewCard } from "@/components/reviews/PmReviewCard";

type PmTab = "action" | "pending" | "done";

export function PmReviewsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<PmTab>("action");
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [comments, setComments] = useState<Record<string, Comment | null>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const list = await repository.getReviews({ userId: user.id });
      setReviews(list.sort((a, b) => b.submittedAt - a.submittedAt));
      const map: Record<string, Comment | null> = {};
      for (const r of list.filter((x) => x.status === "needs_changes")) {
        const thread = await repository.getComments(r.id);
        const fromEng = [...thread].reverse().find((c) => getMockUser(c.authorId ?? "")?.role === "internal");
        map[r.id] = fromEng ?? null;
      }
      setComments(map);
    })();
  }, [user]);

  const action = reviews.filter((r) => r.status === "needs_changes");
  const pending = reviews.filter((r) => r.status === "pending_review");
  const done = reviews.filter((r) => r.status === "approved" || r.status === "reviewed");

  const visible = tab === "action" ? action : tab === "pending" ? pending : done;

  const tabs: { id: PmTab; label: string; count: number }[] = [
    { id: "action", label: "Action needed", count: action.length },
    { id: "pending", label: "In review", count: pending.length },
    { id: "done", label: "Approved", count: done.length },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 sm:py-14 space-y-8">
      <div className="space-y-1">
        <h1 style={{ ...F.body, fontSize: 32, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.03em" }}>
          Reviews
        </h1>
        <p style={{ ...F.body, fontSize: 16, color: COLORS.muted }}>
          Track mockups you sent for engineering review
        </p>
      </div>

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
                  background: t.id === "action" ? COLORS.accent : COLORS.border,
                  color: t.id === "action" ? "#fff" : COLORS.muted,
                  borderRadius: RADIUS.pill,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div
          className="py-16 text-center px-6 space-y-3"
          style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
        >
          <p style={{ ...F.body, fontSize: 17, fontWeight: 600, color: COLORS.text }}>No reviews yet</p>
          <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
            Send a mockup for review from the workspace when it&apos;s ready
          </p>
          <Link href="/dashboard" className="inline-block text-sm font-semibold hover:underline" style={{ color: COLORS.accent }}>
            Go to Home
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div
          className="py-12 text-center px-6"
          style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
        >
          <p style={{ ...F.body, fontSize: 15, color: COLORS.muted }}>Nothing in this tab right now</p>
        </div>
      ) : (
        <div
          className="overflow-hidden divide-y"
          style={{ borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}
        >
          {visible.map((r) => (
            <PmReviewCard key={r.id} review={r} latestComment={comments[r.id]} />
          ))}
        </div>
      )}
    </div>
  );
}
