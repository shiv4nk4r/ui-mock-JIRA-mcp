"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import { mockupGenerationStore } from "@lib/mockup/generation-store";
import {
  buildingGroupsFromIncompleteSessions,
  groupSessionsByTicket,
  mergeBuildingIntoHistory,
} from "@lib/utils/session-history";
import type { BuildingHistorySource, TicketHistoryGroup } from "@lib/utils/session-history";
import { F, COLORS } from "@lib/design/tokens";
import { MockHistoryTimeline } from "@/components/history/MockHistoryTimeline";

function snapshotsToBuildingSources(
  snaps: ReturnType<typeof mockupGenerationStore.listRunning>,
): BuildingHistorySource[] {
  return snaps
    .filter((s) => s.kind === "generate" || s.kind === "refine")
    .map((s) => ({
      ticketId: s.ticketId,
      summary: s.ticketData.summary,
      sessionId: s.sessionId,
      messages: s.messages,
      usageRecords: s.usageRecords,
      activeHtml: s.activeHtml,
      kind: s.kind as "generate" | "refine",
      thinkingHint: s.thinkingLog[s.thinkingLog.length - 1],
      selectedModel: s.selectedModel,
      status: s.sessionStatus,
    }));
}

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

    let cancelled = false;
    let firstLoad = true;

    async function load() {
      if (firstLoad) setLoading(true);
      try {
        await repository.migrateLegacySessions(user!.id);
        const sessions = await repository.getSessions(user!.id);
        if (cancelled) return;

        const live = snapshotsToBuildingSources(mockupGenerationStore.listRunning(user!.id));
        const liveIds = new Set(live.map((s) => s.ticketId));
        const saved = groupSessionsByTicket(sessions, user!.role);
        const incomplete = buildingGroupsFromIncompleteSessions(sessions, user!.role, liveIds);
        const savedIds = new Set(saved.map((g) => g.ticketId));
        const base = [
          ...saved,
          ...incomplete.filter((g) => !savedIds.has(g.ticketId)),
        ];

        setGroups(mergeBuildingIntoHistory(base, live, user!.role));
      } catch {
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          firstLoad = false;
        }
      }
    }

    void load();

    const unsub = mockupGenerationStore.subscribeGlobal(() => {
      void load();
    });

    return () => {
      cancelled = true;
      unsub();
    };
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
