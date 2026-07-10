"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { MockupSession } from "@lib/types";
import { F, COLORS, RADIUS, greeting } from "@lib/design/tokens";
import { SessionStatusChip } from "@/components/shared/SessionStatusChip";
import { DashboardEngagementPanel } from "@/components/feedback/DashboardEngagementPanel";
import { FeatureRequestsPanel } from "@/components/feedback/FeatureRequestsPanel";

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [recent, setRecent] = useState<MockupSession | null>(null);
  const [historyCount, setHistoryCount] = useState(0);
  const [ticketInput, setTicketInput] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        await repository.migrateLegacySessions(user.id);
        const list = await repository.getSessions(user.id);
        const withMocks = list.filter(
          (s) => s.activeHtml || s.messages?.some((m) => m.htmlComponent),
        );
        setRecent(withMocks[0] ?? null);
        setHistoryCount(new Set(withMocks.map((s) => s.ticketId)).size);
      } catch {
        setRecent(null);
        setHistoryCount(0);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [loading]);

  function goToTicket(id: string) {
    router.push(`/workspace/${encodeURIComponent(id.trim().toUpperCase())}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!ticketInput.trim()) return;
    goToTicket(ticketInput);
  }

  const recentSession = recent;

  return (
    <div className="max-w-xl mx-auto px-6 py-12 sm:py-16 space-y-10">
      <div className="text-center space-y-1">
        <h1 style={{ ...F.body, fontSize: 32, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.03em" }}>
          {user ? greeting(user.name) : "Welcome"}
        </h1>
        <p style={{ ...F.body, fontSize: 16, color: COLORS.muted }}>
          Paste a JIRA ticket to generate a mockup
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <input
          ref={inputRef}
          type="text"
          placeholder="GM-294720"
          value={ticketInput}
          onChange={(e) => setTicketInput(e.target.value)}
          className="w-full px-5 py-4 pr-24 text-base outline-none transition-shadow focus:ring-2 focus:ring-amber-500/30"
          style={{
            ...F.body,
            background: COLORS.surface,
            color: COLORS.text,
            borderRadius: RADIUS.lg,
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            caretColor: COLORS.accent,
          }}
        />
        <button
          type="submit"
          disabled={!ticketInput.trim()}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 text-sm font-semibold disabled:opacity-30 transition-opacity"
          style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
        >
          Go
        </button>
      </form>

      {!loading && recentSession && (
        <button
          type="button"
          onClick={() => goToTicket(recentSession.ticketId)}
          className="w-full text-left p-5 transition-transform active:scale-[0.99]"
          style={{
            background: COLORS.surface,
            borderRadius: RADIUS.lg,
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div className="flex items-center justify-between gap-3 mb-2">
            <span style={{ ...F.body, fontSize: 13, fontWeight: 600, color: COLORS.accent }}>Continue</span>
            <SessionStatusChip status={recentSession.status} />
          </div>
          <div style={{ ...F.body, fontSize: 17, fontWeight: 600, color: COLORS.text }} className="truncate">
            {recentSession.ticketData.summary}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span style={{ ...F.mono, fontSize: 13, color: COLORS.muted }}>{recentSession.ticketId}</span>
            <span style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>·</span>
            <span style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
              {new Date(recentSession.savedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
            </span>
          </div>
        </button>
      )}

      {!loading && historyCount > 0 && (
        <Link
          href="/history"
          className="block text-center py-3 text-sm font-medium hover:underline"
          style={{ ...F.body, color: COLORS.accent }}
        >
          View mock history ({historyCount} {historyCount === 1 ? "ticket" : "tickets"})
        </Link>
      )}

      {!loading && !recentSession && (
        <p className="text-center" style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
          No mockups yet — enter a ticket above to start
        </p>
      )}

      {!loading && user?.role === "external" && <DashboardEngagementPanel />}

      {!loading && user?.role === "internal" && <FeatureRequestsPanel />}
    </div>
  );
}
