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

function SectionLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2.5 px-0.5">
      <p style={{ ...F.body, fontSize: 13, fontWeight: 600, color: COLORS.text }}>{title}</p>
      {hint && (
        <p style={{ ...F.body, fontSize: 12, color: COLORS.muted, marginTop: 2, lineHeight: 1.4 }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function UsageTab({ records, revisions = [], selectedRevisionId }: Props) {
  const totals = sumUsageRecords(records);
  const selectedRevision =
    revisions.find((r) => r.id === selectedRevisionId) ?? revisions[revisions.length - 1];

  const stats = [
    { label: "Input tokens", value: totals.inputTokens.toLocaleString(), sub: "Context + prompts" },
    { label: "Output tokens", value: totals.outputTokens.toLocaleString(), sub: "Generated tokens" },
    { label: "Total cost", value: formatCostUsd(totals.costUsd), sub: "All API calls", accent: true },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {stats.map((card) => (
          <div
            key={card.label}
            className="px-4 py-3.5"
            style={{
              background: COLORS.surface,
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
              boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                ...F.body,
                fontSize: 12,
                fontWeight: 520,
                color: COLORS.muted,
              }}
            >
              {card.label}
            </div>
            <div
              style={{
                ...F.body,
                fontSize: 22,
                fontWeight: 650,
                color: card.accent ? COLORS.accent : COLORS.text,
                marginTop: 6,
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              {card.value}
            </div>
            <div style={{ ...F.body, fontSize: 11, color: COLORS.muted, marginTop: 4 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {revisions.some((r) => r.usage) && (
        <section>
          <SectionLabel
            title="Cost by version"
            hint="Each mock generation or refinement is billed separately"
          />
          <div
            className="p-1.5 space-y-1"
            style={{
              background: COLORS.surface,
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            {revisions.map((r) => {
              const isSelected = selectedRevision?.id === r.id;
              const usage = r.usage;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-3"
                  style={{
                    background: isSelected ? COLORS.accentSoft : "transparent",
                    borderRadius: 12,
                    border: isSelected ? `1px solid ${COLORS.accentBorder}` : "1px solid transparent",
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p
                      className="flex items-center gap-2 flex-wrap"
                      style={{
                        ...F.body,
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 520,
                        color: COLORS.text,
                      }}
                    >
                      <span>
                        v{r.index + 1} · {r.label}
                      </span>
                      {isSelected && (
                        <span
                          className="inline-flex px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: COLORS.surface,
                            color: COLORS.accent,
                            borderRadius: RADIUS.pill,
                            border: `1px solid ${COLORS.accentBorder}`,
                          }}
                        >
                          Viewing
                        </span>
                      )}
                    </p>
                    {usage && (
                      <p style={{ ...F.mono, fontSize: 11, color: COLORS.muted, marginTop: 3 }}>
                        {shortModelName(usage.model)} · {usage.inputTokens.toLocaleString()} in ·{" "}
                        {usage.outputTokens.toLocaleString()} out
                      </p>
                    )}
                  </div>
                  <span
                    className="shrink-0 px-2.5 py-1"
                    style={{
                      ...F.body,
                      fontSize: 13,
                      fontWeight: 600,
                      color: usage ? COLORS.accent : COLORS.muted,
                      background: usage ? COLORS.accentSoft : COLORS.subtle,
                      borderRadius: RADIUS.pill,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {usage ? formatCostUsd(usage.costUsd) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {records.length > 0 ? (
        <section>
          <SectionLabel
            title="Call breakdown"
            hint={`${records.length} API call${records.length !== 1 ? "s" : ""} in this session`}
          />
          <div
            style={{
              background: COLORS.surface,
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
              overflow: "hidden",
            }}
          >
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[640px]">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    {["#", "Label", "Model", "Input", "Output", "Cost", "Time"].map((h) => (
                      <th
                        key={h}
                        className="px-3.5 py-3 text-left"
                        style={{
                          ...F.body,
                          fontSize: 11,
                          fontWeight: 560,
                          color: COLORS.muted,
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr
                      key={`${r.timestamp}-${i}`}
                      className="transition-colors hover:bg-black/[0.02]"
                      style={{
                        borderBottom:
                          i < records.length - 1 ? `1px solid ${COLORS.border}` : undefined,
                      }}
                    >
                      <td className="px-3.5 py-3" style={{ ...F.mono, fontSize: 11, color: COLORS.muted }}>
                        {i + 1}
                      </td>
                      <td className="px-3.5 py-3 max-w-[180px]">
                        <span
                          className="block truncate"
                          title={r.label}
                          style={{ ...F.body, fontSize: 13, fontWeight: 520, color: COLORS.text }}
                        >
                          {r.label}
                        </span>
                      </td>
                      <td className="px-3.5 py-3">
                        <span
                          className="inline-flex px-2 py-0.5"
                          style={{
                            ...F.mono,
                            fontSize: 11,
                            color: COLORS.text,
                            background: COLORS.subtle,
                            borderRadius: RADIUS.pill,
                          }}
                        >
                          {shortModelName(r.model)}
                        </span>
                      </td>
                      <td className="px-3.5 py-3" style={{ ...F.mono, fontSize: 12, color: COLORS.text }}>
                        {r.inputTokens.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-3" style={{ ...F.mono, fontSize: 12, color: COLORS.text }}>
                        {r.outputTokens.toLocaleString()}
                      </td>
                      <td className="px-3.5 py-3">
                        <span
                          style={{
                            ...F.body,
                            fontSize: 13,
                            fontWeight: 600,
                            color: COLORS.accent,
                          }}
                        >
                          {formatCostUsd(r.costUsd)}
                        </span>
                      </td>
                      <td className="px-3.5 py-3" style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
                        {new Date(r.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <div
          className="py-12 text-center px-4"
          style={{
            ...F.body,
            fontSize: 14,
            color: COLORS.muted,
            background: COLORS.surface,
            borderRadius: 16,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          Usage data appears after the first mock generation
        </div>
      )}
    </div>
  );
}
