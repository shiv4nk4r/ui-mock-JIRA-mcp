import type { Message, MockupSession, ReviewHandoffSnapshot, ReviewItem, TicketData } from "@lib/types";
import { EFFORT_MARKER, parseAssistantSections } from "@lib/utils/parse-chat";

export interface ExecutionChange {
  id: string;
  location: string;
  effort?: string;
  description: string;
  source: "effort" | "revision" | "ticket" | "change_log";
  changeType?: string;
  acceptance?: string;
}

export interface ExecutionDetails {
  ticketId: string;
  summary: string;
  tshirtSize?: string;
  storyPoints?: string;
  riskFactor?: string;
  changes: ExecutionChange[];
  hasEffortData: boolean;
  changeLogMarkdown?: string;
  generatedAgentPrompt?: string;
}

function parseMetaLine(text: string, label: string): string | undefined {
  const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, "i");
  const match = text.match(re);
  return match?.[1]?.trim();
}

function parseChangeLogTable(text: string): ExecutionChange[] {
  const changes: ExecutionChange[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("|")) continue;
    const cells = line.split("|").map((c) => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;
    if (cells[0] === "#" || /^-+$/.test(cells[0]) || cells.some((c) => /^-+$/.test(c))) continue;

    const rowNum = cells[0].replace(/\D/g, "");
    changes.push({
      id: `change-log-${rowNum || changes.length}`,
      location: cells[1] || "Unknown",
      changeType: cells[2],
      description: cells[3] || "",
      acceptance: cells[4],
      source: "change_log",
    });
  }

  return changes;
}

function latestAssistantHandoff(messages: Message[]): {
  effortText?: string;
  changeLog?: string;
  agentPrompt?: string;
} {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    if (m.effortEstimation || m.changeLog || m.agentPrompt) {
      return {
        effortText: m.effortEstimation,
        changeLog: m.changeLog,
        agentPrompt: m.agentPrompt,
      };
    }
    if (m.text) {
      const parsed = parseAssistantSections(m.text);
      if (parsed.effortEstimation || parsed.changeLog || parsed.agentPrompt) {
        return {
          effortText: parsed.effortEstimation,
          changeLog: parsed.changeLog,
          agentPrompt: parsed.agentPrompt,
        };
      }
    }
  }
  return {};
}

export function getSessionAgentPrompt(session: MockupSession | null): string | undefined {
  const { agentPrompt } = latestAssistantHandoff(session?.messages ?? []);
  return agentPrompt?.trim() || undefined;
}

function parseBreakdownLine(line: string): Omit<ExecutionChange, "id" | "source"> | null {
  const trimmed = line.trim().replace(/^[-*]\s*/, "");
  if (!trimmed) return null;

  const patterns = [
    /^(.+?):\s*(\d+(?:\.\d+)?)\s*Days?\s*[—–-]\s*(.+)$/i,
    /^(.+?)\s*[—–-]\s*(.+)$/i,
    /^(.+?):\s*(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (!match) continue;
    if (match.length === 4) {
      return {
        location: match[1].replace(/\*\*/g, "").trim(),
        effort: `${match[2]} days`,
        description: match[3].trim(),
      };
    }
    if (match.length === 3) {
      const loc = match[1].replace(/\*\*/g, "").trim();
      const desc = match[2].trim();
      const dayMatch = desc.match(/^(\d+(?:\.\d+)?)\s*Days?\s*[—–-]\s*(.+)$/i);
      if (dayMatch) {
        return { location: loc, effort: `${dayMatch[1]} days`, description: dayMatch[2].trim() };
      }
      return { location: loc, description: desc };
    }
  }

  return { location: "General", description: trimmed.replace(/\*\*/g, "") };
}

export function parseEffortEstimation(text: string): Partial<ExecutionDetails> {
  const changes: ExecutionChange[] = [];
  let inBreakdown = false;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    if (/breakdown analysis/i.test(line)) {
      inBreakdown = true;
      continue;
    }
    if (inBreakdown && /^[-*]\s/.test(line)) {
      const parsed = parseBreakdownLine(line);
      if (parsed) {
        changes.push({
          id: `effort-${changes.length}`,
          ...parsed,
          source: "effort",
        });
      }
    }
    if (inBreakdown && line.startsWith("- **Architecture")) break;
  }

  return {
    tshirtSize: parseMetaLine(text, "T-Shirt Size"),
    storyPoints: parseMetaLine(text, "Estimated Story Points"),
    riskFactor: parseMetaLine(text, "Architecture Risk Factor"),
    changes,
    hasEffortData: true,
  };
}

