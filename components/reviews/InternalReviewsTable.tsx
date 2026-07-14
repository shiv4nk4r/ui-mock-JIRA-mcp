"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import type { TicketReviewChannel } from "@lib/utils/review-channels";
import { channelActivityLabel } from "@lib/utils/review-channels";
import { formatVersionTime } from "@lib/utils/review-ui";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { ReviewStatusChip } from "@/components/reviews/ReviewStatusChip";
import type { ReviewBuildState, ReviewStatus } from "@lib/types";

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

export function isBuildableReviewStatus(status: ReviewStatus): boolean {
  return status === "approved" || status === "reviewed";
}

function BuildCell({ build }: { build?: ReviewBuildState }) {
  if (build?.status === "running") {
    return build.jobId ? (
      <Link href={`/builds/${build.jobId}`} style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.accent }}>
        Building… →
      </Link>
    ) : (
      <span style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.accent }}>
        Building…
      </span>
    );
  }
  if (build?.prUrl) {
    return (
      <div className="flex flex-col gap-0.5">
        <a
          href={build.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          style={{ color: "#248A3D" }}
        >
          PR{build.prNumber ? ` #${build.prNumber}` : ""} ↗
        </a>
        {build.jobId && (
          <Link href={`/builds/${build.jobId}`} className="text-[11px] font-semibold" style={{ color: COLORS.accent }}>
            Logs →
          </Link>
        )}
      </div>
    );
  }
  if (build?.status === "failed") {
    return build.jobId ? (
      <Link
        href={`/builds/${build.jobId}`}
        style={{ ...F.body, fontSize: 12, fontWeight: 600, color: "#FF3B30" }}
        title={build.error}
      >
        Failed →
      </Link>
    ) : (
      <span style={{ ...F.body, fontSize: 12, fontWeight: 600, color: "#FF3B30" }} title={build.error}>
        Failed
      </span>
    );
  }
  return <span style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>—</span>;
}

function HandoffCell({ channel }: { channel: TicketReviewChannel }) {
  const h = channel.review.handoff;
  if (!h) {
    return <span style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>—</span>;
  }
  if (!h.tshirtSize && !h.storyPoints && !(h.fileChangeCount ?? 0)) {
    return <span style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>—</span>;
  }
  const parts: string[] = [];
  if (h.tshirtSize) parts.push(h.tshirtSize.replace(/^\[|\]$/g, "").trim());
  if (h.storyPoints) parts.push(`${h.storyPoints.replace(/^\[|\]$/g, "").trim()} pts`);
  if ((h.fileChangeCount ?? 0) > 0) parts.push(`${h.fileChangeCount} files`);
  return (
    <span style={{ ...F.body, fontSize: 12, color: COLORS.text, whiteSpace: "nowrap" }}>
      {parts.join(" · ")}
    </span>
  );
}

export function InternalReviewsTable({
  channels,
  emptyTitle,
  emptyBody,
  showBuildColumn = false,
}: {
  channels: TicketReviewChannel[];
  emptyTitle: string;
  emptyBody: string;
  showBuildColumn?: boolean;
}) {
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter(
      (c) =>
        c.ticketId.toLowerCase().includes(q) ||
        c.ticketSummary.toLowerCase().includes(q) ||
        c.review.userName.toLowerCase().includes(q),
    );
  }, [channels, search]);

  if (channels.length === 0) {
    return (
      <div className="text-center py-16 space-y-2">
        <p style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>{emptyTitle}</p>
        <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <p style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
          <strong style={{ color: COLORS.text }}>{channels.length}</strong> ticket
          {channels.length === 1 ? "" : "s"}
        </p>
        <input
          type="search"
          placeholder="Filter by ticket, summary, PM…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:max-w-xs px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/25"
          style={{
            ...F.body,
            background: COLORS.surface,
            color: COLORS.text,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
          }}
        />
      </div>

      {search.trim() && (
        <p style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
          {visible.length} of {channels.length}
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
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.subtle }}>
                <th style={TH}>Ticket</th>
                <th style={{ ...TH, minWidth: 180 }}>Summary</th>
                <th style={TH}>Status</th>
                <th style={TH}>PM</th>
                <th style={TH}>Sizing</th>
                {showBuildColumn && <th style={TH}>Build / PR</th>}
                <th style={TH}>Updated</th>
                <th style={{ ...TH, width: 160 }} />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const buildable = isBuildableReviewStatus(c.review.status);
                return (
                  <tr
                    key={c.review.id}
                    className="hover:bg-gray-50/90 transition-colors"
                    style={{ borderBottom: `1px solid ${COLORS.border}` }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        ...F.mono,
                        fontSize: 13,
                        fontWeight: 600,
                        color: COLORS.accent,
                      }}
                    >
                      {c.ticketId}
                    </td>
                    <td
                      className="max-w-[280px]"
                      style={{ padding: "10px 12px", ...F.body, fontSize: 14, color: COLORS.text }}
                      title={c.ticketSummary}
                    >
                      <span className="line-clamp-1">{c.ticketSummary}</span>
                      <span className="block line-clamp-1 mt-0.5" style={{ fontSize: 12, color: COLORS.muted }}>
                        {c.lastMessagePreview}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <ReviewStatusChip status={c.review.status} />
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        ...F.body,
                        fontSize: 13,
                        color: COLORS.muted,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.review.userName}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <HandoffCell channel={c} />
                    </td>
                    {showBuildColumn && (
                      <td style={{ padding: "10px 12px" }}>
                        <BuildCell build={c.review.build} />
                      </td>
                    )}
                    <td
                      style={{
                        padding: "10px 12px",
                        ...F.body,
                        fontSize: 12,
                        color: COLORS.muted,
                        whiteSpace: "nowrap",
                      }}
                      title={formatVersionTime(c.lastActivityAt)}
                    >
                      {channelActivityLabel(c.lastActivityAt)}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/reviews/${c.review.id}`}
                          className="px-2 py-1 text-xs font-semibold hover:underline"
                          style={{ color: COLORS.accent }}
                        >
                          Open
                        </Link>
                        {showBuildColumn && buildable && (
                          <Link
                            href={`/reviews/${c.review.id}?build=1`}
                            className="px-2.5 py-1 text-xs font-semibold"
                            style={{
                              background: COLORS.accent,
                              color: "#fff",
                              borderRadius: RADIUS.pill,
                            }}
                            title="Open review to run Build"
                          >
                            {c.review.build?.prUrl ? "Rebuild" : "Build"}
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
