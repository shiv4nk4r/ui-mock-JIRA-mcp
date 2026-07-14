"use client";

import type { ExecutionDetails } from "@lib/utils/execution-details";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

interface Props {
  details: ExecutionDetails;
  onOpenFullPlan?: () => void;
}

function BucketBadges({ details, compact }: { details: ExecutionDetails; compact?: boolean }) {
  const fileChanges = details.changes.filter((c) => c.source === "change_log");
  const fileCount = fileChanges.length || details.changes.length;

  return (
    <div className={`flex flex-wrap ${compact ? "gap-1.5" : "gap-2"}`}>
      {details.tshirtSize && (
        <Badge
          label="Bucket"
          value={details.tshirtSize.replace(/^\[/, "").replace(/\]$/, "").trim()}
          accent
          compact={compact}
        />
      )}
      {details.storyPoints && (
        <Badge
          label="Points"
          value={details.storyPoints.replace(/^\[/, "").replace(/\]$/, "").trim()}
          compact={compact}
        />
      )}
      {details.riskFactor && (
        <Badge
          label="Risk"
          value={details.riskFactor.split(/[—–-]/)[0].replace(/^\[/, "").replace(/\]$/, "").trim()}
          compact={compact}
        />
      )}
      {fileCount > 0 && (
        <Badge label="Files" value={`${fileCount}`} compact={compact} />
      )}
    </div>
  );
}

/** Slim bar — sizing chips only; full file table lives in the implementation plan modal. */
export function ReviewHandoffPanel({ details, onOpenFullPlan }: Props) {
  return (
    <button
      type="button"
      onClick={() => onOpenFullPlan?.()}
      className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-black/[0.03]"
      style={{
        background: COLORS.subtle,
        borderBottom: `1px solid ${COLORS.border}`,
      }}
      title="Open implementation plan"
    >
      <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
        <span style={{ ...F.body, fontSize: 13, fontWeight: 520, color: COLORS.text }}>
          GCC handoff
        </span>
        <BucketBadges details={details} compact />
      </div>
      <span
        className="shrink-0 text-sm"
        style={{ ...F.body, color: COLORS.muted }}
      >
        Plan ›
      </span>
    </button>
  );
}

function Badge({
  label,
  value,
  accent,
  compact,
}: {
  label: string;
  value: string;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center ${compact ? "gap-1 px-2 py-0.5" : "gap-1.5 px-2.5 py-1"} text-xs`}
      style={{
        background: accent ? COLORS.accentSoft : "rgba(255,255,255,0.7)",
        borderRadius: RADIUS.pill,
        border: `1px solid ${accent ? "rgba(255,149,0,0.2)" : COLORS.border}`,
      }}
    >
      <span style={{ ...F.body, fontSize: compact ? 10 : 12, color: COLORS.muted }}>{label}</span>
      <span
        style={{
          ...F.body,
          fontWeight: 560,
          color: accent ? COLORS.accent : COLORS.text,
          fontSize: compact ? 11 : 12,
        }}
      >
        {value}
      </span>
    </span>
  );
}

export function ReviewHandoffBadges({ details }: { details: ExecutionDetails }) {
  if (!details.hasEffortData && details.changes.length === 0) return null;
  return <BucketBadges details={details} />;
}
