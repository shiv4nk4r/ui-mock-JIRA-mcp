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
  switch (sort) {
    case "time_asc":
      return sorted.sort((a, b) => a.savedAt - b.savedAt);
    case "ticket_asc":
      return sorted.sort((a, b) => ticketSortKey(a.ticketId).localeCompare(ticketSortKey(b.ticketId)));
    case "ticket_desc":
      return sorted.sort((a, b) => ticketSortKey(b.ticketId).localeCompare(ticketSortKey(a.ticketId)));
    case "time_desc":
    default:
      return sorted.sort((a, b) => b.savedAt - a.savedAt);
  }
}
