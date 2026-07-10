import type { Message, MockupSession } from "@lib/types";

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export interface PmRevisionEntry {
  id: string;
  prompt: string;
  timestamp?: number;
}

export function extractPmRevisions(session: MockupSession | null): PmRevisionEntry[] {
  if (!session) return [];
  const entries: PmRevisionEntry[] = [];
  const usage = session.usageRecords ?? [];
  let usageIdx = 0;

  for (let i = 0; i < session.messages.length; i++) {
    const msg = session.messages[i];
    if (msg.role !== "user") continue;
    const text = msg.text?.trim();
    if (!text || text.startsWith("Auto-generate UI mockup")) continue;
    entries.push({
      id: `rev-${entries.length}`,
      prompt: text,
      timestamp: usage[usageIdx]?.timestamp,
    });
    usageIdx += 1;
  }
  return entries;
}

export function initialMockLabel(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  if (first?.text?.startsWith("Auto-generate")) {
    const match = first.text.match(/"(.+?)"/);
    return match?.[1] ?? "Initial mockup submitted";
  }
  return "Initial mockup submitted";
}
