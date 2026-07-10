"use client";

import { F } from "@lib/design/tokens";
import type { UsageRecord } from "@lib/types";

export function UsageTab({ records }: { records: UsageRecord[] }) {
  const totals = records.reduce(
    (acc, r) => ({ in: acc.in + r.inputTokens, out: acc.out + r.outputTokens, cost: acc.cost + r.costUsd }),
    { in: 0, out: 0, cost: 0 },
  );

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Input Tokens", value: totals.in.toLocaleString() },
          { label: "Output Tokens", value: totals.out.toLocaleString() },
          { label: "Cost (USD)", value: `$${totals.cost.toFixed(6)}` },
        ].map((card) => (
          <div key={card.label} className="border p-4" style={{ borderColor: "#D0CCC6", background: "#FFFFFF" }}>
            <div style={{ ...F.condensed, fontSize: 9, color: "#A8A4A0", letterSpacing: "0.2em", textTransform: "uppercase" }}>{card.label}</div>
            <div style={{ ...F.display, fontSize: 26, color: "#D97706" }}>{card.value}</div>
          </div>
        ))}
      </div>
      {records.length === 0 && (
        <div className="py-12 text-center" style={{ ...F.condensed, color: "#A8A4A0" }}>No usage data yet</div>
      )}
    </div>
  );
}
