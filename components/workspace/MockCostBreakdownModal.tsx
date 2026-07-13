"use client";

import type { UsageRecord } from "@lib/types";
import type { MockRevision } from "@lib/utils/session-history";
import { formatCostUsd, sumUsageRecords } from "@lib/utils/usage-cost";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { UsageTab } from "@/components/workspace/UsageTab";

interface Props {
  open: boolean;
  onClose: () => void;
  records: UsageRecord[];
  revisions?: MockRevision[];
  selectedRevisionId?: string | null;
  ticketLabel?: string;
}

export function MockCostBreakdownModal({
  open,
  onClose,
  records,
  revisions = [],
  selectedRevisionId,
  ticketLabel,
}: Props) {
  if (!open) return null;

  const totals = sumUsageRecords(records);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close cost breakdown"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mock-cost-title"
        className="relative w-full max-w-3xl max-h-[min(90dvh,820px)] flex flex-col shadow-xl overflow-hidden"
        style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
      >
        <div
          className="flex-none flex items-start justify-between gap-3 px-5 py-4 border-b"
          style={{ borderColor: COLORS.border }}
        >
          <div>
            <h2 id="mock-cost-title" style={{ ...F.body, fontSize: 18, fontWeight: 600, color: COLORS.text }}>
              Mock cost breakdown
            </h2>
            <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
              {ticketLabel ? `${ticketLabel} · ` : ""}
              Session total {formatCostUsd(totals.costUsd)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 shrink-0"
            aria-label="Close"
            style={{ ...F.body, fontSize: 20, color: COLORS.muted, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-5">
          <UsageTab records={records} revisions={revisions} selectedRevisionId={selectedRevisionId} />
        </div>
      </div>
    </div>
  );
}

export function MockCostBadge({
  costUsd,
  onClick,
  disabled,
}: {
  costUsd: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        ...F.body,
        fontSize: 13,
        fontWeight: 600,
        color: COLORS.accent,
        background: COLORS.accentSoft,
        border: `1px solid rgba(217,119,6,0.25)`,
        borderRadius: RADIUS.pill,
        padding: "8px 12px",
      }}
      title="View cost breakdown"
    >
      {formatCostUsd(costUsd)}
    </button>
  );
}
