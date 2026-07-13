"use client";

import { FormEvent, useState } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";

interface Props {
  onApprove: (note?: string) => Promise<void>;
  onRequestChanges: (message: string) => Promise<void>;
  busy: boolean;
  /** Shift left when the review channel drawer is open */
  channelOpen?: boolean;
}

const actionBtnClass =
  "w-full min-h-[44px] px-4 py-3 text-sm font-semibold text-center leading-snug whitespace-normal box-border transition-opacity disabled:opacity-50 disabled:cursor-not-allowed";

export function ReviewDecisionIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

export function ReviewDecisionFab({ onApprove, onRequestChanges, busy, channelOpen = false }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"idle" | "approve" | "changes">("idle");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const panelOpen = menuOpen || mode !== "idle";
  const changesNoteMissing = mode === "changes" && !note.trim();
  const fabRight = channelOpen ? "calc(min(100vw, 420px) + 16px)" : 24;

  function closeAll() {
    setMenuOpen(false);
    setMode("idle");
    setNote("");
    setError("");
  }

  async function submitApprove(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await onApprove(note.trim() || undefined);
      closeAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save approval");
    }
  }

  async function submitChanges(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) {
      setError("Add a message so the PM knows what to change.");
      return;
    }
    setError("");
    try {
      await onRequestChanges(note.trim());
      closeAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send change request");
    }
  }

  return (
    <>
      {panelOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[114] bg-transparent"
          onClick={closeAll}
          aria-label="Close decision menu"
        />
      )}

      {panelOpen && (
        <div
          className="fixed z-[116] shadow-xl box-border"
          style={{
            right: fabRight,
            bottom: 88,
            width: "min(calc(100vw - 32px), 300px)",
            background: COLORS.surface,
            borderRadius: RADIUS.lg,
            border: `1px solid ${COLORS.border}`,
            padding: 20,
          }}
        >
          {mode === "idle" ? (
            <div className="flex flex-col" style={{ gap: 16 }}>
              <p style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text, lineHeight: 1.3 }}>
                Your decision
              </p>
              <div className="flex flex-col" style={{ gap: 10 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setMode("approve"); setNote(""); setError(""); }}
                  className={actionBtnClass}
                  style={{ ...F.body, background: "#34C759", color: "#fff", borderRadius: RADIUS.pill, border: "none" }}
                >
                  Approve for build
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setMode("changes"); setNote(""); setError(""); }}
                  className={actionBtnClass}
                  style={{
                    ...F.body,
                    background: COLORS.subtle,
                    color: COLORS.text,
                    borderRadius: RADIUS.pill,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  Request changes
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={mode === "approve" ? submitApprove : submitChanges} className="flex flex-col" style={{ gap: 14 }}>
              <div className="flex items-start justify-between gap-3">
                <p
                  className="min-w-0 flex-1"
                  style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text, lineHeight: 1.35 }}
                >
                  {mode === "approve" ? "Approve for build" : "Request changes"}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { setMode("idle"); setNote(""); setError(""); }}
                  className="shrink-0 px-2 py-1 text-xs"
                  style={{ color: COLORS.muted, ...F.body }}
                >
                  Back
                </button>
              </div>
              <textarea
                rows={3}
                autoFocus
                value={note}
                onChange={(e) => { setNote(e.target.value); setError(""); }}
                required={mode === "changes"}
                placeholder={
                  mode === "changes"
                    ? "Required — what needs to change…"
                    : "Optional note for the PM…"
                }
                className="w-full px-3 py-2.5 text-sm outline-none resize-none box-border"
                style={{
                  ...F.body,
                  lineHeight: 1.5,
                  background: COLORS.subtle,
                  borderRadius: RADIUS.sm,
                  border: `1px solid ${error ? "#FF3B30" : COLORS.border}`,
                  color: COLORS.text,
                }}
              />
              {error && <p style={{ ...F.body, fontSize: 12, color: "#FF3B30", lineHeight: 1.4 }}>{error}</p>}
              <button
                type="submit"
                disabled={busy || (mode === "changes" && changesNoteMissing)}
                className={actionBtnClass}
                style={{
                  ...F.body,
                  background: mode === "approve" ? "#34C759" : COLORS.accent,
                  color: "#fff",
                  borderRadius: RADIUS.pill,
                  border: "none",
                }}
              >
                {busy ? "Saving…" : mode === "approve" ? "Confirm approval" : "Send request"}
              </button>
            </form>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (panelOpen) closeAll();
          else setMenuOpen(true);
        }}
        className="fixed z-[116] flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 box-border"
        style={{
          right: fabRight,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: panelOpen ? COLORS.text : "#34C759",
          color: "#fff",
          border: `2px solid ${COLORS.surface}`,
        }}
        aria-label={panelOpen ? "Close decision menu" : "Open review decision"}
        title="Review decision"
      >
        {panelOpen ? (
          <span style={{ ...F.body, fontSize: 22, lineHeight: 1 }}>×</span>
        ) : (
          <ReviewDecisionIcon />
        )}
      </button>
    </>
  );
}
