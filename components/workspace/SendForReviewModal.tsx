"use client";

import { F, COLORS, RADIUS } from "@lib/design/tokens";
import type { MockRevision } from "@lib/utils/session-history";
import { formatVersionTime } from "@lib/utils/review-ui";
import { MockVersionPicker } from "@/components/workspace/MockVersionPicker";

interface Props {
  open: boolean;
  resubmit?: boolean;
  busy?: boolean;
  revisions: MockRevision[];
  selectedRevisionId: string | null;
  onSelectRevision: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SendForReviewModal({
  open,
  resubmit,
  busy,
  revisions,
  selectedRevisionId,
  onSelectRevision,
  onCancel,
  onConfirm,
}: Props) {
  if (!open) return null;

  const selected =
    revisions.find((r) => r.id === selectedRevisionId) ?? revisions[revisions.length - 1];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: "rgba(29, 29, 31, 0.28)", backdropFilter: "blur(6px)" }}
        onClick={busy ? undefined : onCancel}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-for-review-title"
        className="relative w-full max-w-[420px] overflow-hidden"
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

        <div className="relative px-6 pt-7 pb-6 space-y-6">
          <div className="space-y-2">
            <p
              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold"
              style={{
                background: COLORS.accentSoft,
                color: COLORS.accent,
                borderRadius: RADIUS.pill,
                ...F.body,
              }}
            >
              {resubmit ? "Resubmit" : "Review"}
            </p>
            <h2
              id="send-for-review-title"
              style={{
                ...F.body,
                fontSize: 24,
                fontWeight: 560,
                color: COLORS.text,
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
              }}
            >
              {resubmit ? "Resubmit for review?" : "Send for review?"}
            </h2>
            <p style={{ ...F.body, fontSize: 15, color: COLORS.muted, lineHeight: 1.55 }}>
              {resubmit
                ? "Send the updated mockup back to GCC."
                : "Share this mockup with GCC for feedback."}
            </p>
          </div>

          {revisions.length > 0 && selected && (
            <div
              className="flex items-center gap-2.5 px-3.5 py-2.5"
              style={{
                background: COLORS.subtle,
                borderRadius: RADIUS.md,
              }}
            >
              <p className="flex-1 min-w-0 truncate" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
                <span style={{ color: COLORS.text }}>v{selected.index + 1}</span>
                <span className="mx-1.5" style={{ opacity: 0.45 }}>·</span>
                <span className="truncate">{selected.label}</span>
                <span className="mx-1.5" style={{ opacity: 0.45 }}>·</span>
                <span>{formatVersionTime(selected.timestamp)}</span>
              </p>
              {revisions.length > 1 && (
                <MockVersionPicker
                  revisions={revisions}
                  selectedId={selectedRevisionId}
                  onSelect={onSelectRevision}
                  disabled={busy}
                  compact
                  align="left"
                />
              )}
            </div>
          )}

          <ul className="space-y-3 px-0.5">
            {[
              "GCC reviews it in a shared channel",
              "They can approve or request changes with feedback",
              "Approved mocks become the draft for implementation",
            ].map((item) => (
              <li key={item} className="flex gap-3 items-start">
                <span
                  className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full"
                  style={{ background: COLORS.accent }}
                  aria-hidden
                />
                <span style={{ ...F.body, fontSize: 14, color: COLORS.muted, lineHeight: 1.5 }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 py-3 text-sm font-medium disabled:opacity-50 transition-colors hover:bg-black/[0.04]"
              style={{
                ...F.body,
                color: COLORS.text,
                background: COLORS.subtle,
                borderRadius: RADIUS.pill,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy || !selected?.html}
              className="flex-1 py-3 text-sm font-semibold disabled:opacity-50 transition-opacity"
              style={{
                ...F.body,
                background: COLORS.accent,
                color: "#fff",
                borderRadius: RADIUS.pill,
                boxShadow: "0 4px 14px rgba(217,119,6,0.28)",
              }}
            >
              {busy ? "Sending…" : resubmit ? "Resubmit" : "Send for review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
