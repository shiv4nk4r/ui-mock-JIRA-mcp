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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: "rgba(29, 29, 31, 0.28)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
        aria-label="Close cost breakdown"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mock-cost-title"
        className="relative w-full max-w-3xl max-h-[min(90dvh,820px)] flex flex-col overflow-hidden"
        style={{
          background: COLORS.surface,
          borderRadius: RADIUS.lg,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-32"
          style={{
            background:
              "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(217,119,6,0.1) 0%, transparent 70%)",
          }}
        />

        <div
          className="relative flex-none flex items-start justify-between gap-4 px-6 pt-6 pb-5"
          style={{ borderBottom: `1px solid ${COLORS.border}` }}
        >
          <div className="min-w-0 space-y-2">
            <p
              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold"
              style={{
                background: COLORS.accentSoft,
                color: COLORS.accent,
                borderRadius: RADIUS.pill,
                ...F.body,
              }}
            >
              Cost
            </p>
            <h2
              id="mock-cost-title"
              style={{
                ...F.body,
                fontSize: 22,
                fontWeight: 560,
                color: COLORS.text,
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
              }}
            >
              Mock cost breakdown
            </h2>
            <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, lineHeight: 1.45 }}>
              {ticketLabel ? (
                <>
                  {ticketLabel}
                  <span className="mx-1.5" style={{ opacity: 0.45 }}>
                    ·
                  </span>
                </>
              ) : null}
              Session total{" "}
              <span style={{ color: COLORS.accent, fontWeight: 600 }}>{formatCostUsd(totals.costUsd)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center shrink-0 hover:bg-black/5 transition-colors"
            aria-label="Close"
            style={{
              borderRadius: RADIUS.pill,
              ...F.body,
              fontSize: 20,
              color: COLORS.muted,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto min-h-0 px-6 py-5" style={{ background: COLORS.bg }}>
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
      className="inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[rgba(217,119,6,0.16)] transition-colors"
      style={{
        ...F.body,
        fontSize: 13,
        fontWeight: 600,
        color: COLORS.accent,
        background: COLORS.accentSoft,
        border: `1px solid ${COLORS.accentBorder}`,
        borderRadius: RADIUS.pill,
        padding: "8px 12px",
      }}
      title="View cost breakdown"
    >
      {formatCostUsd(costUsd)}
    </button>
  );
}
