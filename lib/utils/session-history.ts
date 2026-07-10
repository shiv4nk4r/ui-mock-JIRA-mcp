import type { Message, MockupSession, UserRole } from "@lib/types";

export interface MockRevision {
  id: string;
  index: number;
  label: string;
  prompt?: string;
  html?: string;
  timestamp?: number;
}

export interface TicketHistoryGroup {
  ticketId: string;
  summary: string;
  status: MockupSession["status"];
  savedAt: number;
  revisionCount: number;
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
      return {
        ticketId: session.ticketId,
        summary: session.ticketData.summary,
        status: session.status,
        savedAt: session.savedAt,
        revisionCount: revisions.length,
        latestHtml: session.activeHtml || revisions[revisions.length - 1]?.html,
        revisions,
      };
    })
    .sort((a, b) => b.savedAt - a.savedAt);
}
