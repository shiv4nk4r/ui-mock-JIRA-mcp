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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={busy ? undefined : onCancel}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-for-review-title"
        className="relative w-full max-w-md p-6 space-y-5 shadow-xl"
        style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
      >
        <div className="space-y-2">
          <h2 id="send-for-review-title" style={{ ...F.body, fontSize: 20, fontWeight: 600, color: COLORS.text }}>
            {resubmit ? "Resubmit for review?" : "Send for review?"}
          </h2>
          <p style={{ ...F.body, fontSize: 15, color: COLORS.text, lineHeight: 1.55 }}>
            {resubmit
              ? "You're sending the updated mockup back to the engineering team."
              : "You're sending this mockup to the engineering team for review."}
          </p>
        </div>

        {revisions.length > 0 && selected && (
          <div className="space-y-2">
            <p style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Version to send
            </p>
            <div
              className="p-3 space-y-3"
              style={{ background: COLORS.subtle, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}
            >
              <div>
                <p style={{ ...F.body, fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                  v{selected.index + 1} · {selected.label}
                </p>
                <p style={{ ...F.body, fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                  Created {formatVersionTime(selected.timestamp)}
                </p>
              </div>
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
          </div>
        )}

        <ul className="space-y-3">
          {[
            "The team will review your mockup in a shared review channel.",
            "They can approve it or request changes with feedback in the thread.",
            "If they approve it, this mockup becomes the final draft for implementation.",
          ].map((item) => (
            <li key={item} className="flex gap-3">
              <span className="shrink-0 mt-0.5" style={{ color: COLORS.accent }}>✦</span>
              <span style={{ ...F.body, fontSize: 14, color: COLORS.muted, lineHeight: 1.55 }}>{item}</span>
            </li>
          ))}
        </ul>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="flex-1 py-2.5 text-sm font-medium disabled:opacity-50"
            style={{ color: COLORS.muted, ...F.body }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy || !selected?.html}
            className="flex-1 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
          >
            {busy ? "Sending…" : resubmit ? "Resubmit" : "Send for review"}
          </button>
        </div>
      </div>
    </div>
  );
}
