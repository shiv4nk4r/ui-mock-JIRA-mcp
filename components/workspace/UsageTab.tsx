"use client";

import type { UsageRecord } from "@lib/types";
import type { MockRevision } from "@lib/utils/session-history";
import { formatCostUsd, sumUsageRecords, shortModelName } from "@lib/utils/usage-cost";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

interface Props {
  records: UsageRecord[];
  revisions?: MockRevision[];
  selectedRevisionId?: string | null;
}

export function UsageTab({ records, revisions = [], selectedRevisionId }: Props) {
  const totals = sumUsageRecords(records);
  const selectedRevision = revisions.find((r) => r.id === selectedRevisionId) ?? revisions[revisions.length - 1];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Input tokens", value: totals.inputTokens.toLocaleString(), sub: "Context + prompts" },
          { label: "Output tokens", value: totals.outputTokens.toLocaleString(), sub: "Generated tokens" },
          { label: "Total cost", value: formatCostUsd(totals.costUsd), sub: "All API calls" },
        ].map((card) => (
          <div
            key={card.label}
            className="p-4"
            style={{ background: COLORS.subtle, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}
          >
            <div style={{ ...F.body, fontSize: 11, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {card.label}
            </div>
            <div style={{ ...F.body, fontSize: 22, fontWeight: 700, color: COLORS.accent, marginTop: 4, lineHeight: 1.2 }}>
              {card.value}
            </div>
            <div style={{ ...F.body, fontSize: 11, color: COLORS.muted, marginTop: 2 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {revisions.some((r) => r.usage) && (
        <div style={{ borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
          <div className="px-4 py-2.5 border-b" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
            <p style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.text }}>Cost by version</p>
            <p style={{ ...F.body, fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
              Each mock generation or refinement is billed separately
            </p>
          </div>
          <div className="divide-y" style={{ borderColor: COLORS.border }}>
            {revisions.map((r) => {
              const isSelected = selectedRevision?.id === r.id;
              const usage = r.usage;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={{ background: isSelected ? COLORS.accentSoft : COLORS.surface }}
                >
                  <div className="min-w-0 flex-1">
                    <p style={{ ...F.body, fontSize: 13, fontWeight: isSelected ? 600 : 500, color: COLORS.text }}>
                      v{r.index + 1} · {r.label}
                      {isSelected && (
                        <span style={{ ...F.body, fontSize: 11, color: COLORS.accent, marginLeft: 6 }}>viewing</span>
                      )}
                    </p>
                    {usage && (
                      <p style={{ ...F.mono, fontSize: 11, color: COLORS.muted, marginTop: 2 }}>
                        {shortModelName(usage.model)} · {usage.inputTokens.toLocaleString()} in · {usage.outputTokens.toLocaleString()} out
                      </p>
                    )}
                  </div>
                  <span style={{ ...F.mono, fontSize: 13, fontWeight: 600, color: usage ? COLORS.accent : COLORS.muted, whiteSpace: "nowrap" }}>
                    {usage ? formatCostUsd(usage.costUsd) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {records.length > 0 ? (
        <div style={{ borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, overflow: "hidden" }}>
          <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
            <span style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.text }}>Call breakdown</span>
            <span style={{ ...F.mono, fontSize: 11, color: COLORS.muted }}>
              ({records.length} call{records.length !== 1 ? "s" : ""})
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[640px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.subtle }}>
                  {["#", "Label", "Model", "Input", "Output", "Cost", "Time"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-left"
                      style={{ ...F.body, fontSize: 10, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.05em" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={`${r.timestamp}-${i}`} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <td className="px-3 py-2" style={{ ...F.mono, fontSize: 11, color: COLORS.muted }}>{i + 1}</td>
                    <td className="px-3 py-2 max-w-[180px]">
                      <span className="block truncate" title={r.label} style={{ ...F.body, fontSize: 12, color: COLORS.text }}>
                        {r.label}
                      </span>
                    </td>
                    <td className="px-3 py-2" style={{ ...F.mono, fontSize: 11, color: COLORS.muted }}>{shortModelName(r.model)}</td>
                    <td className="px-3 py-2" style={{ ...F.mono, fontSize: 11, color: COLORS.text }}>{r.inputTokens.toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ ...F.mono, fontSize: 11, color: COLORS.text }}>{r.outputTokens.toLocaleString()}</td>
                    <td className="px-3 py-2" style={{ ...F.mono, fontSize: 11, color: COLORS.accent, fontWeight: 600 }}>
                      {formatCostUsd(r.costUsd)}
                    </td>
                    <td className="px-3 py-2" style={{ ...F.body, fontSize: 11, color: COLORS.muted }}>
                      {new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-10 text-center" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
          Usage data appears after the first mock generation
        </div>
      )}
    </div>
  );
}
