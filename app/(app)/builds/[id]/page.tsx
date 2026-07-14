"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { formatVersionTime, relativeTime } from "@lib/utils/review-ui";
import type { ReviewBuildStatus } from "@lib/types";

interface BuildLogEntry {
  ts: number;
  level: string;
  phase?: string;
  message: string;
  detail?: string;
}

interface BuildJobDetail {
  jobId: string;
  reviewId: string;
  ticketId: string;
  ticketSummary: string;
  branchName: string;
  status: ReviewBuildStatus;
  phase: string;
  message: string;
  prUrl?: string;
  prNumber?: number;
  error?: string;
  files?: string[];
  model?: string;
  agentPromptPreview?: string;
  worktreePath?: string;
  failedPhase?: string;
  lastCompletedStep?: string;
  resumeFrom?: string;
  logCount?: number;
  active?: boolean;
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
}

const LEVEL_STYLE: Record<string, { color: string; label: string }> = {
  system: { color: COLORS.muted, label: "SYS" },
  git: { color: "#2982cc", label: "GIT" },
  agent: { color: COLORS.accent, label: "AGENT" },
  tool: { color: "#7c3aed", label: "TOOL" },
  error: { color: "#FF3B30", label: "ERR" },
  result: { color: "#248A3D", label: "OK" },
};

