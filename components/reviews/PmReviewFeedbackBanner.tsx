"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { repository } from "@lib/storage";
import type { Comment, ReviewItem } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

export function PmReviewFeedbackBanner({
  ticketId,
  userId,
}: {
  ticketId: string;
  userId: string;
}) {
  const [review, setReview] = useState<ReviewItem | null>(null);
  const [latestComment, setLatestComment] = useState<Comment | null>(null);

  useEffect(() => {
    (async () => {
      const reviews = await repository.getReviews({ userId });
      const match = reviews
        .filter((r) => r.ticketId === ticketId)
        .sort((a, b) => (b.reviewedAt ?? b.submittedAt) - (a.reviewedAt ?? a.submittedAt))[0];
      if (!match || (match.status !== "needs_changes" && match.status !== "approved")) return;
      setReview(match);
      const comments = await repository.getComments(match.id);
      const engineerComments = comments.filter((c) => c.authorId?.includes("internal"));
      setLatestComment(engineerComments[engineerComments.length - 1] ?? null);
    })();
  }, [ticketId, userId]);

  if (!review) return null;

  const approved = review.status === "approved";

  return (
    <div
      className="p-4 space-y-2"
      style={{
        background: approved ? "rgba(52,199,89,0.08)" : "rgba(255,59,48,0.06)",
        borderRadius: RADIUS.lg,
        border: `1px solid ${approved ? "rgba(52,199,89,0.25)" : "rgba(255,59,48,0.2)"}`,
      }}
    >
      <p style={{ ...F.body, fontSize: 14, fontWeight: 600, color: approved ? "#248A3D" : "#FF3B30" }}>
        {approved ? "✓ GCC approved this mockup" : "GCC requested changes"}
      </p>
      {latestComment && (
        <p style={{ ...F.body, fontSize: 14, color: COLORS.text, lineHeight: 1.5 }}>
          “{latestComment.text}”
        </p>
      )}
      {!approved && (
        <Link
          href={`/workspace/${encodeURIComponent(ticketId)}`}
          className="inline-block text-sm font-semibold hover:underline"
          style={{ ...F.body, color: COLORS.accent }}
        >
          Refine mockup →
        </Link>
      )}
    </div>
  );
}
