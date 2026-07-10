"use client";

import Link from "next/link";
import { useState } from "react";
import type { TicketHistoryGroup } from "@lib/utils/session-history";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { SessionStatusChip } from "@/components/shared/SessionStatusChip";
import { jiraTicketUrl } from "@lib/utils/jira";

function formatWhen(ts?: number) {
  if (!ts) return "";
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function MockPreview({ html, label }: { html: string; label: string }) {
  return (
    <div
      className="relative overflow-hidden border"
      style={{ borderColor: COLORS.border, borderRadius: RADIUS.sm, height: 140, background: "#fff" }}
    >
      <iframe
        srcDoc={html}
        sandbox="allow-scripts"
        title={label}
        className="w-[200%] h-[200%] origin-top-left pointer-events-none"
        style={{ transform: "scale(0.5)", border: "none" }}
      />
    </div>
  );
}

function TicketGroup({ group, jiraBaseUrl }: { group: TicketHistoryGroup; jiraBaseUrl: string }) {
  const [open, setOpen] = useState(false);

  return (
    <article
      style={{
        background: COLORS.surface,
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-gray-50/80 transition-colors"
        style={{ borderRadius: open ? `${RADIUS.lg}px ${RADIUS.lg}px 0 0` : RADIUS.lg }}
      >
        {group.latestHtml && (
          <div className="hidden sm:block w-28 shrink-0">
            <MockPreview html={group.latestHtml} label={group.summary} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span style={{ ...F.mono, fontSize: 13, color: COLORS.accent }}>{group.ticketId}</span>
            <SessionStatusChip status={group.status} />
            <span style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
              {group.revisionCount} {group.revisionCount === 1 ? "version" : "versions"}
            </span>
          </div>
          <h2 className="truncate" style={{ ...F.body, fontSize: 17, fontWeight: 600, color: COLORS.text }}>
            {group.summary}
          </h2>
          <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
            Updated {formatWhen(group.savedAt)}
          </p>
        </div>
        <span className="shrink-0 pt-1" style={{ ...F.body, fontSize: 18, color: COLORS.muted }}>
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t" style={{ borderColor: COLORS.border }}>
          <div className="flex items-center justify-between gap-3 py-4">
            <a
              href={jiraTicketUrl(group.ticketId, jiraBaseUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm hover:underline"
              style={{ ...F.mono, color: COLORS.accent }}
            >
              Open in JIRA ↗
            </a>
            <Link
              href={`/workspace/${encodeURIComponent(group.ticketId)}`}
              className="px-4 py-2 text-sm font-semibold"
              style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
            >
              Open workspace
            </Link>
          </div>

          <ol className="relative pl-6 space-y-6">
            <div
              className="absolute left-[7px] top-2 bottom-2 w-px"
              style={{ background: COLORS.border }}
              aria-hidden
            />
            {group.revisions.map((rev, idx) => (
              <li key={rev.id} className="relative">
                <span
                  className="absolute -left-6 top-1.5 w-3.5 h-3.5 rounded-full border-2"
                  style={{
                    background: idx === group.revisions.length - 1 ? COLORS.accent : COLORS.surface,
                    borderColor: idx === group.revisions.length - 1 ? COLORS.accent : COLORS.border,
                  }}
                />
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <p style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text }}>
                      {rev.label}
                    </p>
                    {rev.timestamp && (
                      <span style={{ ...F.body, fontSize: 12, color: COLORS.muted, flexShrink: 0 }}>
                        {formatWhen(rev.timestamp)}
                      </span>
                    )}
                  </div>
                  {rev.prompt && (
                    <p
                      className="text-sm px-3 py-2"
                      style={{
                        ...F.body,
                        color: COLORS.text,
                        background: COLORS.subtle,
                        borderRadius: RADIUS.sm,
                        borderLeft: `3px solid ${COLORS.accent}`,
                      }}
                    >
                      “{rev.prompt}”
                    </p>
                  )}
                  {rev.html && (
                    <div className="max-w-md">
                      <MockPreview html={rev.html} label={rev.label} />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

export function MockHistoryTimeline({
  groups,
  jiraBaseUrl,
}: {
  groups: TicketHistoryGroup[];
  jiraBaseUrl: string;
}) {
  if (groups.length === 0) {
    return (
      <p className="text-center py-16" style={{ ...F.body, fontSize: 15, color: COLORS.muted }}>
        No mockup history yet — create one from Home
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <TicketGroup key={group.ticketId} group={group} jiraBaseUrl={jiraBaseUrl} />
      ))}
    </div>
  );
}