function extractRevisionPrompts(messages: Message[]): ExecutionChange[] {
  const changes: ExecutionChange[] = [];
  let rev = 0;

  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const text = msg.text?.trim();
    if (!text || text.startsWith("Auto-generate UI mockup")) continue;
    changes.push({
      id: `rev-${rev}`,
      location: "UI / Mockup",
      description: text,
      source: "revision",
    });
    rev += 1;
  }

  return changes;
}

function ticketScopeChanges(ticket: TicketData): ExecutionChange[] {
  const changes: ExecutionChange[] = [];
  const desc = ticket.description?.trim();
  if (desc) {
    changes.push({
      id: "ticket-desc",
      location: "Product scope",
      description: desc.length > 400 ? `${desc.slice(0, 400)}…` : desc,
      source: "ticket",
    });
  }
  for (const sub of ticket.subtasks?.slice(0, 5) ?? []) {
    changes.push({
      id: `sub-${sub.id}`,
      location: sub.id,
      description: sub.summary,
      source: "ticket",
    });
  }
  return changes;
}

export function buildReviewHandoffSnapshot(session: MockupSession | null): ReviewHandoffSnapshot | undefined {
  if (!session) return undefined;
  const messages = session.messages ?? [];
  const handoff = latestAssistantHandoff(messages);

  let effortText = handoff.effortText;
  if (!effortText) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      if (m.text?.includes(EFFORT_MARKER)) {
        effortText = m.text.slice(m.text.indexOf(EFFORT_MARKER));
        break;
      }
    }
  }

  const parsed = effortText ? parseEffortEstimation(effortText) : {};
  const changeLogChanges = handoff.changeLog ? parseChangeLogTable(handoff.changeLog) : [];

  if (!effortText && !handoff.changeLog && !parsed.tshirtSize) return undefined;

  return {
    tshirtSize: parsed.tshirtSize,
    storyPoints: parsed.storyPoints,
    riskFactor: parsed.riskFactor,
    effortEstimation: effortText,
    changeLog: handoff.changeLog,
    fileChangeCount: changeLogChanges.length,
  };
}

export function buildExecutionDetails(
  review: ReviewItem,
  session: MockupSession | null,
): ExecutionDetails {
  const ticket = session?.ticketData;
  const messages = session?.messages ?? [];
  const handoff = latestAssistantHandoff(messages);
  const snapshot = review.handoff;

  let effortText = handoff.effortText ?? snapshot?.effortEstimation;
  if (!effortText) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      if (m.text?.includes(EFFORT_MARKER)) {
        effortText = m.text.slice(m.text.indexOf(EFFORT_MARKER));
        break;
      }
    }
  }

  let parsed: Partial<ExecutionDetails> = {};
  if (effortText) {
    parsed = parseEffortEstimation(effortText);
  }
  if (!parsed.tshirtSize && snapshot) {
    parsed.tshirtSize = snapshot.tshirtSize;
    parsed.storyPoints = snapshot.storyPoints;
    parsed.riskFactor = snapshot.riskFactor;
    parsed.hasEffortData = !!(snapshot.tshirtSize || snapshot.storyPoints || snapshot.effortEstimation);
  }

  const changeLogMarkdown = handoff.changeLog ?? snapshot?.changeLog;
  const changeLogChanges = changeLogMarkdown ? parseChangeLogTable(changeLogMarkdown) : [];
  const revisionChanges = extractRevisionPrompts(messages);
  const ticketChanges = ticket ? ticketScopeChanges(ticket) : [];

  let merged: ExecutionChange[] =
    changeLogChanges.length > 0
      ? changeLogChanges
      : [
          ...(parsed.changes ?? []),
          ...revisionChanges.filter(
            (r) => !(parsed.changes ?? []).some((c) => c.description === r.description),
          ),
        ];

  if (merged.length === 0 && ticketChanges.length > 0) {
    merged = ticketChanges;
  }

  return {
    ticketId: review.ticketId,
    summary: review.ticketSummary,
    tshirtSize: parsed.tshirtSize,
    storyPoints: parsed.storyPoints,
    riskFactor: parsed.riskFactor,
    changes: merged,
    hasEffortData: !!parsed.hasEffortData || !!snapshot?.effortEstimation,
    changeLogMarkdown,
    generatedAgentPrompt: handoff.agentPrompt,
  };
}

