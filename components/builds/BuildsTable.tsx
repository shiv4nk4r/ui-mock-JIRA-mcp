"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { relativeTime, formatVersionTime } from "@lib/utils/review-ui";
import type { ReviewBuildStatus } from "@lib/types";

export interface BuildListItem {
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
  model?: string;
  logCount?: number;
  active?: boolean;
  startedAt: number;
  updatedAt: number;
  finishedAt?: number;
}

const TH: CSSProperties = {
  ...F.body,
  fontSize: 11,
  fontWeight: 600,
  color: COLORS.muted,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "10px 12px",
  textAlign: "left",
  whiteSpace: "nowrap",
};

function StatusChip({ status }: { status: ReviewBuildStatus }) {
  const map: Record<ReviewBuildStatus, { color: string; bg: string; label: string }> = {
    idle: { color: COLORS.muted, bg: COLORS.subtle, label: "Idle" },
    running: { color: COLORS.accent, bg: COLORS.accentSoft, label: "Running" },
    succeeded: { color: "#248A3D", bg: "rgba(52,199,89,0.12)", label: "Succeeded" },
    failed: { color: "#FF3B30", bg: "rgba(255,59,48,0.1)", label: "Failed" },
  };
  const c = map[status] ?? map.idle;
  return (
    <span
      style={{
        ...F.body,
        fontSize: 12,
        fontWeight: 600,
        color: c.color,
        background: c.bg,
        padding: "3px 10px",
        borderRadius: RADIUS.pill,
      }}
    >
      {c.label}
    </span>
  );
}

export function BuildsTable({ builds }: { builds: BuildListItem[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | ReviewBuildStatus>("all");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return builds.filter((b) => {
      if (filter !== "all" && b.status !== filter) return false;
      if (!q) return true;
      return (
        b.ticketId.toLowerCase().includes(q) ||
        b.ticketSummary.toLowerCase().includes(q) ||
        b.branchName.toLowerCase().includes(q) ||
        b.jobId.toLowerCase().includes(q)
      );
    });
  }, [builds, search, filter]);

  const stats = useMemo(() => {
    const running = builds.filter((b) => b.status === "running").length;
    const ok = builds.filter((b) => b.status === "succeeded").length;
    const failed = builds.filter((b) => b.status === "failed").length;
    return { total: builds.length, running, ok, failed };
  }, [builds]);

  if (builds.length === 0) {
    return (
      <p className="text-center py-16" style={{ ...F.body, fontSize: 15, color: COLORS.muted }}>
        No builds yet — approve a review and click Build PR
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
        <span><strong style={{ color: COLORS.text }}>{stats.total}</strong> builds</span>
        <span><strong style={{ color: COLORS.accent }}>{stats.running}</strong> running</span>
        <span><strong style={{ color: "#248A3D" }}>{stats.ok}</strong> succeeded</span>
        <span><strong style={{ color: "#FF3B30" }}>{stats.failed}</strong> failed</span>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="search"
          placeholder="Filter by ticket, branch, job id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/25"
          style={{
            ...F.body,
            background: COLORS.surface,
            color: COLORS.text,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
          }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-3 py-2 text-sm outline-none sm:min-w-[140px]"
          style={{
            ...F.body,
            background: COLORS.surface,
            color: COLORS.text,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <option value="all">All statuses</option>
          <option value="running">Running</option>
          <option value="succeeded">Succeeded</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="text-center py-12" style={{ ...F.body, fontSize: 15, color: COLORS.muted }}>
          No builds match your filter
        </p>
      ) : (
        <div
          className="overflow-x-auto"
          style={{
            background: COLORS.surface,
            borderRadius: RADIUS.lg,
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          <table className="w-full min-w-[960px] border-collapse">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.subtle }}>
                <th style={TH}>Ticket</th>
                <th style={{ ...TH, minWidth: 160 }}>Summary</th>
                <th style={TH}>Status</th>
                <th style={TH}>Phase</th>
                <th style={TH}>Branch / PR</th>
                <th style={{ ...TH, textAlign: "center" }}>Logs</th>
                <th style={TH}>Started</th>
                <th style={{ ...TH, width: 100 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map((b) => (
                <tr
                  key={b.jobId}
                  className="hover:bg-gray-50/90 transition-colors"
                  style={{ borderBottom: `1px solid ${COLORS.border}` }}
                >
                  <td style={{ padding: "10px 12px", ...F.mono, fontSize: 13, fontWeight: 600, color: COLORS.accent }}>
                    {b.ticketId}
                  </td>
                  <td className="max-w-[240px]" style={{ padding: "10px 12px", ...F.body, fontSize: 14, color: COLORS.text }}>
                    <span className="line-clamp-1">{b.ticketSummary}</span>
                    <span className="block line-clamp-1 mt-0.5" style={{ fontSize: 12, color: COLORS.muted }}>
                      {b.message}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <StatusChip status={b.status} />
                  </td>
                  <td style={{ padding: "10px 12px", ...F.mono, fontSize: 12, color: COLORS.muted }}>
                    {b.phase}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <div className="space-y-0.5">
                      <p style={{ ...F.mono, fontSize: 11, color: COLORS.muted }}>{b.branchName}</p>
                      {b.prUrl ? (
                        <a
                          href={b.prUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold hover:underline"
                          style={{ color: "#248A3D" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          PR{b.prNumber ? ` #${b.prNumber}` : ""} ↗
                        </a>
                      ) : (
                        <span style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>—</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "10px 12px", ...F.body, fontSize: 13, color: COLORS.text, textAlign: "center" }}>
                    {b.logCount ?? 0}
                  </td>
                  <td
                    style={{ padding: "10px 12px", ...F.body, fontSize: 12, color: COLORS.muted, whiteSpace: "nowrap" }}
                    title={formatVersionTime(b.startedAt)}
                  >
                    {relativeTime(b.startedAt)}
                  </td>
                  <td style={{ padding: "10px 8px" }}>
                    <Link
                      href={`/builds/${b.jobId}`}
                      className="px-2.5 py-1 text-xs font-semibold"
                      style={{
                        background: COLORS.accentSoft,
                        color: COLORS.accent,
                        borderRadius: RADIUS.pill,
                      }}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
