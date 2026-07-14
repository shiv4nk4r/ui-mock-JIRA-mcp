"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { TicketReviewChannel } from "@lib/utils/review-channels";
import { loadReviewChannels } from "@lib/utils/review-channels";
import { FeatureRequestsPanel } from "@/components/feedback/FeatureRequestsPanel";
import { ReviewsListShell, ReviewsTabBar } from "@/components/reviews/ReviewsListShell";
import { useFeatureFlags } from "@lib/hooks/use-feature-flags";
import { COLORS } from "@lib/design/tokens";

type QueueTab = "pending" | "changes" | "done";

export function InternalReviewsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { buildPr: buildPrEnabled } = useFeatureFlags();
  const [tab, setTab] = useState<QueueTab>("pending");
  const [channels, setChannels] = useState<TicketReviewChannel[]>([]);

  useEffect(() => {
    if (user?.role !== "internal") {
      router.replace("/dashboard");
      return;
    }
    (async () => {
      const list = await repository.getReviews();
      setChannels(await loadReviewChannels(list));
    })();
  }, [user, router]);

  const pending = channels.filter((c) => c.review.status === "pending_review");
  const changes = channels.filter((c) => c.review.status === "needs_changes");
  const done = channels.filter(
    (c) => c.review.status === "approved" || c.review.status === "reviewed",
  );

  const visible = tab === "pending" ? pending : tab === "changes" ? changes : done;

  const tabs: { id: QueueTab; label: string; count: number }[] = [
    { id: "pending", label: "Needs review", count: pending.length },
    { id: "changes", label: "Waiting on Product", count: changes.length },
    { id: "done", label: "Completed", count: done.length },
  ];

  return (
    <ReviewsListShell
      title="Reviews"
      subtitle="Queue and completed mockups — open a ticket to approve or build"
      enableSearch
      showPm
      showBuild={buildPrEnabled && tab === "done"}
      channels={visible}
      emptyTitle={
        tab === "pending"
          ? "All caught up"
          : tab === "changes"
            ? "Nothing waiting on Product"
            : "No completed reviews yet"
      }
      emptyBody={
        tab === "pending"
          ? "New mockups appear here when Product submits or resubmits"
          : tab === "changes"
            ? "Tickets needing Product updates show here"
            : "Approved reviews appear here with Build / PR status"
      }
      headerExtra={
        <div
          className="pt-4 mt-2"
          style={{
            opacity: 0.35,
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <FeatureRequestsPanel compact manageable />
        </div>
      }
      tabs={
        <ReviewsTabBar tabs={tabs} active={tab} onChange={setTab} highlightTab="pending" />
      }
    />
  );
}
