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
        aria-labelledby="retract-review-title"
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
              "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(0,0,0,0.04) 0%, transparent 70%)",
          }}
        />

        <div className="relative px-6 pt-7 pb-6 space-y-6">
          <div className="space-y-2">
            <p
              className="inline-flex items-center px-2.5 py-1 text-xs font-semibold"
              style={{
                background: COLORS.subtle,
                color: COLORS.muted,
                borderRadius: RADIUS.pill,
                ...F.body,
              }}
            >
              Review
            </p>
            <h2
              id="retract-review-title"
              style={{
                ...F.body,
                fontSize: 24,
                fontWeight: 560,
                color: COLORS.text,
                letterSpacing: "-0.03em",
                lineHeight: 1.2,
              }}
            >
              Retract from review?
            </h2>
            <p style={{ ...F.body, fontSize: 15, color: COLORS.muted, lineHeight: 1.55 }}>
              Pull this mockup out of the GCC queue so you can keep refining it.
            </p>
          </div>

          <ul className="space-y-3 px-0.5">
            {[
              "It will no longer appear as pending review",
              "Your review channel history stays intact",
              "Send it back whenever you're ready",
            ].map((item) => (
              <li key={item} className="flex gap-3 items-start">
                <span
                  className="mt-1.5 shrink-0 w-1.5 h-1.5 rounded-full"
                  style={{ background: COLORS.muted }}
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
              Keep in review
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="flex-1 py-3 text-sm font-semibold disabled:opacity-50 transition-opacity"
              style={{
                ...F.body,
                background: COLORS.text,
                color: "#fff",
                borderRadius: RADIUS.pill,
              }}
            >
              {busy ? "Retracting…" : "Retract"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
