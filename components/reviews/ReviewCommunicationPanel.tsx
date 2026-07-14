"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { Comment, MockupSession, ReviewItem, ReviewEventKind, UserRole } from "@lib/types";
import { repository, generateId } from "@lib/storage";
import { useAuth } from "@lib/auth/auth-context";
import { getMockUser } from "@lib/auth/mock-users";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { relativeTime } from "@lib/utils/review-ui";

interface Props {
  review: ReviewItem;
  session: MockupSession | null;
  onCommentAdded: () => void;
  refreshKey?: number;
  onClose?: () => void;
}

interface TimelineEntry {
  id: string;
  kind: ReviewEventKind | "submission";
  authorName: string;
  authorId?: string;
  authorRole?: UserRole;
  text: string;
  createdAt: number;
  isSystem: boolean;
  anchor?: import("@lib/types").MockAnchor;
}

function buildTimeline(review: ReviewItem, comments: Comment[]): TimelineEntry[] {
  const entries: TimelineEntry[] = comments.map((c) => ({
    id: c.id,
    kind: c.kind ?? "message",
    authorName: c.authorName,
    authorId: c.authorId,
    authorRole: c.authorRole,
    text: c.text,
    createdAt: c.createdAt,
    isSystem: c.kind !== undefined && c.kind !== "message",
    anchor: c.anchor,
  }));

  if (!entries.some((e) => e.kind === "submission")) {
    entries.unshift({
      id: `submission-${review.id}`,
      kind: "submission",
      authorName: review.userName,
      authorId: review.userId,
      text: "Submitted mockup for engineering review.",
      createdAt: review.submittedAt,
      isSystem: true,
    });
  }

  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

function systemLabel(kind: TimelineEntry["kind"]): string {
  switch (kind) {
    case "submission":
      return "Mockup submitted";
    case "resubmission":
      return "Mockup updated";
    case "approval":
      return "Approved for build";
    case "changes_requested":
      return "Changes requested";
    case "retraction":
      return "Retracted from review";
    default:
      return "";
  }
}

export function ReviewCommunicationPanel({ review, session: _session, onCommentAdded, refreshKey = 0, onClose }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInternal = user?.role === "internal";
  const counterpart = isInternal ? review.userName : "GCC";

  useEffect(() => {
    repository.getComments(review.id).then(setComments);
  }, [review.id, refreshKey]);

  const timeline = useMemo(() => buildTimeline(review, comments), [review, comments]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [timeline.length]);

  async function sendComment(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !user) return;
    const comment: Comment = {
      id: generateId(),
      targetId: review.id,
      authorName: user.name,
      authorId: user.id,
      authorRole: user.role,
      text: draft.trim(),
      createdAt: Date.now(),
      kind: "message",
    };
    await repository.addComment(comment);
    setComments((prev) => [...prev, comment]);
    setDraft("");
    onCommentAdded();
  }

  const placeholder = isInternal
    ? `Reply to ${review.userName} — questions, clarifications, or change requests…`
    : `Message GCC — ask questions or share context…`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex-none flex items-start justify-between gap-3 px-5 py-4 border-b"
        style={{ borderColor: COLORS.border }}
      >
        <div className="min-w-0 flex-1">
          <h2 style={{ ...F.body, fontSize: 17, fontWeight: 600, color: COLORS.text }}>Review channel</h2>
          <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
            {isInternal ? `Thread with ${review.userName}` : `Back-and-forth with ${counterpart}`}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="Close review channel"
            title="Close"
            style={{ ...F.body, fontSize: 20, color: COLORS.muted, lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4 min-h-0">
        {timeline.map((entry) => {
          const isOwn = entry.authorId === user?.id;
          const side: "left" | "right" = isOwn ? "right" : "left";

          if (entry.isSystem) {
            return <SystemEvent key={entry.id} entry={entry} side={side} />;
          }

          const isEngineer = entry.authorRole
            ? entry.authorRole === "internal"
            : entry.authorId
              ? getMockUser(entry.authorId)?.role === "internal"
              : false;

          return (
            <ChatBubble
              key={entry.id}
              side={side}
              author={entry.authorName}
              role={isEngineer ? "engineer" : "pm"}
              time={entry.createdAt}
              text={entry.text}
              anchored={!!entry.anchor}
            />
          );
        })}

        {timeline.length <= 1 && review.status === "pending_review" && isInternal && (
          <p className="py-2 px-1" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
            Review the mockup and approve or request changes below
          </p>
        )}
      </div>

      <form
        onSubmit={sendComment}
        className="flex-none p-4 border-t"
        style={{ borderColor: COLORS.border, background: COLORS.subtle }}
      >
        <div
          className="flex items-end gap-2 px-3 py-2"
          style={{ background: COLORS.surface, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
        >
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-1 py-1 text-sm outline-none resize-none bg-transparent"
            style={{ ...F.body, color: COLORS.text }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (draft.trim()) e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="shrink-0 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function SystemEvent({ entry, side }: { entry: TimelineEntry; side: "left" | "right" }) {
  const label = systemLabel(entry.kind);
  const isPositive = entry.kind === "approval" || entry.kind === "submission" || entry.kind === "resubmission";
  const isNegative = entry.kind === "changes_requested";
  const isNeutral = entry.kind === "retraction";
  const isRight = side === "right";

  const accentColor = isNegative ? "#FF3B30" : isNeutral ? COLORS.muted : isPositive ? "#34C759" : COLORS.muted;
  const bubbleBg = isNegative
    ? "rgba(255,59,48,0.1)"
    : isNeutral
      ? COLORS.subtle
      : isPositive
        ? "rgba(52,199,89,0.1)"
        : COLORS.subtle;

  return (
    <div className={`w-full flex ${isRight ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`}>
        <span style={{ ...F.body, fontSize: 11, fontWeight: 600, color: COLORS.muted }}>
          {entry.authorName}
        </span>
        <div
          className="px-3.5 py-2.5 text-sm"
          style={{
            ...F.body,
            color: COLORS.text,
            background: bubbleBg,
            borderRadius: isRight
              ? `${RADIUS.md}px ${RADIUS.md}px 4px ${RADIUS.md}px`
              : `${RADIUS.md}px ${RADIUS.md}px ${RADIUS.md}px 4px`,
            borderLeft: isRight ? "none" : `3px solid ${accentColor}`,
            borderRight: isRight ? `3px solid ${accentColor}` : "none",
            lineHeight: 1.5,
          }}
        >
          <span
            className="block text-[11px] font-semibold uppercase tracking-wide mb-1"
            style={{ color: accentColor }}
          >
            {label}
          </span>
          {entry.text && entry.kind !== "submission" && entry.text}
          {entry.kind === "submission" && entry.text}
        </div>
        <span style={{ ...F.body, fontSize: 10, color: COLORS.muted }}>{relativeTime(entry.createdAt)}</span>
      </div>
    </div>
  );
}

function ChatBubble({
  side,
  author,
  role,
  time,
  text,
  anchored,
}: {
  side: "left" | "right";
  author: string;
  role: "pm" | "engineer";
  time: number;
  text: string;
  anchored?: boolean;
}) {
  const isEngineer = role === "engineer";
  const isRight = side === "right";
  const initial = author.charAt(0).toUpperCase();

  return (
    <div className={`w-full flex gap-2 ${isRight ? "justify-end" : "justify-start"}`}>
      {!isRight && (
        <span
          className="shrink-0 w-8 h-8 flex items-center justify-center text-xs font-semibold self-end mb-5"
          style={{
            background: isEngineer ? "rgba(41,130,204,0.15)" : COLORS.accentSoft,
            color: isEngineer ? "#2982CC" : COLORS.accent,
            borderRadius: "50%",
          }}
          aria-hidden
        >
          {initial}
        </span>
      )}

      <div className={`max-w-[78%] flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`}>
        {!isRight && (
          <span style={{ ...F.body, fontSize: 11, fontWeight: 600, color: COLORS.muted, paddingLeft: 2 }}>
            {author}
            <span style={{ fontWeight: 400 }}> · {isEngineer ? "GCC" : "Product"}</span>
          </span>
        )}

        {anchored && <AreaCommentLabel align={isRight ? "right" : "left"} />}

        <p
          className="px-3.5 py-2.5 text-sm whitespace-pre-wrap w-full"
          style={{
            ...F.body,
            color: isRight ? "#fff" : COLORS.text,
            background: isRight ? COLORS.accent : isEngineer ? "rgba(41,130,204,0.12)" : COLORS.subtle,
            borderRadius: isRight
              ? `${RADIUS.md}px ${RADIUS.md}px 4px ${RADIUS.md}px`
              : `${RADIUS.md}px ${RADIUS.md}px ${RADIUS.md}px 4px`,
            lineHeight: 1.55,
            border: isRight ? "none" : `1px solid ${COLORS.border}`,
          }}
        >
          {text}
        </p>

        <span
          className={isRight ? "text-right" : "text-left"}
          style={{ ...F.body, fontSize: 10, color: COLORS.muted, paddingInline: 2, width: "100%" }}
        >
          {isRight ? `You · ${relativeTime(time)}` : relativeTime(time)}
        </span>
      </div>
    </div>
  );
}

function AreaCommentLabel({ align }: { align: "left" | "right" }) {
  return (
    <span
      className={`${align === "right" ? "self-end" : "self-start"} px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide`}
      style={{
        ...F.body,
        color: COLORS.accent,
        background: COLORS.accentSoft,
        borderRadius: RADIUS.pill,
      }}
    >
      Area comment
    </span>
  );
}
