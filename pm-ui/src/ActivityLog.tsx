"use client";

import { useEffect, useRef, useState } from "react";
import type { ActivityEntry } from "./activity-log";
import { activityToDisplayText } from "./activity-log";

const KIND_LABEL: Record<ActivityEntry["kind"], string> = {
  thinking: "Thinking",
  mcp: "MCP",
  status: "Status",
};

const KIND_COLOR: Record<ActivityEntry["kind"], string> = {
  thinking: "#8A8680",
  mcp: "#D97706",
  status: "#6A6560",
};

function badgeLabel(entry: ActivityEntry): string {
  if (entry.kind === "mcp" && entry.tool) return entry.tool;
  return KIND_LABEL[entry.kind] ?? "Status";
}

function entryBody(entry: ActivityEntry): string {
  const text = entry.text ?? "";
  if (entry.kind === "thinking") return text;
  if (entry.kind === "mcp") {
    const args = entry.args && Object.keys(entry.args).length
      ? `\n${JSON.stringify(entry.args, null, 2)}`
      : "";
    return args || text;
  }
  return text;
}

function ActivityLogEntry({ entry, active }: { entry: ActivityEntry; active?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const body = entryBody(entry);
  const lines = body.split("\n");
  const collapsible = lines.length > 4;

  return (
    <div className="flex items-start gap-2.5">
      <span
        className="flex-none px-1.5 py-0.5 rounded"
        style={{
          fontFamily: "'Barlow Condensed',sans-serif",
          fontSize: 9,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: active ? "#D97706" : (KIND_COLOR[entry.kind] ?? "#8A8680"),
          background: entry.kind === "mcp" ? "rgba(217,119,6,0.08)" : "rgba(132,122,112,0.08)",
          marginTop: 1,
        }}
      >
        {badgeLabel(entry)}
      </span>
      <div className="flex-1 min-w-0">
        {entry.kind === "thinking" ? (
          <>
            <div
              className="whitespace-pre-wrap"
              style={{
                fontFamily: "'Barlow',sans-serif",
                fontSize: 12,
                color: active ? "#4A4540" : "#8A8680",
                lineHeight: 1.5,
                maxHeight: !expanded && collapsible ? "6em" : undefined,
                overflow: !expanded && collapsible ? "hidden" : undefined,
              }}
            >
              {expanded || !collapsible ? body : `${lines.slice(0, 3).join("\n")}`}
            </div>
            {collapsible && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5"
                style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 9, color: "#A8A4A0", letterSpacing: "0.1em" }}
              >
                {expanded ? "show less" : `show all (${lines.length} lines)`}
              </button>
            )}
          </>
        ) : (
          <pre
            className="whitespace-pre-wrap m-0"
            style={{
              fontFamily: "'Fira Code',monospace",
              fontSize: 10.5,
              color: active ? "#4A4540" : "#8A8680",
              lineHeight: 1.45,
            }}
          >
            {body || activityToDisplayText(entry)}
          </pre>
        )}
      </div>
    </div>
  );
}

export function ActivityLog({
  entries,
  maxHeight = "50vh",
  autoScroll = false,
}: {
  entries: ActivityEntry[];
  maxHeight?: string | number;
  autoScroll?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [entries, autoScroll]);

  if (!entries.length) {
    return (
      <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, color: "#C4C0BA", letterSpacing: "0.15em" }}>
        Initialising…
      </div>
    );
  }

  return (
    <div ref={ref} className="space-y-2 overflow-y-auto" style={{ maxHeight }}>
      {entries.map((entry, i) => (
        <ActivityLogEntry key={`${entry.ts}-${i}`} entry={entry} active={i === entries.length - 1} />
      ))}
    </div>
  );
}
