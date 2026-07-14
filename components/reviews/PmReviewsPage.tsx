"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { TicketReviewChannel } from "@lib/utils/review-channels";
import { loadReviewChannels } from "@lib/utils/review-channels";
import { ReviewsListShell, ReviewsTabBar } from "@/components/reviews/ReviewsListShell";

type PmTab = "action" | "pending" | "done";

export function PmReviewsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<PmTab>("action");
  const [channels, setChannels] = useState<TicketReviewChannel[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const list = await repository.getReviews({ userId: user.id });
      setChannels(await loadReviewChannels(list));
    })();
  }, [user]);

  const action = channels.filter((c) => c.review.status === "needs_changes");
  const pending = channels.filter((c) => c.review.status === "pending_review");
  const done = channels.filter(
    (c) => c.review.status === "approved" || c.review.status === "reviewed",
  );

  const visible = tab === "action" ? action : tab === "pending" ? pending : done;

  const tabs: { id: PmTab; label: string; count: number }[] = [
    { id: "action", label: "Your turn", count: action.length },
    { id: "pending", label: "In review", count: pending.length },
    { id: "done", label: "Approved", count: done.length },
  ];

  const allEmpty = channels.length === 0;

  return (
    <ReviewsListShell
      title="Reviews"
      subtitle="One thread per ticket — reply to GCC and keep mocks moving"
      enableSearch={!allEmpty}
      highlightNeedsChanges
      channels={visible}
      emptyTitle={
        allEmpty
          ? "No reviews yet"
          : tab === "action"
            ? "Nothing needs you right now"
            : tab === "pending"
              ? "Nothing waiting on GCC"
              : "No approved reviews yet"
      }
      emptyBody={
        allEmpty
          ? "Send a mockup for review from the workspace when it’s ready"
          : "Switch tabs to see other tickets"
      }
      tabs={<ReviewsTabBar tabs={tabs} active={tab} onChange={setTab} highlightTab="action" />}
    />
  );
}
