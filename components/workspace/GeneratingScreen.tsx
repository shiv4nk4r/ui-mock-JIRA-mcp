"use client";

import { useRef, useEffect } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

export function GeneratingScreen({
  ticketId,
  summary,
  model,
  thinkingLog,
}: {
  ticketId: string;
  summary: string;
  model: string;
  thinkingLog: string[];
}) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [thinkingLog]);

  return (
    <div className="h-screen flex flex-col items-center justify-center px-6" style={{ background: COLORS.bg }}>
      <div
        className="w-full max-w-md p-8 text-center space-y-6"
        style={{ background: COLORS.surface, borderRadius: RADIUS.lg, boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}
      >
        <div className="signal-bars mx-auto"><span /><span /><span /><span /><span /></div>
        <div>
          <h1 style={{ ...F.body, fontSize: 22, fontWeight: 600, color: COLORS.text, letterSpacing: "-0.02em" }}>
            Creating your mockup
          </h1>
          <p className="mt-2" style={{ ...F.body, fontSize: 15, color: COLORS.muted }}>{summary}</p>
          <p style={{ ...F.mono, fontSize: 13, color: COLORS.accent, marginTop: 8 }}>{ticketId}</p>
        </div>
        <div ref={logRef} className="text-left space-y-2 max-h-40 overflow-y-auto px-2">
          {thinkingLog.map((entry, i) => (
            <div key={i} style={{ ...F.body, fontSize: 13, color: i === thinkingLog.length - 1 ? COLORS.text : COLORS.muted }}>
              {entry}
            </div>
          ))}
        </div>
        <p style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>Usually takes 30–90 seconds</p>
      </div>
    </div>
  );
}
