"use client";

import { F, COLORS, RADIUS } from "@lib/design/tokens";

interface Props {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RetractReviewModal({ open, busy, onCancel, onConfirm }: Props) {
  if (!open) return null;

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
        aria-labelledby="retract-review-title"
        className="relative w-full max-w-md p-6 space-y-5 shadow-xl"
        style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
      >
        <div className="space-y-2">
          <h2 id="retract-review-title" style={{ ...F.body, fontSize: 20, fontWeight: 600, color: COLORS.text }}>
            Retract from review?
          </h2>
          <p style={{ ...F.body, fontSize: 15, color: COLORS.text, lineHeight: 1.55 }}>
            This pulls the mockup out of the engineering review queue so you can keep refining it in the workspace.
          </p>
        </div>

        <ul className="space-y-3">
          {[
            "Engineering will no longer see this as pending review.",
            "Your review channel history stays intact.",
            "Send it back for review when you are ready.",
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
            Keep in review
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ background: COLORS.text, color: "#fff", borderRadius: RADIUS.pill }}
          >
            {busy ? "Retracting…" : "Retract from review"}
          </button>
        </div>
      </div>
    </div>
  );
}
