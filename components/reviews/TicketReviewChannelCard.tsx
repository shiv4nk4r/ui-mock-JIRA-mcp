"use client";

import Link from "next/link";
import type { TicketReviewChannel } from "@lib/utils/review-channels";
import { channelActivityLabel } from "@lib/utils/review-channels";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { normalizeMockupHtml } from "@lib/utils/mockup-html";
import { ReviewStatusChip } from "@/components/reviews/ReviewStatusChip";

function MockThumb({ html }: { html: string }) {
  return (
    <div
      className="shrink-0 overflow-hidden border"
      style={{ width: 72, height: 52, borderRadius: RADIUS.sm, borderColor: COLORS.border, background: "#fff" }}
    >
      <iframe
        srcDoc={normalizeMockupHtml(html)}
        sandbox="allow-scripts"
        title="Preview"
        className="w-[200%] h-[200%] origin-top-left pointer-events-none"
        style={{ transform: "scale(0.5)", border: "none" }}
      />
    </div>
  );
}

export function TicketReviewChannelCard({
  channel,
  showPm = false,
  highlight = false,
}: {
  channel: TicketReviewChannel;
  showPm?: boolean;
  highlight?: boolean;
}) {
  const { review } = channel;

  return (
    <Link
      href={`/reviews/${review.id}`}
      className="flex items-start gap-4 p-4 transition-colors hover:bg-gray-50/90"
      style={{
        background: highlight ? "rgba(255,149,0,0.04)" : COLORS.surface,
        borderLeft: highlight ? `3px solid ${COLORS.accent}` : "3px solid transparent",
      }}
    >
      <MockThumb html={review.activeHtml} />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="truncate flex-1 min-w-0" style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>
            {channel.ticketSummary}
          </p>
          <ReviewStatusChip status={review.status} />
        </div>
        <p style={{ ...F.mono, fontSize: 12, color: COLORS.muted }}>{channel.ticketId}</p>
        <p
          className="text-sm line-clamp-2"
          style={{
            ...F.body,
            color: COLORS.text,
            background: COLORS.subtle,
            borderRadius: RADIUS.sm,
            padding: "8px 12px",
            lineHeight: 1.45,
          }}
        >
          {channel.lastMessagePreview}
        </p>
        <div className="flex items-center gap-2 flex-wrap" style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
          {showPm && (
            <>
              <span
                className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-semibold"
                style={{ background: COLORS.accentSoft, color: COLORS.accent, borderRadius: "50%" }}
              >
                {review.userName.charAt(0)}
              </span>
              <span>{review.userName}</span>
              <span>·</span>
            </>
          )}
          <span>{channelActivityLabel(channel.lastActivityAt)}</span>
          {channel.messageCount > 0 && (
            <>
              <span>·</span>
              <span>{channel.messageCount} message{channel.messageCount === 1 ? "" : "s"}</span>
            </>
          )}
        </div>
      </div>
      <span className="shrink-0 text-lg pt-1" style={{ color: COLORS.muted }}>›</span>
    </Link>
  );
}
