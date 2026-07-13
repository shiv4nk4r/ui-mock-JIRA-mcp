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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close implementation plan"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="implementation-plan-title"
        className="relative w-full max-w-3xl max-h-[min(90dvh,820px)] flex flex-col shadow-xl overflow-hidden"
        style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
      >
        <div
          className="flex-none flex items-start justify-between gap-3 px-5 py-4 border-b"
          style={{ borderColor: COLORS.border }}
        >
          <div>
            <h2 id="implementation-plan-title" style={{ ...F.body, fontSize: 18, fontWeight: 600, color: COLORS.text }}>
              Implementation plan
            </h2>
            <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
              Execution breakdown and standalone agent prompt
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
        <div className="flex-1 overflow-y-auto min-h-0">
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
