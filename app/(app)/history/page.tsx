"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import { groupSessionsByTicket } from "@lib/utils/session-history";
import type { TicketHistoryGroup } from "@lib/utils/session-history";
import { F, COLORS } from "@lib/design/tokens";
import { MockHistoryTimeline } from "@/components/history/MockHistoryTimeline";

export default function HistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [groups, setGroups] = useState<TicketHistoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const jiraBaseUrl = process.env.NEXT_PUBLIC_JIRA_BASE_URL ?? "";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        await repository.migrateLegacySessions(user.id);
        const sessions = await repository.getSessions(user.id);
        setGroups(groupSessionsByTicket(sessions, user.role));
      } catch {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, refreshKey]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div className="space-y-1">
          <h1 style={{ ...F.body, fontSize: 28, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.03em" }}>
            Mock history
          </h1>
          <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
            All tickets — versions, chat activity, and cost at a glance
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="signal-bars"><span /><span /><span /><span /><span /></div>
        </div>
      ) : (
        <MockHistoryTimeline
          groups={groups}
          jiraBaseUrl={jiraBaseUrl}
          onRefresh={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
