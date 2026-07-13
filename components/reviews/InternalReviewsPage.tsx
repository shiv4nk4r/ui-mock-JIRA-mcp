"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { TicketReviewChannel } from "@lib/utils/review-channels";
import { loadReviewChannels } from "@lib/utils/review-channels";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { FeatureRequestsPanel } from "@/components/feedback/FeatureRequestsPanel";
import { ChannelList, EmptyState, TabBar } from "@/components/reviews/PmReviewsPage";
import { TicketReviewChannelCard } from "@/components/reviews/TicketReviewChannelCard";

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
  const done = channels.filter((c) => c.review.status === "approved" || c.review.status === "reviewed");

  const visible = tab === "pending" ? pending : tab === "changes" ? changes : done;

  const tabs: { id: QueueTab; label: string; count: number }[] = [
    { id: "pending", label: "Needs your review", count: pending.length },
    { id: "changes", label: "Waiting on PM", count: changes.length },
    { id: "done", label: "Completed", count: done.length },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 sm:py-14 space-y-8">
      <div className="space-y-1">
        <h1 style={{ ...F.body, fontSize: 32, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.03em" }}>
          Review channels
        </h1>
        <p style={{ ...F.body, fontSize: 16, color: COLORS.muted }}>
          One thread per ticket — review mockups and keep the conversation going
        </p>
      </div>

      <FeatureRequestsPanel compact manageable />

      <TabBar tabs={tabs} active={tab} onChange={setTab} highlightTab="pending" />

      {visible.length === 0 ? (
        <EmptyState
          title={
            tab === "pending"
              ? "All caught up"
              : tab === "changes"
                ? "No tickets waiting on PM"
                : "No completed reviews yet"
          }
          body={
            tab === "pending"
              ? "New mockups appear here when PMs submit or resubmit"
              : "Completed reviews and approvals show in this tab"
          }
        />
      ) : (
        <ChannelList>
          {visible.map((c) => (
            <TicketReviewChannelCard
              key={c.review.id}
              channel={c}
              showPm
              highlight={c.review.status === "pending_review"}
            />
          ))}
        </ChannelList>
      )}
    </div>
  );
}
