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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={busy ? undefined : onCancel}
        aria-label="Close"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-ticket-title"
        aria-describedby="delete-ticket-desc"
        className="relative w-full max-w-md p-6 space-y-5 shadow-xl"
        style={{
          background: COLORS.surface,
          borderRadius: RADIUS.lg,
          border: "2px solid rgba(255,59,48,0.45)",
          boxShadow: "0 20px 60px rgba(255,59,48,0.12)",
        }}
      >
        <div className="space-y-2">
          <p
            className="inline-flex items-center gap-2 px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
            style={{ background: "rgba(255,59,48,0.1)", color: "#D70015", borderRadius: RADIUS.pill }}
          >
            ⚠ Danger zone
          </p>
          <h2 id="delete-ticket-title" style={{ ...F.body, fontSize: 20, fontWeight: 600, color: COLORS.text }}>
            Delete all history for this ticket?
          </h2>
          <p id="delete-ticket-desc" style={{ ...F.body, fontSize: 14, color: COLORS.text, lineHeight: 1.55 }}>
            This permanently removes everything for{" "}
            <strong style={{ ...F.mono, color: COLORS.accent }}>{ticketId}</strong>
            {ticketSummary ? ` — ${ticketSummary}` : ""}. You will start completely fresh.
          </p>
        </div>

        <div
          className="px-4 py-3 space-y-2"
          style={{ background: "rgba(255,59,48,0.06)", borderRadius: RADIUS.md, border: "1px solid rgba(255,59,48,0.2)" }}
        >
          <p style={{ ...F.body, fontSize: 13, fontWeight: 600, color: "#D70015" }}>This cannot be undone</p>
          <ul className="space-y-1.5" style={{ ...F.body, fontSize: 13, color: COLORS.text, lineHeight: 1.45 }}>
            <li>All mockup versions and chat messages</li>
            <li>Review submissions and engineering threads</li>
            <li>Mock annotations and area comments</li>
            <li>Share links and feedback for this ticket</li>
          </ul>
        </div>

        <div className="space-y-2">
          <label htmlFor="delete-ticket-confirm" style={{ ...F.body, fontSize: 13, fontWeight: 600, color: COLORS.text }}>
            Type <span style={{ ...F.mono, color: COLORS.accent }}>{ticketId}</span> to confirm
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
            className="w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-red-500/30 disabled:opacity-50"
            style={{
              ...F.mono,
              background: COLORS.subtle,
              color: COLORS.text,
              borderRadius: RADIUS.md,
              border: `1px solid ${canConfirm ? "rgba(255,59,48,0.45)" : COLORS.border}`,
            }}
          />
        </div>

        {error && (
          <p className="text-sm px-3 py-2" style={{ ...F.body, color: "#D70015", background: "rgba(255,59,48,0.08)", borderRadius: RADIUS.sm }}>
            {error}
          </p>
        )}

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
            disabled={!canConfirm}
            className="flex-1 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: "#FF3B30", color: "#fff", borderRadius: RADIUS.pill }}
          >
            {busy ? "Deleting…" : "Delete all history"}
          </button>
        </div>
      </div>
    </div>
  );
}
