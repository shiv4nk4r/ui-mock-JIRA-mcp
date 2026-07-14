import type { Message, MockupSession, UsageRecord, UserRole } from "@lib/types";
import { sumUsageRecords } from "@lib/utils/usage-cost";

export interface MockRevision {
  id: string;
  index: number;
  label: string;
  prompt?: string;
  html?: string;
  timestamp?: number;
  usage?: UsageRecord;
}

export interface TicketHistoryGroup {
  ticketId: string;
  summary: string;
  status: MockupSession["status"];
  savedAt: number;
  revisionCount: number;
  messageCount: number;
  totalCostUsd: number;
  latestPrompt?: string;
  latestHtml?: string;
  revisions: MockRevision[];
  /** True while a mockup generate/refine job is in flight. */
  building?: boolean;
  buildingLabel?: string;
}

function revisionLabel(userMsg: Message | undefined, index: number): string {
  if (index === 0) return "Initial mockup";
  const text = userMsg?.text?.trim();
  if (!text) return `Revision ${index}`;
  if (text.startsWith("Auto-generate UI mockup")) return "Initial mockup";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function userPrompt(userMsg: Message | undefined, index: number): string | undefined {
  if (index === 0) return undefined;
  const text = userMsg?.text?.trim();
  if (!text || text.startsWith("Auto-generate UI mockup")) return undefined;
  return text;
}

export function buildRevisions(session: MockupSession, userRole: UserRole): MockRevision[] {
  const revisions: MockRevision[] = [];
  const usage = session.usageRecords ?? [];
  let usageIdx = 0;

  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i];
    if (msg.role !== "assistant") continue;

    const html = msg.htmlComponent;
    if (!html) continue;

    const prevUser = [...session.messages.slice(0, i)].reverse().find((m) => m.role === "user");
    const index = revisions.length;

    revisions.push({
      id: `${session.id}-${index}`,
      index,
      label: revisionLabel(prevUser, index),
      prompt: userPrompt(prevUser, index),
      html,
      timestamp: usage[usageIdx]?.timestamp,
      usage: usage[usageIdx],
    });
    usageIdx += 1;
  }

  if (revisions.length === 0 && session.activeHtml) {
    revisions.push({
      id: `${session.id}-0`,
      index: 0,
      label: "Current mockup",
      html: session.activeHtml,
      timestamp: session.savedAt,
    });
  } else if (revisions.length > 0 && session.activeHtml) {
    const last = revisions[revisions.length - 1];
    if (last.html !== session.activeHtml) {
      last.html = session.activeHtml;
      last.timestamp = session.savedAt;
    }
  }

  return revisions;
}

export function groupSessionsByTicket(sessions: MockupSession[], userRole: UserRole): TicketHistoryGroup[] {
  const byTicket = new Map<string, MockupSession>();

  for (const session of sessions) {
    if (!session.activeHtml && !(session.messages?.some((m) => m.htmlComponent))) continue;
    const existing = byTicket.get(session.ticketId);
    if (!existing || session.savedAt > existing.savedAt) {
      byTicket.set(session.ticketId, session);
    }
  }

  return Array.from(byTicket.values())
    .map((session) => {
      const revisions = buildRevisions(session, userRole);
      const lastRev = revisions[revisions.length - 1];
      return {
        ticketId: session.ticketId,
        summary: session.ticketData.summary,
        status: session.status,
        savedAt: session.savedAt,
        revisionCount: revisions.length,
        messageCount: session.messages.filter((m) => !m.isStreaming).length,
        totalCostUsd: sumUsageRecords(session.usageRecords ?? []).costUsd,
        latestPrompt: lastRev?.prompt ?? lastRev?.label,
        latestHtml: session.activeHtml || lastRev?.html,
        revisions,
      };
    })
    .sort((a, b) => b.savedAt - a.savedAt);
}

/** In-flight generate/refine jobs to overlay onto history. */
export interface BuildingHistorySource {
  ticketId: string;
  summary: string;
  sessionId: string;
  messages: Message[];
  usageRecords: UsageRecord[];
  activeHtml: string;
  kind: "generate" | "refine";
  thinkingHint?: string;
  selectedModel?: string;
  status?: MockupSession["status"];
}

function buildingGroupFromSource(
  source: BuildingHistorySource,
  userRole: UserRole,
): TicketHistoryGroup {
  const session: MockupSession = {
    id: source.sessionId,
    userId: "",
    ticketId: source.ticketId,
    ticketData: { id: source.ticketId, summary: source.summary, description: "" },
    messages: source.messages,
    activeHtml: source.activeHtml,
    usageRecords: source.usageRecords,
    selectedModel: source.selectedModel ?? "",
    status: source.status ?? "in_progress",
    savedAt: Date.now(),
  };
  const revisions = buildRevisions(session, userRole);
  const label =
    source.kind === "refine"
      ? "Refining mockup…"
      : "Generating mockup…";
  return {
    ticketId: source.ticketId,
    summary: source.summary,
    status: "in_progress",
    savedAt: Date.now(),
    revisionCount: revisions.length,
    messageCount: source.messages.filter((m) => !m.isStreaming).length,
    totalCostUsd: sumUsageRecords(source.usageRecords).costUsd,
    latestPrompt: source.thinkingHint || label,
    latestHtml: source.activeHtml || revisions[revisions.length - 1]?.html,
    revisions,
    building: true,
    buildingLabel: label,
  };
}

