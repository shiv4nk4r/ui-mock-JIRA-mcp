"use client";

import { useState } from "react";
import type { ReviewItem } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

interface Props {
  review: ReviewItem;
  onApprove: (note?: string) => Promise<void>;
  onRequestChanges: (message: string) => Promise<void>;
  busy: boolean;
}

export function ReviewActionBar({ review: _review, onApprove, onRequestChanges, busy }: Props) {
  const [mode, setMode] = useState<"idle" | "approve" | "changes">("idle");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  async function submitApprove() {
    setError("");
    try {
      await onApprove(note.trim() || undefined);
      setMode("idle");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save approval");
    }
  }

  async function submitChanges() {
    if (!note.trim()) {
      setError("Add a message so the PM knows what to change.");
      return;
    }
    setError("");
    try {
      await onRequestChanges(note.trim());
      setMode("idle");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send change request");
    }
  }

  const changesNoteMissing = mode === "changes" && !note.trim();

  if (mode === "idle") {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span style={{ ...F.body, fontSize: 13, fontWeight: 600, color: COLORS.text, whiteSpace: "nowrap" }}>
          Your decision
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            disabled={busy}
            onClick={() => { setMode("approve"); setNote(""); setError(""); }}
            className="px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{ background: "#34C759", color: "#fff", borderRadius: RADIUS.pill }}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => { setMode("changes"); setNote(""); setError(""); }}
            className="px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            style={{ background: COLORS.subtle, color: COLORS.text, borderRadius: RADIUS.pill, border: `1px solid ${COLORS.border}` }}
          >
            Request changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span style={{ ...F.body, fontSize: 13, fontWeight: 600, color: COLORS.text }}>
          {mode === "approve" ? "Approve for build" : "Request changes"}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => { setMode("idle"); setNote(""); setError(""); }}
          className="px-2 py-1 text-xs"
          style={{ color: COLORS.muted, ...F.body }}
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={busy || (mode === "changes" && changesNoteMissing)}
          onClick={mode === "approve" ? submitApprove : submitChanges}
          className="px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: mode === "approve" ? "#34C759" : COLORS.accent,
            color: "#fff",
            borderRadius: RADIUS.pill,
          }}
        >
          {busy ? "Saving…" : mode === "approve" ? "Confirm" : "Send"}
        </button>
      </div>
      <textarea
        rows={2}
        value={note}
        onChange={(e) => { setNote(e.target.value); setError(""); }}
        required={mode === "changes"}
        placeholder={
          mode === "changes"
            ? "Required — what needs to change…"
            : "Optional note for the PM…"
        }
        className="w-full px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-amber-500/20"
        style={{
          ...F.body,
          background: COLORS.subtle,
          borderRadius: RADIUS.sm,
          border: `1px solid ${error ? "#FF3B30" : COLORS.border}`,
          color: COLORS.text,
        }}
      />
      {error && <p style={{ ...F.body, fontSize: 12, color: "#FF3B30" }}>{error}</p>}
    </div>
  );
}
