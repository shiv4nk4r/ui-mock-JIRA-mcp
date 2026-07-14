"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "@lib/auth/auth-context";
import { repository } from "@lib/storage";
import type { HistorySort, TicketHistoryGroup } from "@lib/utils/session-history";
import { filterHistoryGroups, sortHistoryGroups } from "@lib/utils/session-history";
import { formatCostUsd, shortModelName } from "@lib/utils/usage-cost";
import { formatVersionTime, relativeTime } from "@lib/utils/review-ui";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { SessionStatusChip } from "@/components/shared/SessionStatusChip";
import { DeleteTicketHistoryModal } from "@/components/workspace/DeleteTicketHistoryModal";
import { jiraTicketUrl } from "@lib/utils/jira";
import { mockupGenerationStore } from "@lib/mockup/generation-store";

const SORT_OPTIONS: { value: HistorySort; label: string }[] = [
  { value: "time_desc", label: "Newest" },
  { value: "time_asc", label: "Oldest" },
  { value: "ticket_asc", label: "Ticket A→Z" },
  { value: "ticket_desc", label: "Ticket Z→A" },
];

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

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function HistoryRow({
  group,
  jiraBaseUrl,
  expanded,
  onToggle,
  onDelete,
}: {
  group: TicketHistoryGroup;
  jiraBaseUrl: string;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const lastActivity = relativeTime(group.savedAt);

  return (
    <>
      <tr
        className="group cursor-pointer hover:bg-gray-50/90 transition-colors"
        onClick={onToggle}
        style={{ borderBottom: expanded ? "none" : `1px solid ${COLORS.border}` }}
      >
        <td style={{ padding: "10px 12px", ...F.mono, fontSize: 13, fontWeight: 600, color: COLORS.accent }}>
          {group.ticketId}
        </td>
        <td
          className="max-w-[280px]"
          style={{ padding: "10px 12px", ...F.body, fontSize: 14, color: COLORS.text }}
          title={group.summary}
        >
          <span className="line-clamp-1">{group.summary}</span>
          {group.latestPrompt && (
            <span className="block line-clamp-1 mt-0.5" style={{ fontSize: 12, color: group.building ? "#2982cc" : COLORS.muted }}>
              {truncate(group.latestPrompt, 72)}
            </span>
          )}
        </td>
        <td style={{ padding: "10px 12px" }}>
          {group.building ? (
            <span
              className="inline-flex items-center gap-1.5"
              style={{
                ...F.body,
                fontSize: 12,
                fontWeight: 500,
                color: "#2982cc",
                background: "rgba(41,130,204,0.1)",
                padding: "3px 10px",
                borderRadius: RADIUS.pill,
              }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "#2982cc" }}
              />
              Building
            </span>
          ) : (
            <SessionStatusChip status={group.status} />
          )}
        </td>
        <td style={{ padding: "10px 12px", ...F.body, fontSize: 13, color: COLORS.text, textAlign: "center" }}>
          {group.revisionCount}
        </td>
        <td style={{ padding: "10px 12px", ...F.body, fontSize: 13, color: COLORS.muted, textAlign: "center" }}>
          {group.messageCount}
        </td>
        <td
          style={{
            padding: "10px 12px",
            ...F.mono,
            fontSize: 12,
            color: group.totalCostUsd > 0 ? COLORS.text : COLORS.muted,
            textAlign: "right",
            whiteSpace: "nowrap",
          }}
        >
          {group.totalCostUsd > 0 ? formatCostUsd(group.totalCostUsd) : "—"}
        </td>
        <td
          style={{ padding: "10px 12px", ...F.body, fontSize: 12, color: COLORS.muted, whiteSpace: "nowrap" }}
          title={formatVersionTime(group.savedAt)}
        >
          {lastActivity}
        </td>
        <td style={{ padding: "10px 8px" }} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-0.5 opacity-80 group-hover:opacity-100">
            <Link
              href={`/workspace/${encodeURIComponent(group.ticketId)}`}
              className="px-2 py-1 text-xs font-semibold hover:underline"
              style={{ color: COLORS.accent }}
              title={group.building ? "Open workspace (building in background)" : "Open workspace"}
            >
              {group.building ? "View" : "Open"}
            </Link>
            <a
              href={jiraTicketUrl(group.ticketId, jiraBaseUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2 py-1 text-xs"
              style={{ color: COLORS.muted }}
              title="Open in JIRA"
            >
              JIRA
            </a>
            <button
              type="button"
              onClick={onDelete}
              className="px-2 py-1 text-xs"
              style={{ color: "#D70015" }}
              title="Delete all history"
            >
              Delete
            </button>
            <span style={{ ...F.body, fontSize: 14, color: COLORS.muted, padding: "0 4px" }}>
              {expanded ? "▾" : "▸"}
            </span>
          </div>
        </td>
      </tr>

      {expanded && (
        <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.subtle }}>
          <td colSpan={8} style={{ padding: "0 12px 12px" }}>
            <div
              className="overflow-x-auto mt-2"
              style={{
                background: COLORS.surface,
                borderRadius: RADIUS.md,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                    <th style={TH}>#</th>
                    <th style={TH}>Version</th>
                    <th style={{ ...TH, minWidth: 200 }}>Prompt / note</th>
                    <th style={TH}>When</th>
                    <th style={{ ...TH, textAlign: "right" }}>Cost</th>
                    <th style={TH}>Model</th>
                  </tr>
                </thead>
                <tbody>
                  {group.revisions.map((rev, idx) => (
                    <tr key={rev.id} style={{ borderBottom: idx < group.revisions.length - 1 ? `1px solid ${COLORS.border}` : undefined }}>
                      <td style={{ padding: "8px 12px", ...F.body, fontSize: 12, color: COLORS.muted }}>
                        {idx + 1}
                      </td>
                      <td style={{ padding: "8px 12px", ...F.body, fontSize: 13, fontWeight: 500, color: COLORS.text, whiteSpace: "nowrap" }}>
                        {rev.label}
                      </td>
                      <td style={{ padding: "8px 12px", ...F.body, fontSize: 12, color: COLORS.muted, maxWidth: 360 }}>
                        {rev.prompt ? (
                          <span title={rev.prompt}>“{truncate(rev.prompt, 100)}”</span>
                        ) : (
                          <span style={{ color: COLORS.border }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: "8px 12px", ...F.body, fontSize: 12, color: COLORS.muted, whiteSpace: "nowrap" }}>
                        {rev.timestamp ? formatVersionTime(rev.timestamp) : "—"}
                      </td>
                      <td style={{ padding: "8px 12px", ...F.mono, fontSize: 12, color: COLORS.text, textAlign: "right", whiteSpace: "nowrap" }}>
                        {rev.usage?.costUsd ? formatCostUsd(rev.usage.costUsd) : "—"}
                      </td>
                      <td style={{ padding: "8px 12px", ...F.mono, fontSize: 11, color: COLORS.muted, whiteSpace: "nowrap" }}>
                        {rev.usage?.model ? shortModelName(rev.usage.model) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function MockHistoryTimeline({
  groups,
  jiraBaseUrl,
  onRefresh,
}: {
  groups: TicketHistoryGroup[];
  jiraBaseUrl: string;
  onRefresh?: () => void;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<HistorySort>("time_desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TicketHistoryGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const visible = useMemo(
    () => sortHistoryGroups(filterHistoryGroups(groups, search), sort),
    [groups, search, sort],
  );

  const stats = useMemo(() => {
    const revisions = groups.reduce((n, g) => n + g.revisionCount, 0);
    const cost = groups.reduce((n, g) => n + g.totalCostUsd, 0);
    const building = groups.filter((g) => g.building).length;
    return { tickets: groups.length, revisions, cost, building };
  }, [groups]);

  async function handleDelete() {
    if (!user || !deleteTarget) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await repository.resetTicketHistory(user.id, deleteTarget.ticketId);
      mockupGenerationStore.cancel(user.id, deleteTarget.ticketId);
      setDeleteTarget(null);
      if (expandedId === deleteTarget.ticketId) setExpandedId(null);
      onRefresh?.();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Could not delete ticket history");
      setDeleting(false);
    }
  }

  if (groups.length === 0) {
    return (
      <p className="text-center py-16" style={{ ...F.body, fontSize: 15, color: COLORS.muted }}>
        No mockup history yet — create one from Home
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <DeleteTicketHistoryModal
        open={!!deleteTarget}
        ticketId={deleteTarget?.ticketId ?? ""}
        ticketSummary={deleteTarget?.summary}
        busy={deleting}
        error={deleteError}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError("");
          setDeleting(false);
        }}
        onConfirm={handleDelete}
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
        <span><strong style={{ color: COLORS.text }}>{stats.tickets}</strong> tickets</span>
        <span><strong style={{ color: COLORS.text }}>{stats.revisions}</strong> versions</span>
        {stats.building > 0 && (
          <span><strong style={{ color: "#2982cc" }}>{stats.building}</strong> building</span>
        )}
        {stats.cost > 0 && (
          <span><strong style={{ color: COLORS.text }}>{formatCostUsd(stats.cost)}</strong> total AI cost</span>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            type="search"
            placeholder="Filter by ticket ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/25"
            style={{
              ...F.body,
              background: COLORS.surface,
              color: COLORS.text,
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
            }}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as HistorySort)}
          className="px-3 py-2 text-sm outline-none cursor-pointer sm:min-w-[140px]"
          style={{
            ...F.body,
            background: COLORS.surface,
            color: COLORS.text,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
          }}
          aria-label="Sort history"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {search.trim() && (
        <p style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
          {visible.length} of {groups.length} tickets
        </p>
      )}

      {visible.length === 0 ? (
        <p className="text-center py-12" style={{ ...F.body, fontSize: 15, color: COLORS.muted }}>
          No tickets match your search
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
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.subtle }}>
                <th style={TH}>Ticket</th>
                <th style={{ ...TH, minWidth: 180 }}>Summary</th>
                <th style={TH}>Status</th>
                <th style={{ ...TH, textAlign: "center" }}>Ver.</th>
                <th style={{ ...TH, textAlign: "center" }}>Msgs</th>
                <th style={{ ...TH, textAlign: "right" }}>Cost</th>
                <th style={TH}>Updated</th>
                <th style={{ ...TH, width: 140 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map((group) => (
                <HistoryRow
                  key={group.ticketId}
                  group={group}
                  jiraBaseUrl={jiraBaseUrl}
                  expanded={expandedId === group.ticketId}
                  onToggle={() =>
                    setExpandedId((id) => (id === group.ticketId ? null : group.ticketId))
                  }
                  onDelete={() => {
                    setDeleteError("");
                    setDeleting(false);
                    setDeleteTarget(group);
                  }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
