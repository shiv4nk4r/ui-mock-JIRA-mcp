"use client";

import type { ExecutionDetails } from "@lib/utils/execution-details";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

const CHANGE_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  add: { bg: "rgba(52,199,89,0.12)", color: "#248A3D" },
  modify: { bg: "rgba(255,149,0,0.12)", color: "#C93400" },
  delete: { bg: "rgba(255,59,48,0.1)", color: "#D70015" },
  configure: { bg: "rgba(0,122,255,0.1)", color: "#0040DD" },
};

function normalizeChangeType(type?: string): string {
  if (!type) return "";
  return type.split(/[/,]/)[0].trim().toLowerCase();
}

function changeTypeStyle(type?: string) {
  const key = normalizeChangeType(type);
  if (key.includes("add")) return CHANGE_TYPE_COLORS.add;
  if (key.includes("modif")) return CHANGE_TYPE_COLORS.modify;
  if (key.includes("delet")) return CHANGE_TYPE_COLORS.delete;
  if (key.includes("config")) return CHANGE_TYPE_COLORS.configure;
  return { bg: COLORS.subtle, color: COLORS.muted };
}

/** File/area changes as a compact table — used in the implementation plan modal. */
export function ChangesByFileTable({ details }: { details: ExecutionDetails }) {
  const fileChanges = details.changes.filter((c) => c.source === "change_log");
  const rows = fileChanges.length > 0 ? fileChanges : details.changes.filter((c) => c.source === "effort");

  if (rows.length === 0) {
    return (
      <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
        No structured file breakdown yet. Regenerate the mockup, then resubmit so effort and the change log are captured.
      </p>
    );
  }

  const isFileTable = fileChanges.length > 0;

  return (
    <div className="w-full">
      <table className="w-full text-left border-collapse table-fixed" style={{ ...F.body, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            <th className="py-2 pr-3 font-semibold" style={{ color: COLORS.muted, width: 36 }}>
              #
            </th>
            <th
              className="py-2 pr-3 font-semibold"
              style={{ color: COLORS.muted, width: isFileTable ? "28%" : "32%" }}
            >
              {isFileTable ? "File / route" : "Area"}
            </th>
            {isFileTable && (
              <th className="py-2 pr-3 font-semibold" style={{ color: COLORS.muted, width: "14%" }}>
                Type
              </th>
            )}
            <th className="py-2 pr-3 font-semibold" style={{ color: COLORS.muted }}>
              {isFileTable ? "What to change" : "Effort"}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const typeStyle = changeTypeStyle(row.changeType);
            return (
              <tr key={row.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td className="py-2.5 pr-3 align-top" style={{ color: COLORS.muted }}>
                  {idx + 1}
                </td>
                <td
                  className="py-2.5 pr-3 align-top font-mono text-xs break-words"
                  style={{
                    color: COLORS.accent,
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    whiteSpace: "normal",
                    lineHeight: 1.45,
                  }}
                >
                  {row.location}
                </td>
                {isFileTable && (
                  <td className="py-2.5 pr-3 align-top">
                    {row.changeType && (
                      <span
                        className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide break-words"
                        style={{
                          background: typeStyle.bg,
                          color: typeStyle.color,
                          borderRadius: RADIUS.pill,
                          whiteSpace: "normal",
                          lineHeight: 1.3,
                        }}
                      >
                        {row.changeType}
                      </span>
                    )}
                  </td>
                )}
                <td
                  className="py-2.5 pr-3 align-top break-words"
                  style={{
                    color: COLORS.text,
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                    overflowWrap: "anywhere",
                    whiteSpace: "normal",
                  }}
                >
                  {!isFileTable && row.effort && (
                    <span className="block mb-1 font-semibold" style={{ color: COLORS.muted, fontSize: 12 }}>
                      {row.effort}
                    </span>
                  )}
                  {row.description}
                  {row.acceptance && (
                    <span className="block mt-1" style={{ color: COLORS.muted, fontSize: 12 }}>
                      ✓ {row.acceptance}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
