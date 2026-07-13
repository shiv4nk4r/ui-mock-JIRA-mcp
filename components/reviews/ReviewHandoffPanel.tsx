"use client";

import { useState } from "react";
import type { ExecutionDetails } from "@lib/utils/execution-details";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { EffortMarkdown } from "@/components/chat/ChatMarkdown";

interface Props {
  details: ExecutionDetails;
  effortMarkdown?: string;
  onOpenFullPlan?: () => void;
  variant?: "sidebar" | "strip";
}

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

function BucketBadges({ details }: { details: ExecutionDetails }) {
  const fileChanges = details.changes.filter((c) => c.source === "change_log");
  const fileCount = fileChanges.length || details.changes.length;

  return (
    <div className="flex flex-wrap gap-2">
      {details.tshirtSize && (
        <Badge label="Bucket" value={details.tshirtSize.replace(/^\[/, "").replace(/\]$/, "").trim()} accent />
      )}
      {details.storyPoints && (
        <Badge label="Points" value={details.storyPoints.replace(/^\[/, "").replace(/\]$/, "").trim()} />
      )}
      {details.riskFactor && (
        <Badge label="Risk" value={details.riskFactor.split(/[—–-]/)[0].replace(/^\[/, "").replace(/\]$/, "").trim()} />
      )}
      {fileCount > 0 && (
        <Badge label="Files" value={`${fileCount} change${fileCount === 1 ? "" : "s"}`} />
      )}
    </div>
  );
}

function FileChangesTable({ details }: { details: ExecutionDetails }) {
  const fileChanges = details.changes.filter((c) => c.source === "change_log");
  const rows = fileChanges.length > 0 ? fileChanges : details.changes.filter((c) => c.source === "effort");

  if (rows.length === 0) {
    return (
      <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
        No structured file breakdown yet. Regenerate the mockup (initial generation, not a refinement), then
        resubmit for review so effort estimation and the implementation change log are captured.
      </p>
    );
  }

  const isFileTable = fileChanges.length > 0;

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-left border-collapse" style={{ ...F.body, fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
            <th className="py-2 pr-3 font-semibold" style={{ color: COLORS.muted, width: 28 }}>#</th>
            <th className="py-2 pr-3 font-semibold whitespace-nowrap" style={{ color: COLORS.muted }}>
              {isFileTable ? "File / route" : "Area"}
            </th>
            {isFileTable && (
              <th className="py-2 pr-3 font-semibold whitespace-nowrap" style={{ color: COLORS.muted }}>
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
                <td className="py-2.5 pr-3 align-top" style={{ color: COLORS.muted }}>{idx + 1}</td>
                <td className="py-2.5 pr-3 align-top font-mono text-xs" style={{ color: COLORS.accent, maxWidth: 160 }}>
                  {row.location}
                </td>
                {isFileTable && (
                  <td className="py-2.5 pr-3 align-top whitespace-nowrap">
                    {row.changeType && (
                      <span
                        className="inline-block px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                        style={{ background: typeStyle.bg, color: typeStyle.color, borderRadius: RADIUS.pill }}
                      >
                        {row.changeType}
                      </span>
                    )}
                  </td>
                )}
                <td className="py-2.5 pr-3 align-top" style={{ color: COLORS.text, lineHeight: 1.45 }}>
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

export function ReviewHandoffPanel({
  details,
  effortMarkdown,
  onOpenFullPlan,
  variant = "sidebar",
}: Props) {
  const [expanded, setExpanded] = useState(variant === "sidebar");

  if (variant === "strip") {
    return (
      <div
        className="flex-none border-b"
        style={{ background: COLORS.surface, borderColor: COLORS.border }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left"
        >
          <div className="flex-1 min-w-0 space-y-2">
            <p style={{ ...F.body, fontSize: 13, fontWeight: 600, color: COLORS.text }}>
              Engineering handoff
            </p>
            <BucketBadges details={details} />
          </div>
          <span style={{ ...F.body, fontSize: 18, color: COLORS.muted, lineHeight: 1 }}>
            {expanded ? "▾" : "▸"}
          </span>
        </button>
        {expanded && (
          <div className="px-4 pb-4 space-y-4 max-h-[40vh] overflow-y-auto">
            <FileChangesTable details={details} />
            {onOpenFullPlan && (
              <button
                type="button"
                onClick={onOpenFullPlan}
                className="text-sm font-semibold"
                style={{ color: COLORS.accent }}
              >
                Open full implementation plan →
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside
      className="flex-none w-full lg:w-[400px] xl:w-[440px] flex flex-col border-l min-h-0 overflow-hidden"
      style={{ background: COLORS.surface, borderColor: COLORS.border }}
    >
      <div className="flex-none px-4 py-4 border-b space-y-3" style={{ borderColor: COLORS.border }}>
        <div>
          <h2 style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>
            Engineering handoff
          </h2>
          <p style={{ ...F.body, fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
            Bucket size, effort, and file-level changes for this story
          </p>
        </div>
        <BucketBadges details={details} />
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">
        <div>
          <h3 style={{ ...F.body, fontSize: 13, fontWeight: 600, color: COLORS.text, marginBottom: 8 }}>
            Changes by file
          </h3>
          <FileChangesTable details={details} />
        </div>

        {effortMarkdown && (
          <details>
            <summary
              className="cursor-pointer text-sm font-medium"
              style={{ ...F.body, color: COLORS.muted }}
            >
              Full effort breakdown
            </summary>
            <div className="mt-2 p-3" style={{ background: COLORS.subtle, borderRadius: RADIUS.md }}>
              <EffortMarkdown text={effortMarkdown} />
            </div>
          </details>
        )}

        {onOpenFullPlan && (
          <button
            type="button"
            onClick={onOpenFullPlan}
            className="w-full px-4 py-2.5 text-sm font-semibold"
            style={{
              background: COLORS.subtle,
              color: COLORS.text,
              borderRadius: RADIUS.pill,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            Agent prompt & full plan
          </button>
        )}
      </div>
    </aside>
  );
}

function Badge({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs"
      style={{
        background: accent ? COLORS.accentSoft : COLORS.subtle,
        borderRadius: RADIUS.pill,
        border: `1px solid ${accent ? "rgba(255,149,0,0.25)" : COLORS.border}`,
      }}
    >
      <span style={{ ...F.body, color: COLORS.muted }}>{label}</span>
      <span style={{ ...F.body, fontWeight: 600, color: accent ? COLORS.accent : COLORS.text }}>{value}</span>
    </span>
  );
}

export function ReviewHandoffBadges({ details }: { details: ExecutionDetails }) {
  if (!details.hasEffortData && details.changes.length === 0) return null;
  return <BucketBadges details={details} />;
}
