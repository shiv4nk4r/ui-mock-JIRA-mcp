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
  const jiraBaseUrl = process.env.NEXT_PUBLIC_JIRA_BASE_URL ?? "";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    (async () => {
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
  }, [user, authLoading]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 sm:py-14 space-y-8">
      <div className="space-y-1">
        <h1 style={{ ...F.body, fontSize: 32, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.03em" }}>
          Mock history
        </h1>
        <p style={{ ...F.body, fontSize: 16, color: COLORS.muted }}>
          Mockups and chat revisions grouped by ticket
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="signal-bars"><span /><span /><span /><span /><span /></div>
        </div>
      ) : (
        <MockHistoryTimeline groups={groups} jiraBaseUrl={jiraBaseUrl} />
      )}
    </div>
  );
}
