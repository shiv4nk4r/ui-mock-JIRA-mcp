"use client";

import { FormEvent, useEffect, useState } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import type { ReviewBuildState } from "@lib/types";

interface Props {
  onBuild: () => Promise<void>;
  busy: boolean;
  build?: ReviewBuildState;
  channelOpen?: boolean;
  /** Open the confirm panel on mount (e.g. from ?build=1 deep link). */
  autoOpenConfirm?: boolean;
}

export function BuildPrIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 3v12" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="6" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

export function BuildPrFab({
  onBuild,
  busy,
  build,
  channelOpen = false,
  autoOpenConfirm = false,
}: Props) {
  const [confirmOpen, setConfirmOpen] = useState(autoOpenConfirm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (autoOpenConfirm) setConfirmOpen(true);
  }, [autoOpenConfirm]);

  const fabRight = channelOpen ? "calc(min(100vw, 420px) + 16px)" : 24;
  const hasPr = build?.status === "succeeded" && !!build.prUrl;
  const isRunning = busy || build?.status === "running";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await onBuild();
      setConfirmOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build failed");
    }
  }

  return (
    <>
      {confirmOpen && (
        <button
          type="button"
          className="fixed inset-0 z-[114] bg-transparent"
          onClick={() => !busy && setConfirmOpen(false)}
          aria-label="Close build confirmation"
        />
      )}

      {confirmOpen && (
        <div
          className="fixed z-[116] shadow-xl box-border"
          style={{
            right: fabRight,
            bottom: 88,
            width: "min(calc(100vw - 32px), 320px)",
            background: COLORS.surface,
            borderRadius: RADIUS.lg,
            border: `1px solid ${COLORS.border}`,
            padding: 20,
          }}
        >
          <form onSubmit={submit} className="flex flex-col" style={{ gap: 14 }}>
            <p style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text, lineHeight: 1.35 }}>
              {hasPr ? "Rebuild & update PR?" : "Build pull request"}
            </p>
            <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, lineHeight: 1.45 }}>
              Claude Code runs on the server in the background — you can close this tab.
              It syncs <span style={{ ...F.mono, fontSize: 12 }}>develop</span>, creates{" "}
              <span style={{ ...F.mono, fontSize: 12 }}>{"{ticket}-gcc-studio"}</span>, implements
              the handoff, pushes, and opens a PR. Reopen this page anytime to check status.
            </p>
            {error && (
              <p style={{ ...F.body, fontSize: 12, color: "#FF3B30", lineHeight: 1.4 }}>{error}</p>
            )}
            {hasPr && build?.prUrl && (
              <a
                href={build.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...F.body, fontSize: 13, color: COLORS.accent, fontWeight: 600 }}
              >
                Current PR →
              </a>
            )}
            <div className="flex flex-col" style={{ gap: 8 }}>
              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[44px] px-4 py-3 text-sm font-semibold disabled:opacity-50"
                style={{
                  ...F.body,
                  background: COLORS.accent,
                  color: "#fff",
                  borderRadius: RADIUS.pill,
                  border: "none",
                }}
              >
                {busy ? "Building…" : hasPr ? "Rebuild" : "Start build"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
                className="w-full min-h-[40px] text-sm"
                style={{ ...F.body, color: COLORS.muted, background: "transparent", border: "none" }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (isRunning) return;
          setConfirmOpen((v) => !v);
          setError("");
        }}
        disabled={isRunning}
        className="fixed z-[116] flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 box-border disabled:opacity-70"
        style={{
          right: fabRight,
          bottom: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: confirmOpen ? COLORS.text : COLORS.accent,
          color: "#fff",
          border: `2px solid ${COLORS.surface}`,
        }}
        aria-label={hasPr ? "Rebuild pull request" : "Build pull request"}
        title={hasPr ? "Rebuild PR" : "Build PR"}
      >
        {isRunning ? (
          <span
            className="inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"
            aria-hidden
          />
        ) : confirmOpen ? (
          <span style={{ ...F.body, fontSize: 22, lineHeight: 1 }}>×</span>
        ) : (
          <BuildPrIcon />
        )}
      </button>
    </>
  );
}
