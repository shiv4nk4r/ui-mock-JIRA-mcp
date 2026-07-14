"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { TicketReviewChannel } from "@lib/utils/review-channels";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { ReviewListRow } from "@/components/reviews/ReviewListRow";

export function ReviewsListShell({
  title,
  subtitle,
  tabs,
  emptyTitle,
  emptyBody,
  channels,
  showPm = false,
  showBuild = false,
  highlightNeedsChanges = false,
  enableSearch = false,
  headerExtra,
}: {
  title: string;
  subtitle: string;
  tabs: ReactNode;
  emptyTitle: string;
  emptyBody: string;
  channels: TicketReviewChannel[];
  showPm?: boolean;
  showBuild?: boolean;
  highlightNeedsChanges?: boolean;
  enableSearch?: boolean;
  headerExtra?: ReactNode;
}) {
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.ticketId.toLowerCase().includes(q) ||
        c.ticketSummary.toLowerCase().includes(q) ||
        c.review.userName.toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q),
    );
  }, [channels, search]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto relative">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 40% at 50% 12%, rgba(217,119,6,0.06) 0%, transparent 65%)",
        }}
      />

      <div className="relative z-10 w-full max-w-[720px] mx-auto px-6 pt-8 sm:pt-12 pb-16 space-y-7">
        <h1
          style={{
            ...F.body,
            fontSize: "clamp(26px, 4vw, 34px)",
            fontWeight: 520,
            color: COLORS.text,
            letterSpacing: "-0.035em",
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>

        {tabs}

        {enableSearch && channels.length > 0 && (
          <div
            className="flex items-center gap-2.5 w-full pl-4 pr-3 py-2"
            style={{
              background: COLORS.surface,
              borderRadius: RADIUS.pill,
              border: `1px solid ${COLORS.border}`,
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
            }}
          >
            <span style={{ color: COLORS.muted, fontSize: 16, lineHeight: 1 }} aria-hidden>
              ⌕
            </span>
            <input
              type="search"
              placeholder="Filter by ticket, summary, PM…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 min-w-0 bg-transparent outline-none text-sm py-1"
              style={{ ...F.body, color: COLORS.text, caretColor: COLORS.accent }}
              aria-label="Filter reviews"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="w-7 h-7 flex items-center justify-center hover:bg-black/5"
                style={{ borderRadius: "50%", color: COLORS.muted }}
                aria-label="Clear filter"
              >
                ×
              </button>
            )}
          </div>
        )}

        {channels.length === 0 ? (
          <EmptyReviews title={emptyTitle} body={emptyBody} />
        ) : visible.length === 0 ? (
          <EmptyReviews title="No matches" body="Try a different filter" />
        ) : (
          <div className="space-y-0.5">
            {visible.map((c) => (
              <ReviewListRow
                key={c.review.id}
                channel={c}
                showPm={showPm}
                showBuild={showBuild}
                highlight={highlightNeedsChanges && c.review.status === "needs_changes"}
              />
            ))}
          </div>
        )}

        {headerExtra}

        {subtitle && (
          <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, lineHeight: 1.5 }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyReviews({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-20 text-center space-y-2">
      <p style={{ ...F.body, fontSize: 16, fontWeight: 520, color: COLORS.text }}>{title}</p>
      <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>{body}</p>
    </div>
  );
}

export function ReviewsTabBar<T extends string>({
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
    <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
      {tabs.map((t) => {
        const selected = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className="flex items-center gap-2 px-3.5 py-2 text-sm whitespace-nowrap transition-colors"
            style={{
              borderRadius: RADIUS.pill,
              background: selected ? COLORS.surface : "transparent",
              color: selected ? COLORS.text : COLORS.muted,
              fontWeight: selected ? 560 : 450,
              boxShadow: selected ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              ...F.body,
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span
                className="min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-semibold"
                style={{
                  background:
                    t.id === highlightTab
                      ? selected
                        ? COLORS.accent
                        : COLORS.accentSoft
                      : selected
                        ? COLORS.subtle
                        : "transparent",
                  color:
                    t.id === highlightTab
                      ? selected
                        ? "#fff"
                        : COLORS.accent
                      : COLORS.muted,
                  borderRadius: RADIUS.pill,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
