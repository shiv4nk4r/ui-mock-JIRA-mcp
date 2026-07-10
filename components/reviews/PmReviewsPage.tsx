"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { TicketReviewChannel } from "@lib/utils/review-channels";
import { loadReviewChannels } from "@lib/utils/review-channels";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { TicketReviewChannelCard } from "@/components/reviews/TicketReviewChannelCard";

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
  const done = channels.filter((c) => c.review.status === "approved" || c.review.status === "reviewed");

  const visible = tab === "action" ? action : tab === "pending" ? pending : done;

  const tabs: { id: PmTab; label: string; count: number }[] = [
    { id: "action", label: "Your turn", count: action.length },
    { id: "pending", label: "Waiting on engineering", count: pending.length },
    { id: "done", label: "Approved", count: done.length },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 sm:py-14 space-y-8">
      <div className="space-y-1">
        <h1 style={{ ...F.body, fontSize: 32, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.03em" }}>
          Review channels
        </h1>
        <p style={{ ...F.body, fontSize: 16, color: COLORS.muted }}>
          One thread per ticket — refine mockups and reply to engineering feedback
        </p>
      </div>

      <TabBar tabs={tabs} active={tab} onChange={setTab} highlightTab="action" />

      {channels.length === 0 ? (
        <EmptyState
          title="No review channels yet"
          body="Send a mockup for review from the workspace when it's ready"
        />
      ) : visible.length === 0 ? (
        <EmptyState title="Nothing in this tab" body="Switch tabs to see other tickets" />
      ) : (
        <ChannelList>
          {visible.map((c) => (
            <TicketReviewChannelCard
              key={c.review.id}
              channel={c}
              highlight={c.review.status === "needs_changes"}
            />
          ))}
        </ChannelList>
      )}
    </div>
  );
}

function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  highlightTab,
}: {
  tabs: { id: T; label: string; count: number }[];
  active: T;
  onChange: (id: T) => void;
  highlightTab?: T;
}) {
  return (
    <div className="flex gap-1 p-1 overflow-x-auto" style={{ background: COLORS.subtle, borderRadius: RADIUS.pill }}>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors"
          style={{
            borderRadius: RADIUS.pill,
            background: active === t.id ? COLORS.surface : "transparent",
            color: active === t.id ? COLORS.text : COLORS.muted,
            boxShadow: active === t.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
            ...F.body,
          }}
        >
          {t.label}
          {t.count > 0 && (
            <span
              className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-[11px] font-bold"
              style={{
                background: t.id === highlightTab ? COLORS.accent : COLORS.border,
                color: t.id === highlightTab ? "#fff" : COLORS.muted,
                borderRadius: RADIUS.pill,
              }}
            >
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function ChannelList({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden divide-y"
      style={{ borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}
    >
      {children}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div
      className="py-16 text-center px-6 space-y-3"
      style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
    >
      <p style={{ ...F.body, fontSize: 17, fontWeight: 600, color: COLORS.text }}>{title}</p>
      <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>{body}</p>
    </div>
  );
}

export { TabBar, ChannelList, EmptyState };