export function buildAgentPrompt(
  details: ExecutionDetails,
  review: ReviewItem,
  session: MockupSession | null,
): string {
  const generated = details.generatedAgentPrompt ?? getSessionAgentPrompt(session);
  if (generated) {
    return generated;
  }

  const lines: string[] = [
    `# Implementation task: ${details.ticketId}`,
    "",
    `**Summary:** ${details.summary}`,
    `**Submitted by:** ${review.userName} (${review.userEmail})`,
    `**Review status:** ${review.status}`,
    "",
    "## Goal",
    "Implement the approved UI mockup in the Manager Dashboard codebase (Vue 2 + Quasar 1.20.1, Apollo GraphQL BFF). Match the mockup behaviour and layout as closely as practical while following existing patterns.",
    "",
  ];

  if (details.storyPoints || details.tshirtSize || details.riskFactor) {
    lines.push("## Estimation snapshot");
    if (details.tshirtSize) lines.push(`- **T-shirt size:** ${details.tshirtSize}`);
    if (details.storyPoints) lines.push(`- **Story points:** ${details.storyPoints}`);
    if (details.riskFactor) lines.push(`- **Architecture risk:** ${details.riskFactor}`);
    lines.push("");
  }

  if (session?.messages?.length) {
    const revisions = extractRevisionPrompts(session.messages);
    if (revisions.length > 0) {
      lines.push("## PM mockup revisions (chat history)");
      revisions.forEach((r, i) => {
        lines.push(`${i + 1}. ${r.description}`);
      });
      lines.push("");
    }
  }

  lines.push("## Required changes");
  if (details.changes.length === 0) {
    lines.push(
      "Review the approved mockup HTML and JIRA ticket scope. Break work into concrete file-level tasks before coding.",
    );
  } else {
    details.changes.forEach((c, i) => {
      lines.push(`### ${i + 1}. ${c.location}`);
      lines.push(`- **Where:** ${c.location}`);
      if (c.changeType) lines.push(`- **Change type:** ${c.changeType}`);
      if (c.effort) lines.push(`- **Estimated effort:** ${c.effort}`);
      lines.push(`- **What to do:** ${c.description}`);
      if (c.acceptance) lines.push(`- **Acceptance:** ${c.acceptance}`);
      lines.push("");
    });
  }

  if (session?.ticketData?.description) {
    lines.push("## JIRA context");
    lines.push(session.ticketData.description.trim());
    lines.push("");
  }

  lines.push(
    "## Agent instructions",
    "1. Use codebase search / MCP tools to locate the exact Vue components, routes, store modules, and GraphQL operations affected by each change above.",
    "2. For each change, list the files you will modify before editing.",
    "3. Reuse existing Quasar components and design tokens — do not introduce new UI libraries.",
    "4. Add or update i18n keys for any new user-visible strings.",
    "5. Verify the implementation against the approved mockup behaviour.",
    "6. Summarise what was changed and any follow-up items.",
    "",
    `Ticket: ${details.ticketId}`,
  );

  return lines.join("\n");
}

export function reviewFromSession(session: MockupSession): ReviewItem {
  return {
    id: session.id,
    sessionId: session.id,
    userId: session.userId,
    userName: "PM",
    userEmail: "",
    ticketId: session.ticketId,
    ticketSummary: session.ticketData.summary,
    activeHtml: session.activeHtml,
    status: session.status === "pending_review" ? "pending_review" : "reviewed",
    submittedAt: session.savedAt,
  };
}
