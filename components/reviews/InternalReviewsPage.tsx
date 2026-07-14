"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { TicketReviewChannel } from "@lib/utils/review-channels";
import { loadReviewChannels } from "@lib/utils/review-channels";
import { F, COLORS } from "@lib/design/tokens";
import { FeatureRequestsPanel } from "@/components/feedback/FeatureRequestsPanel";
import { TabBar } from "@/components/reviews/PmReviewsPage";
import { InternalReviewsTable } from "@/components/reviews/InternalReviewsTable";

type QueueTab = "pending" | "changes" | "done";

export function InternalReviewsPage() {
  const router = useRouter();
  const { user } = useAuth();
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
    { id: "pending", label: "Needs your review", count: pending.length },
    { id: "changes", label: "Waiting on PM", count: changes.length },
    { id: "done", label: "Completed", count: done.length },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="space-y-1">
        <h1 style={{ ...F.body, fontSize: 28, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.03em" }}>
          Review channels
        </h1>
        <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
          Queue and completed reviews — open a ticket to approve or run Build
        </p>
      </div>

      <FeatureRequestsPanel compact manageable />

      <TabBar tabs={tabs} active={tab} onChange={setTab} highlightTab="pending" />

      <InternalReviewsTable
        channels={visible}
        showBuildColumn={tab === "done"}
        emptyTitle={
          tab === "pending"
            ? "All caught up"
            : tab === "changes"
              ? "No tickets waiting on PM"
              : "No completed reviews yet"
        }
        emptyBody={
          tab === "pending"
            ? "New mockups appear here when PMs submit or resubmit"
            : tab === "changes"
              ? "Tickets needing PM updates show here"
              : "Approved reviews appear here with Build / PR status"
        }
      />
    </div>
  );
}
