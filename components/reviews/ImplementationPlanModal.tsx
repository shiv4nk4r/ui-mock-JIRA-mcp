"use client";

import type { ExecutionDetails } from "@lib/utils/execution-details";
import type { MockupSession, ReviewItem } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { ExecutionDetailsPanel } from "@/components/reviews/ExecutionDetailsPanel";

interface Props {
  open: boolean;
  onClose: () => void;
  review: ReviewItem;
  session: MockupSession | null;
  details: ExecutionDetails;
  effortMarkdown?: string;
}

export function ImplementationPlanIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

export function ImplementationPlanModal({
  open,
  onClose,
  review,
  session,
  details,
  effortMarkdown,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: "rgba(29, 29, 31, 0.28)", backdropFilter: "blur(6px)" }}
        onClick={onClose}
        aria-label="Close implementation plan"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="implementation-plan-title"
        className="relative w-full max-w-4xl max-h-[min(90dvh,860px)] flex flex-col overflow-hidden"
        style={{
          background: COLORS.surface,
          borderRadius: RADIUS.lg,
          border: `1px solid ${COLORS.border}`,
          boxShadow: "0 24px 64px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-28"
          style={{
            background:
              "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(217,119,6,0.1) 0%, transparent 70%)",
          }}
        />

        <div
          className="relative flex-none flex items-start justify-between gap-4 px-6 pt-6 pb-4"
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
              Plan
            </p>
            <h2
              id="implementation-plan-title"
              style={{
                ...F.body,
                fontSize: 22,
                fontWeight: 560,
                color: COLORS.text,
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
              }}
            >
              Implementation plan
            </h2>
            <p
              className="break-words"
              style={{
                ...F.body,
                fontSize: 14,
                color: COLORS.muted,
                lineHeight: 1.45,
                overflowWrap: "anywhere",
              }}
            >
              {review.ticketId}
              <span className="mx-1.5" style={{ opacity: 0.45 }}>·</span>
              {review.ticketSummary}
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

        <div className="relative flex-1 overflow-y-auto min-h-0">
          <ExecutionDetailsPanel
            review={review}
            session={session}
            details={details}
            effortMarkdown={effortMarkdown}
            embedded
          />
        </div>
      </div>
    </div>
  );
}
