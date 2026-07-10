"use client";

import { useState } from "react";
import Link from "next/link";
import type { ReviewItem } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

interface Props {
  review: ReviewItem;
  onApprove: (note?: string) => Promise<void>;
  onRequestChanges: (message: string) => Promise<void>;
  busy: boolean;
}

export function ReviewActionBar({ review, onApprove, onRequestChanges, busy }: Props) {
  const [mode, setMode] = useState<"idle" | "approve" | "changes">("idle");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function submitApprove() {
    setError("");
    await onApprove(note.trim() || undefined);
  }

  async function submitChanges() {
    if (!note.trim()) {
      setError("Add a message so the PM knows what to change.");
      return;
    }
    setError("");
    await onRequestChanges(note.trim());
  }

  return (
    <div
      className="p-5 space-y-4"
      style={{
        background: COLORS.surface,
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 style={{ ...F.body, fontSize: 17, fontWeight: 600, color: COLORS.text }}>Your decision</h3>
          <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, marginTop: 2 }}>
            The PM is notified via session status and conversation thread
          </p>
        </div>
        <Link
          href={`/workspace/${encodeURIComponent(review.ticketId)}`}
          className="text-sm font-medium hover:underline shrink-0"
          style={{ ...F.body, color: COLORS.accent }}
        >
          Open workspace ↗
        </Link>
      </div>

      {mode !== "idle" && (
        <div className="space-y-2">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => { setNote(e.target.value); setError(""); }}
            placeholder={
              mode === "changes"
                ? "Describe what needs to change — be specific so the PM can refine the mockup…"
                : "Optional note for the PM (e.g. approved scope, caveats)…"
            }
            className="w-full px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-amber-500/20"
            style={{
              ...F.body,
              background: COLORS.subtle,
              borderRadius: RADIUS.md,
              border: `1px solid ${error ? "#FF3B30" : COLORS.border}`,
              color: COLORS.text,
            }}
          />
          {error && <p style={{ ...F.body, fontSize: 13, color: "#FF3B30" }}>{error}</p>}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        {mode === "idle" ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setMode("approve"); setNote(""); setError(""); }}
              className="flex-1 py-3 text-sm font-semibold disabled:opacity-50"
              style={{ background: "#34C759", color: "#fff", borderRadius: RADIUS.pill }}
            >
              ✓ Approve for build
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setMode("changes"); setNote(""); setError(""); }}
              className="flex-1 py-3 text-sm font-semibold disabled:opacity-50"
              style={{ background: COLORS.surface, color: COLORS.text, borderRadius: RADIUS.pill, border: `1px solid ${COLORS.border}` }}
            >
              ↩ Request changes
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => { setMode("idle"); setNote(""); setError(""); }}
              className="px-5 py-3 text-sm font-medium"
              style={{ color: COLORS.muted, ...F.body }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={mode === "approve" ? submitApprove : submitChanges}
              className="flex-1 py-3 text-sm font-semibold disabled:opacity-50"
              style={{
                background: mode === "approve" ? "#34C759" : COLORS.accent,
                color: "#fff",
                borderRadius: RADIUS.pill,
              }}
            >
              {busy ? "Saving…" : mode === "approve" ? "Confirm approval" : "Send change request"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
