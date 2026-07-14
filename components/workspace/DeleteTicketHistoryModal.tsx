"use client";

import { useEffect, useState } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

interface Props {
  open: boolean;
  ticketId: string;
  ticketSummary?: string;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

const DANGER = "#D70015";
const DANGER_SOFT = "rgba(215, 0, 21, 0.08)";
const DANGER_BORDER = "rgba(215, 0, 21, 0.22)";

function ticketIdsMatch(typed: string, expected: string): boolean {
  return typed.trim().toUpperCase() === expected.trim().toUpperCase();
}

export function DeleteTicketHistoryModal({
  open,
  ticketId,
  ticketSummary,
  busy,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    if (open) setConfirmText("");
  }, [open, ticketId]);

  if (!open) return null;

  const canConfirm = ticketIdsMatch(confirmText, ticketId) && !busy;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        className="absolute inset-0"
        style={{ background: "rgba(29, 29, 31, 0.28)", backdropFilter: "blur(6px)" }}
        onClick={busy ? undefined : onCancel}
        aria-label="Close"
        disabled={busy}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-ticket-title"
        aria-describedby="delete-ticket-desc"
        className="relative w-full max-w-md overflow-hidden"
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
              "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(215,0,21,0.1) 0%, transparent 70%)",
          }}
        />

        <div className="relative px-6 pt-6 pb-5 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <p
                className="inline-flex items-center px-2.5 py-1 text-xs font-semibold"
                style={{
                  background: DANGER_SOFT,
                  color: DANGER,
                  borderRadius: RADIUS.pill,
                  border: `1px solid ${DANGER_BORDER}`,
                  ...F.body,
                }}
              >
                Danger
              </p>
              <h2
                id="delete-ticket-title"
                style={{
                  ...F.body,
                  fontSize: 22,
                  fontWeight: 560,
                  color: COLORS.text,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.25,
                }}
              >
                Delete all history for this ticket?
              </h2>
              <p
                id="delete-ticket-desc"
                style={{ ...F.body, fontSize: 14, color: COLORS.muted, lineHeight: 1.5 }}
              >
                This permanently removes everything for{" "}
                <strong style={{ ...F.mono, color: COLORS.text, fontWeight: 650 }}>{ticketId}</strong>
                {ticketSummary ? (
                  <>
                    <span className="mx-1.5" style={{ opacity: 0.45 }}>
                      ·
                    </span>
                    {ticketSummary}
                  </>
                ) : null}
                . You will start completely fresh.
              </p>
            </div>
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="w-9 h-9 flex items-center justify-center shrink-0 hover:bg-black/5 transition-colors disabled:opacity-40"
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

          <div
            className="px-4 py-3.5 space-y-2.5"
            style={{
              background: COLORS.subtle,
              borderRadius: 16,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <p style={{ ...F.body, fontSize: 13, fontWeight: 600, color: DANGER }}>
              This cannot be undone
            </p>
            <ul className="space-y-2" style={{ ...F.body, fontSize: 13, color: COLORS.text, lineHeight: 1.4 }}>
              {[
                "All mockup versions and chat messages",
                "Review submissions and engineering threads",
                "Mock annotations and area comments",
                "Share links and feedback for this ticket",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 shrink-0 rounded-full"
                    style={{ background: DANGER }}
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="delete-ticket-confirm"
              style={{ ...F.body, fontSize: 13, fontWeight: 560, color: COLORS.text }}
            >
              Type <span style={{ ...F.mono, color: DANGER, fontWeight: 650 }}>{ticketId}</span> to
              confirm
            </label>
            <input
              id="delete-ticket-confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              placeholder={ticketId}
              className="w-full px-3.5 py-2.5 text-sm outline-none transition-shadow disabled:opacity-50"
              style={{
                ...F.mono,
                background: COLORS.subtle,
                color: COLORS.text,
                borderRadius: 14,
                border: `1px solid ${canConfirm ? DANGER_BORDER : COLORS.border}`,
                boxShadow: canConfirm ? `0 0 0 3px ${DANGER_SOFT}` : "none",
              }}
            />
          </div>

          {error && (
            <p
              className="text-sm px-3.5 py-2.5"
              style={{
                ...F.body,
                color: DANGER,
                background: DANGER_SOFT,
                borderRadius: 12,
                border: `1px solid ${DANGER_BORDER}`,
              }}
            >
              {error}
            </p>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="flex-1 py-2.5 text-sm font-medium disabled:opacity-50 hover:bg-black/[0.04] transition-colors"
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
              disabled={!canConfirm}
              className="flex-1 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              style={{
                ...F.body,
                background: DANGER,
                color: "#fff",
                borderRadius: RADIUS.pill,
                boxShadow: canConfirm ? "0 8px 20px rgba(215,0,21,0.28)" : "none",
              }}
            >
              {busy ? "Deleting…" : "Delete all history"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
