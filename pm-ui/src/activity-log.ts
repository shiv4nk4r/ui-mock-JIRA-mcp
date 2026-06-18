/** Structured activity log entries streamed from chat API to the UI. */

export type ActivityKind = "status" | "thinking" | "mcp";

export interface ActivityEntry {
  kind: ActivityKind;
  text: string;
  tool?: string;
  args?: Record<string, unknown>;
  ts: number;
}

export function formatMcpActivity(tool: string, args?: Record<string, unknown>): string {
  const shortTool = tool.replace(/^mcp__[^_]+__/, "");
  if (!args || !Object.keys(args).length) return `MCP: ${shortTool}`;
  return `MCP: ${shortTool} ${JSON.stringify(args)}`;
}

/** Coerce streamed / persisted activity payloads into a safe entry shape. */
export function normalizeActivityEntry(raw: Partial<ActivityEntry> & { text?: unknown }): ActivityEntry {
  const text = typeof raw.text === "string" ? raw.text : "";
  let kind = raw.kind;
  if (kind !== "thinking" && kind !== "mcp" && kind !== "status") {
    if (raw.tool || text.startsWith("MCP:")) kind = "mcp";
    else if (text.startsWith("Thinking:")) kind = "thinking";
    else kind = "status";
  }
  const normalized: ActivityEntry = {
    kind,
    text: kind === "thinking" ? text.replace(/^Thinking:\s*/, "") : text,
    ts: typeof raw.ts === "number" ? raw.ts : Date.now(),
  };
  if (raw.tool) normalized.tool = raw.tool;
  if (raw.args) normalized.args = raw.args;
  return normalized;
}

export function activityToDisplayText(entry: ActivityEntry): string {
  const text = entry.text ?? "";
  if (entry.kind === "mcp") return formatMcpActivity(entry.tool ?? "unknown", entry.args);
  if (entry.kind === "status") return text;
  return text.startsWith("Thinking:") ? text : `Thinking: ${text}`;
}

const PLANNING_RE = /^(Let me|Now I need|Good,?|Great!?|The user|Okay,?)\b/i;

/** Skip noisy duplicate planning lines; never truncate content. */
export function shouldAppendActivity(entries: ActivityEntry[], next: ActivityEntry): boolean {
  const nextText = activityToDisplayText(next);
  const last = entries[entries.length - 1];
  if (last && activityToDisplayText(last) === nextText) return false;

  if (next.kind === "thinking" && entries.length > 0) {
    const lastKind = entries[entries.length - 1]?.kind;
    const nextTextBody = next.text ?? "";
    if (lastKind === "mcp" && nextTextBody && PLANNING_RE.test(nextTextBody)) return false;
  }
  return true;
}

export function appendActivity(entries: ActivityEntry[], next: ActivityEntry): ActivityEntry[] {
  const normalized = normalizeActivityEntry(next);
  if (!shouldAppendActivity(entries, normalized)) return entries;
  return [...entries, normalized];
}

/** @deprecated Use activity entries — kept for backward compat during stream migration */
export function entriesToThinkingStrings(entries: ActivityEntry[]): string[] {
  return entries.map(activityToDisplayText);
}