/**
 * Overlay live/building mocks onto saved history groups.
 * Building tickets sort to the top; matching saved rows get building flags.
 */
export function mergeBuildingIntoHistory(
  groups: TicketHistoryGroup[],
  building: BuildingHistorySource[],
  userRole: UserRole,
): TicketHistoryGroup[] {
  if (building.length === 0) return groups;

  const byTicket = new Map(groups.map((g) => [g.ticketId, { ...g }]));

  for (const source of building) {
    const live = buildingGroupFromSource(source, userRole);
    const existing = byTicket.get(source.ticketId);
    if (existing) {
      byTicket.set(source.ticketId, {
        ...existing,
        building: true,
        buildingLabel: live.buildingLabel,
        status: "in_progress",
        savedAt: Date.now(),
        latestPrompt: live.latestPrompt,
        messageCount: Math.max(existing.messageCount, live.messageCount),
        totalCostUsd: Math.max(existing.totalCostUsd, live.totalCostUsd),
        revisionCount: Math.max(existing.revisionCount, live.revisionCount),
        latestHtml: live.latestHtml || existing.latestHtml,
        revisions: live.revisions.length > 0 ? live.revisions : existing.revisions,
      });
    } else {
      byTicket.set(source.ticketId, live);
    }
  }

  return Array.from(byTicket.values()).sort((a, b) => {
    if (a.building && !b.building) return -1;
    if (!a.building && b.building) return 1;
    return b.savedAt - a.savedAt;
  });
}

/** Persisted sessions that have activity but no mock HTML yet (mid-generation). */
export function buildingGroupsFromIncompleteSessions(
  sessions: MockupSession[],
  userRole: UserRole,
  excludeTicketIds?: Set<string>,
): TicketHistoryGroup[] {
  const out: TicketHistoryGroup[] = [];
  for (const session of sessions) {
    if (excludeTicketIds?.has(session.ticketId)) continue;
    const hasHtml =
      !!session.activeHtml || !!session.messages?.some((m) => m.htmlComponent);
    if (hasHtml) continue;
    if (!session.messages?.length) continue;
    out.push(
      buildingGroupFromSource(
        {
          ticketId: session.ticketId,
          summary: session.ticketData.summary,
          sessionId: session.id,
          messages: session.messages,
          usageRecords: session.usageRecords ?? [],
          activeHtml: "",
          kind: "generate",
          status: session.status,
          selectedModel: session.selectedModel,
        },
        userRole,
      ),
    );
  }
  return out;
}

export type HistorySort = "time_desc" | "time_asc" | "ticket_asc" | "ticket_desc";

function ticketSortKey(ticketId: string): string {
  const match = ticketId.match(/(\d+)\s*$/);
  if (match) {
    return `${ticketId.replace(/\d+\s*$/, "").padEnd(12, "0")}${match[1].padStart(12, "0")}`;
  }
  return ticketId.toUpperCase();
}

export function filterHistoryGroups(
  groups: TicketHistoryGroup[],
  query: string,
): TicketHistoryGroup[] {
  const q = query.trim().toUpperCase();
  if (!q) return groups;
  return groups.filter((g) => g.ticketId.toUpperCase().includes(q));
}

export function sortHistoryGroups(
  groups: TicketHistoryGroup[],
  sort: HistorySort,
): TicketHistoryGroup[] {
  const sorted = [...groups];
  const byTicket = (a: TicketHistoryGroup, b: TicketHistoryGroup) =>
    ticketSortKey(a.ticketId).localeCompare(ticketSortKey(b.ticketId));
  const buildingFirst = (a: TicketHistoryGroup, b: TicketHistoryGroup) => {
    if (a.building && !b.building) return -1;
    if (!a.building && b.building) return 1;
    return 0;
  };

  switch (sort) {
    case "time_asc":
      return sorted.sort((a, b) => buildingFirst(a, b) || a.savedAt - b.savedAt);
    case "ticket_asc":
      return sorted.sort((a, b) => buildingFirst(a, b) || byTicket(a, b));
    case "ticket_desc":
      return sorted.sort((a, b) => buildingFirst(a, b) || byTicket(b, a));
    case "time_desc":
    default:
      return sorted.sort((a, b) => buildingFirst(a, b) || b.savedAt - a.savedAt);
  }
}
