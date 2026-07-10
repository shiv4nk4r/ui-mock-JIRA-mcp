"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { ReviewItem } from "@lib/types";
import { F, COLORS } from "@lib/design/tokens";

export default function ReviewsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);

  useEffect(() => {
    if (user?.role !== "internal") {
      router.replace("/dashboard");
      return;
    }
    repository.getReviews({ status: "pending_review" }).then(setReviews);
  }, [user, router]);

  if (user?.role !== "internal") return null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div>
        <h1 style={{ ...F.display, fontSize: 48, color: COLORS.text }}>REVIEW QUEUE</h1>
        <p style={{ ...F.condensed, fontSize: 11, color: COLORS.muted, letterSpacing: "0.2em", textTransform: "uppercase" }}>
          Mockups submitted by external PMs
        </p>
      </div>

      {reviews.length === 0 ? (
        <div className="py-16 text-center border" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
          <span style={{ ...F.display, fontSize: 36, color: "rgba(217,119,6,0.1)" }}>ALL CLEAR</span>
          <p className="mt-2" style={{ ...F.condensed, fontSize: 10, color: "#A8A4A0" }}>No pending reviews</p>
        </div>
      ) : (
        <div className="border overflow-hidden" style={{ borderColor: COLORS.border }}>
          {reviews.map((r) => (
            <Link
              key={r.id}
              href={`/reviews/${r.id}`}
              className="flex items-center gap-4 px-4 py-4 border-b last:border-b-0 hover:bg-amber-50/50"
              style={{ background: COLORS.surface, borderColor: COLORS.border }}
            >
              <span style={{ ...F.mono, fontSize: 12, color: COLORS.accent }}>{r.ticketId}</span>
              <span className="flex-1 truncate" style={{ ...F.body, fontSize: 13 }}>{r.ticketSummary}</span>
              <span style={{ ...F.condensed, fontSize: 10, color: COLORS.muted }}>{r.userName}</span>
              <span style={{ ...F.condensed, fontSize: 10, color: "#A8A4A0" }}>{new Date(r.submittedAt).toLocaleDateString()}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
