"use client";

import { useState } from "react";
import { F } from "@lib/design/tokens";

export function ThinkingBlock({
  log,
  done,
  elapsed,
  showMcp = true,
}: {
  log: string[];
  done: boolean;
  elapsed?: number;
  showMcp?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const latest = log[log.length - 1] ?? "Processing…";

  if (!done) {
    return (
      <div
        className="flex items-start gap-3 px-4 py-3 border-l-2 mb-2"
        style={{ borderLeftColor: "#D0CCC6", background: "#FFFFFF" }}
      >
        <div className="signal-bars flex-none" style={{ marginTop: 3 }}>
          <span /><span /><span /><span /><span />
        </div>
        <div>
          <div
            style={{
              ...F.condensed,
              fontSize: 10,
              color: "#6A6560",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              marginBottom: 3,
            }}
          >
            Thinking
          </div>
          <div style={{ ...F.body, fontSize: 12, color: "#8A8680", lineHeight: "1.4" }}>{latest}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-l-2 mb-2 overflow-hidden" style={{ borderLeftColor: "#E2DDD8" }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left"
        style={{ background: "#FFFFFF" }}
      >
        <span style={{ color: "#A8A4A0", fontSize: 9 }}>{expanded ? "▾" : "▸"}</span>
        <span style={{ ...F.mono, fontSize: 10, color: "#8A8680", letterSpacing: "0.05em" }}>
          Thought for {elapsed?.toFixed(1)}s
        </span>
        {showMcp && log.length > 0 && (
          <span style={{ ...F.condensed, fontSize: 10, color: "#C4C0BA", letterSpacing: "0.08em" }}>
            · {log.length} step{log.length !== 1 ? "s" : ""}
          </span>
        )}
      </button>
      {expanded && (
        <div className="px-4 py-2 space-y-1.5" style={{ background: "#EDEBE8", borderTop: "1px solid #E2DDD8" }}>
          {log.map((entry, i) => (
            <div key={i} className="flex items-start gap-2">
              <span style={{ color: "#C4C0BA", fontSize: 10, marginTop: 1, flexShrink: 0 }}>›</span>
              <span style={{ ...F.body, fontSize: 11, color: "#706C68", lineHeight: "1.45" }}>{entry}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