export default function BuildDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [job, setJob] = useState<BuildJobDetail | null>(null);
  const [logs, setLogs] = useState<BuildLogEntry[]>([]);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [follow, setFollow] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const logEndRef = useRef<HTMLDivElement>(null);
  const lastTsRef = useRef(0);

  const running = job?.status === "running";

  const fetchDetail = useCallback(
    async (incremental: boolean) => {
      const after = incremental ? lastTsRef.current : 0;
      const res = await fetch(
        `/api/builds/${encodeURIComponent(params.id)}?afterTs=${after}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Build not found");

      setJob(data.job);
      const incoming = (data.logs ?? []) as BuildLogEntry[];
      if (!incremental) {
        setLogs(incoming);
      } else if (incoming.length) {
        setLogs((prev) => {
          const seen = new Set(prev.map((l) => `${l.ts}:${l.message.slice(0, 40)}`));
          const merged = [...prev];
          for (const e of incoming) {
            const key = `${e.ts}:${e.message.slice(0, 40)}`;
            if (!seen.has(key)) merged.push(e);
          }
          return merged;
        });
      }
      if (incoming.length) {
        lastTsRef.current = Math.max(lastTsRef.current, ...incoming.map((l) => l.ts));
      } else if (!incremental && data.job?.updatedAt) {
        lastTsRef.current = data.job.updatedAt;
      }
    },
    [params.id],
  );

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (user.role !== "internal") {
      router.replace("/dashboard");
      return;
    }
    fetchDetail(false).catch((err) =>
      setError(err instanceof Error ? err.message : "Failed to load"),
    );
  }, [user, isLoading, router, fetchDetail]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      fetchDetail(true).catch(() => undefined);
    }, 2000);
    return () => clearInterval(id);
  }, [running, fetchDetail]);

  useEffect(() => {
    if (follow) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length, follow]);

  const duration = useMemo(() => {
    if (!job) return "";
    const end = job.finishedAt ?? Date.now();
    const sec = Math.max(0, Math.round((end - job.startedAt) / 1000));
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  }, [job]);

  async function handleRetry() {
    if (!job || retrying) return;
    setRetrying(true);
    setRetryError("");
    try {
      const res = await fetch(`/api/builds/${encodeURIComponent(job.jobId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry" }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Retry failed (${res.status})`);
      }
      const nextId = data?.jobId || data?.build?.jobId;
      if (nextId && nextId !== job.jobId) {
        router.push(`/builds/${nextId}`);
        return;
      }
      // Same job already running — refresh in place
      lastTsRef.current = 0;
      await fetchDetail(false);
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center space-y-3">
        <p style={{ ...F.body, fontSize: 16, color: "#FF3B30" }}>{error}</p>
        <Link href="/builds" style={{ color: COLORS.accent, fontWeight: 600 }}>
          ← All builds
        </Link>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="py-20 flex justify-center">
        <div className="signal-bars"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/builds" style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
          ← Builds
        </Link>
        <span style={{ color: COLORS.border }}>/</span>
        <span style={{ ...F.mono, fontSize: 13, color: COLORS.accent, fontWeight: 600 }}>
          {job.ticketId}
        </span>
      </div>

      <div
        className="p-4 sm:p-5 space-y-4"
        style={{
          background: COLORS.surface,
          borderRadius: RADIUS.lg,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
          <div className="space-y-1 min-w-0">
            <h1 style={{ ...F.body, fontSize: 22, fontWeight: 600, color: COLORS.text }}>
              {job.ticketSummary}
            </h1>
            <p style={{ ...F.mono, fontSize: 12, color: COLORS.muted }}>
              job {job.jobId}
            </p>
            <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>{job.message}</p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0 items-center">
            {job.status === "failed" && (
              <button
                type="button"
                disabled={retrying}
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold disabled:opacity-50"
                style={{
                  ...F.body,
                  background: COLORS.accent,
                  color: "#fff",
                  borderRadius: RADIUS.pill,
                  border: "none",
                }}
                title={
                  job.failedPhase === "pr" || job.lastCompletedStep === "push"
                    ? "Resume from PR creation only"
                    : "Retry build"
                }
              >
                {retrying
                  ? "Starting…"
                  : job.failedPhase === "pr" ||
                      job.lastCompletedStep === "push" ||
                      /gh |ENOENT|GitHub API|pr create/i.test(job.error || "")
                    ? "Retry PR step"
                    : "Retry build"}
              </button>
            )}
            {job.status === "succeeded" && (
              <button
                type="button"
                disabled={retrying}
                onClick={handleRetry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
                style={{
                  ...F.body,
                  background: COLORS.subtle,
                  color: COLORS.text,
                  borderRadius: RADIUS.pill,
                  border: `1px solid ${COLORS.border}`,
                }}
              >
                {retrying ? "Starting…" : "Rebuild"}
              </button>
            )}
            <MetaChip label="Status" value={job.status} accent={job.status === "running"} />
            <MetaChip label="Phase" value={job.phase} />
            <MetaChip label="Duration" value={duration} />
            {job.model && <MetaChip label="Model" value={job.model} />}
          </div>
        </div>

        {(retryError || (job.status === "failed" && job.error)) && (
          <div
            className="px-3 py-2 text-sm"
            style={{
              background: "rgba(255,59,48,0.08)",
              borderRadius: RADIUS.md,
              border: "1px solid rgba(255,59,48,0.2)",
              color: "#FF3B30",
              ...F.body,
            }}
          >
            {retryError || job.error}
            {job.status === "failed" && !retryError && (
              <span style={{ color: COLORS.muted }}>
                {(job.failedPhase === "pr" ||
                job.lastCompletedStep === "push" ||
                /gh |ENOENT|GitHub API|pr create/i.test(job.error || ""))
                  ? " — Retry will resume from PR creation only (code already pushed)."
                  : " — use Retry to run again; it resumes from the last failed step when possible."}
              </span>
            )}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <InfoRow label="Branch" value={job.branchName} mono />
          <InfoRow
            label="PR"
            value={
              job.prUrl ? (
                <a href={job.prUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#248A3D", fontWeight: 600 }}>
                  {job.prNumber ? `#${job.prNumber}` : "Open PR"} ↗
                </a>
              ) : (
                "—"
              )
            }
          />
          <InfoRow
            label="Review"
            value={
              <Link href={`/reviews/${job.reviewId}`} style={{ color: COLORS.accent, fontWeight: 600 }}>
                Open review →
              </Link>
            }
          />
          <InfoRow
            label="Started"
            value={`${relativeTime(job.startedAt)} · ${formatVersionTime(job.startedAt)}`}
          />
          {job.worktreePath && <InfoRow label="Worktree" value={job.worktreePath} mono />}
        </div>

        {job.files && job.files.length > 0 && (
          <div>
            <p style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
              Changed files ({job.files.length})
            </p>
            <ul
              className="max-h-36 overflow-y-auto p-3 space-y-1"
              style={{ background: COLORS.subtle, borderRadius: RADIUS.md, ...F.mono, fontSize: 11, color: COLORS.text }}
            >
              {job.files.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {job.agentPromptPreview && (
          <details>
            <summary
              className="cursor-pointer text-sm font-semibold"
              style={{ color: COLORS.accent }}
            >
              Agent prompt preview
            </summary>
            <pre
              className="mt-2 p-3 overflow-x-auto text-xs whitespace-pre-wrap"
              style={{
                ...F.mono,
                background: COLORS.subtle,
                borderRadius: RADIUS.md,
                color: COLORS.text,
                maxHeight: 240,
              }}
            >
              {job.agentPromptPreview}
            </pre>
          </details>
        )}
      </div>

      <div
        className="overflow-hidden flex flex-col"
        style={{
          background: "#0F1115",
          borderRadius: RADIUS.lg,
          border: `1px solid ${COLORS.border}`,
          minHeight: 420,
          maxHeight: "min(70vh, 720px)",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 px-4 py-2.5 flex-none"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p style={{ ...F.body, fontSize: 13, fontWeight: 600, color: "#E5E5EA" }}>
            Agent logs
            <span style={{ ...F.mono, fontSize: 11, color: "#86868B", fontWeight: 400, marginLeft: 8 }}>
              {logs.length} events{running ? " · live" : ""}
            </span>
          </p>
          <label className="flex items-center gap-2 text-xs" style={{ color: "#86868B" }}>
            <input
              type="checkbox"
              checked={follow}
              onChange={(e) => setFollow(e.target.checked)}
            />
            Follow
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
          {logs.length === 0 ? (
            <p style={{ color: "#86868B", padding: 12 }}>Waiting for log events…</p>
          ) : (
            logs.map((entry, i) => {
              const style = LEVEL_STYLE[entry.level] ?? LEVEL_STYLE.system;
              const open = !!expanded[i];
              return (
                <div
                  key={`${entry.ts}-${i}`}
                  className="py-1 border-b border-white/5"
                >
                  <button
                    type="button"
                    className="w-full text-left flex gap-2 items-start"
                    onClick={() =>
                      entry.detail && setExpanded((s) => ({ ...s, [i]: !s[i] }))
                    }
                    disabled={!entry.detail}
                  >
                    <span style={{ color: "#636366", whiteSpace: "nowrap" }}>
                      {new Date(entry.ts).toLocaleTimeString()}
                    </span>
                    <span
                      className="shrink-0 w-12 font-semibold"
                      style={{ color: style.color }}
                    >
                      {style.label}
                    </span>
                    <span style={{ color: "#E5E5EA", wordBreak: "break-word" }}>
                      {entry.message}
                      {entry.detail ? (
                        <span style={{ color: "#86868B" }}> {open ? "▾" : "▸"}</span>
                      ) : null}
                    </span>
                  </button>
                  {open && entry.detail && (
                    <pre
                      className="mt-1 ml-14 p-2 overflow-x-auto whitespace-pre-wrap"
                      style={{
                        color: "#AEAEB2",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 6,
                        maxHeight: 280,
                      }}
                    >
                      {entry.detail}
                    </pre>
                  )}
                </div>
              );
            })
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

function MetaChip({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs"
      style={{
        background: accent ? COLORS.accentSoft : COLORS.subtle,
        borderRadius: RADIUS.pill,
        border: `1px solid ${accent ? "rgba(217,119,6,0.25)" : COLORS.border}`,
      }}
    >
      <span style={{ color: COLORS.muted, fontWeight: 600 }}>{label}</span>
      <span style={{ color: accent ? COLORS.accent : COLORS.text, fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function InfoRow({
  label,
  value,
  mono,
  error,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  error?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p style={{ ...F.body, fontSize: 11, fontWeight: 600, color: COLORS.muted, marginBottom: 2 }}>
        {label}
      </p>
      <div
        className="truncate"
        style={{
          ...(mono ? F.mono : F.body),
          fontSize: mono ? 11 : 13,
          color: error ? "#FF3B30" : COLORS.text,
        }}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>
    </div>
  );
}
