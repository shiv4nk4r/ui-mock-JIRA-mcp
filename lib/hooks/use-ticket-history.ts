"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import { mockupGenerationStore } from "@lib/mockup/generation-store";
import {
  buildingGroupsFromIncompleteSessions,
  groupSessionsByTicket,
  mergeBuildingIntoHistory,
} from "@lib/utils/session-history";
import type { BuildingHistorySource, TicketHistoryGroup } from "@lib/utils/session-history";

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

export function useTicketHistory() {
  const { user, isLoading: authLoading } = useAuth();
  const [groups, setGroups] = useState<TicketHistoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setGroups([]);
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

  return { groups, loading, refresh, user };
}
