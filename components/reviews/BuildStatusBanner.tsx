"use client";

import { F, COLORS, RADIUS } from "@lib/design/tokens";
import type { ReviewBuildState } from "@lib/types";

interface Props {
  build?: ReviewBuildState;
  progressMessage?: string;
  channelOpen?: boolean;
}

export function BuildStatusBanner({ build, progressMessage, channelOpen = false }: Props) {
  if (!build && !progressMessage) return null;

  const status = build?.status ?? "running";
  const isRunning = status === "running";
  const isFailed = status === "failed";
  const isOk = status === "succeeded";

  const bg = isOk
    ? "rgba(52,199,89,0.12)"
    : isFailed
      ? "rgba(255,59,48,0.1)"
      : "rgba(217,119,6,0.1)";
  const color = isOk ? "#248A3D" : isFailed ? "#FF3B30" : COLORS.accent;
  const right = channelOpen ? "calc(min(100vw, 420px) + 16px)" : 24;

  const label = isRunning
    ? progressMessage || build?.message || "Building with Claude Code (background)…"
    : isOk
      ? build?.prUrl
        ? "PR ready"
        : "Build succeeded"
      : build?.error || build?.message || progressMessage || "Build failed";

  return (
    <div
      className="fixed z-[115] max-w-[min(calc(100vw-48px),360px)] shadow-lg"
      style={{
        right,
        bottom: 96,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        padding: "12px 14px",
      }}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-0.5 w-2 h-2 rounded-full shrink-0"
          style={{ background: color, boxShadow: isRunning ? `0 0 0 4px ${bg}` : undefined }}
        />
        <div className="min-w-0 space-y-1">
          <p style={{ ...F.body, fontSize: 13, fontWeight: 600, color: COLORS.text }}>
            {isRunning ? "Build running on server" : isOk ? "Build complete" : "Build failed"}
          </p>
          <p
            className="line-clamp-3"
            style={{ ...F.body, fontSize: 12, color: COLORS.muted, lineHeight: 1.4 }}
          >
            {label}
          </p>
          {build?.branchName && (
            <p style={{ ...F.mono, fontSize: 11, color: COLORS.muted }}>{build.branchName}</p>
          )}
          {isOk && build?.prUrl && (
            <a
              href={build.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...F.body, fontSize: 13, fontWeight: 600, color: COLORS.accent }}
            >
              Open pull request →
            </a>
          )}
          {build?.jobId && (
            <a
              href={`/builds/${build.jobId}`}
              style={{ ...F.body, fontSize: 13, fontWeight: 600, color: COLORS.accent, display: "block" }}
            >
              View build logs →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
