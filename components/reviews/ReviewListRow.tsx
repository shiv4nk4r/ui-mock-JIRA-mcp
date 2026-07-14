"use client";

import Link from "next/link";
import type { TicketReviewChannel } from "@lib/utils/review-channels";
import { channelActivityLabel } from "@lib/utils/review-channels";
import { listDateLabel } from "@lib/utils/review-ui";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { ReviewStatusChip } from "@/components/reviews/ReviewStatusChip";
import { isBuildableReviewStatus } from "@/components/reviews/InternalReviewsTable";
import type { ReviewBuildState } from "@lib/types";

function handoffSummary(channel: TicketReviewChannel): string | null {
  const h = channel.review.handoff;
  if (!h) return null;
  const parts: string[] = [];
  if (h.tshirtSize) parts.push(h.tshirtSize.replace(/^\[|\]$/g, "").trim());
  if (h.storyPoints) parts.push(`${h.storyPoints.replace(/^\[|\]$/g, "").trim()} pts`);
  if ((h.fileChangeCount ?? 0) > 0) parts.push(`${h.fileChangeCount} files`);
  return parts.length ? parts.join(" · ") : null;
}

function BuildHint({ build }: { build?: ReviewBuildState }) {
  if (build?.status === "running") {
    return <span style={{ ...F.body, fontSize: 12, color: COLORS.accent }}>Building…</span>;
  }
  if (build?.prUrl) {
    return (
      <a
        href={build.prUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="hover:underline"
        style={{ ...F.body, fontSize: 12, fontWeight: 560, color: "#248A3D" }}
      >
        PR{build.prNumber ? ` #${build.prNumber}` : ""} ↗
      </a>
    );
  }
  if (build?.status === "failed") {
    return (
      <span style={{ ...F.body, fontSize: 12, color: "#FF3B30" }} title={build.error}>
        Build failed
      </span>
    );
  }
  return null;
}

export function ReviewListRow({
  channel,
  showPm = false,
  showBuild = false,
  highlight = false,
}: {
  channel: TicketReviewChannel;
  showPm?: boolean;
  showBuild?: boolean;
  highlight?: boolean;
}) {
  const { review } = channel;
  const sizing = handoffSummary(channel);
  const buildable = showBuild && isBuildableReviewStatus(review.status);
  const buildHint = showBuild ? <BuildHint build={review.build} /> : null;

  const meta: string[] = [channel.ticketId];
  if (showPm) meta.push(review.userName);
  if (sizing) meta.push(sizing);
  meta.push(channel.lastMessagePreview);

  return (
    <div
      className="group relative flex items-center gap-3 px-3 py-3 transition-colors hover:bg-black/[0.045]"
      style={{
        borderRadius: 14,
        background: highlight ? "rgba(217,119,6,0.04)" : "transparent",
      }}
    >
      <Link href={`/reviews/${review.id}`} className="flex-1 min-w-0 flex items-center gap-4 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p
              className="truncate"
              style={{
                ...F.body,
                fontSize: 15,
                fontWeight: 500,
                color: COLORS.text,
                letterSpacing: "-0.015em",
              }}
              title={channel.ticketSummary}
            >
              {channel.ticketSummary}
            </p>
            <div className="shrink-0 hidden sm:block">
              <ReviewStatusChip status={review.status} compact />
            </div>
          </div>
          <p className="truncate mt-1" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
            {meta.join(" · ")}
          </p>
          <div className="sm:hidden mt-1.5">
            <ReviewStatusChip status={review.status} compact />
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5 pl-2">
          <span className="tabular-nums" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
            {listDateLabel(channel.lastActivityAt)}
          </span>
          {buildHint}
          <span className="sr-only">{channelActivityLabel(channel.lastActivityAt)}</span>
        </div>
      </Link>

      {buildable && (
        <Link
          href={`/reviews/${review.id}?build=1`}
          className="shrink-0 px-3 py-1.5 text-xs font-semibold transition-opacity"
          style={{
            background: COLORS.accent,
            color: "#fff",
            borderRadius: RADIUS.pill,
            ...F.body,
          }}
          title={review.build?.prUrl ? "Rebuild" : "Build"}
        >
          {review.build?.prUrl ? "Rebuild" : "Build"}
        </Link>
      )}
    </div>
  );
}
