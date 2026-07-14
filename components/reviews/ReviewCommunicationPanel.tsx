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
      text: "Submitted mockup for GCC review.",
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

export function ReviewCommunicationPanel({
  review,
  session: _session,
  onCommentAdded,
  refreshKey = 0,
  onClose,
}: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isInternal = user?.role === "internal";
  const counterpart = isInternal ? review.userName : "GCC";

  useEffect(() => {
    repository.getComments(review.id).then(setComments);
  }, [review.id, refreshKey]);

  const timeline = useMemo(() => buildTimeline(review, comments), [review, comments]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [timeline.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
    ? `Reply to ${review.userName}…`
    : `Message GCC…`;

  const canSend = !!draft.trim();

  return (
    <div className="relative flex flex-col h-full min-h-0" style={{ background: COLORS.surface }}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-28"
        style={{
          background:
            "radial-gradient(ellipse 90% 100% at 50% 0%, rgba(217,119,6,0.09) 0%, transparent 70%)",
        }}
      />

      <div
        className="relative flex-none flex items-start justify-between gap-3 px-5 pt-5 pb-4"
        style={{ borderBottom: `1px solid ${COLORS.border}` }}
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <p
            className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold"
            style={{
              background: COLORS.accentSoft,
              color: COLORS.accent,
              borderRadius: RADIUS.pill,
              ...F.body,
            }}
          >
            Channel
          </p>
          <h2
            style={{
              ...F.body,
              fontSize: 17,
              fontWeight: 560,
              color: COLORS.text,
              letterSpacing: "-0.02em",
            }}
          >
            Review thread
          </h2>
          <p className="truncate" style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
            {isInternal ? `With ${review.userName}` : `With ${counterpart}`}
            <span className="mx-1.5" style={{ opacity: 0.4 }}>
              ·
            </span>
            {review.ticketId}
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center hover:bg-black/5 transition-colors"
            aria-label="Close review channel"
            title="Close"
            style={{
              borderRadius: RADIUS.pill,
              ...F.body,
              fontSize: 18,
              color: COLORS.muted,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        )}
      </div>

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto px-4 py-4 space-y-3.5 min-h-0">
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
          <p className="py-6 text-center px-4" style={{ ...F.body, fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
            Review the mockup, then approve or request changes
          </p>
        )}
      </div>

      <form
        onSubmit={sendComment}
        className="relative flex-none px-3 pb-3 pt-2"
        style={{ borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface }}
      >
        <div
          className="flex items-end gap-2 pl-3.5 pr-2 py-2"
          style={{
            background: COLORS.subtle,
            borderRadius: RADIUS.pill,
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-0.5 py-1.5 text-sm outline-none resize-none bg-transparent max-h-24"
            style={{ ...F.body, color: COLORS.text, caretColor: COLORS.accent, lineHeight: 1.5 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (draft.trim()) e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={!canSend}
            className="shrink-0 disabled:opacity-35 transition-opacity"
            aria-label="Send"
            style={{
              background: canSend ? COLORS.accent : "transparent",
              color: canSend ? "#fff" : COLORS.muted,
              borderRadius: "50%",
              width: 34,
              height: 34,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 600,
              boxShadow: canSend ? "0 4px 12px rgba(217,119,6,0.28)" : "none",
            }}
          >
            ↑
          </button>
        </div>
      </form>
    </div>
  );
}

function SystemEvent({ entry, side }: { entry: TimelineEntry; side: "left" | "right" }) {
  const label = systemLabel(entry.kind);
  const isPositive =
    entry.kind === "approval" || entry.kind === "submission" || entry.kind === "resubmission";
  const isNegative = entry.kind === "changes_requested";
  const isRight = side === "right";

  const accentColor = isNegative ? "#C62828" : isPositive ? "#248A3D" : COLORS.muted;
  const bubbleBg = isNegative
    ? "rgba(255,59,48,0.08)"
    : isPositive
      ? "rgba(52,199,89,0.1)"
      : COLORS.subtle;

  return (
    <div className={`w-full flex ${isRight ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`}>
        <span style={{ ...F.body, fontSize: 11, fontWeight: 520, color: COLORS.muted }}>
          {entry.authorName}
        </span>
        <div
          className="px-3.5 py-2.5 text-sm"
          style={{
            ...F.body,
            color: COLORS.text,
            background: bubbleBg,
            borderRadius: isRight ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
            lineHeight: 1.5,
          }}
        >
          <span
            className="block text-[11px] font-semibold mb-1"
            style={{ color: accentColor }}
          >
            {label}
          </span>
          {entry.text}
        </div>
        <span style={{ ...F.body, fontSize: 10, color: COLORS.muted }}>
          {relativeTime(entry.createdAt)}
        </span>
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
            background: isEngineer ? COLORS.subtle : COLORS.accentSoft,
            color: isEngineer ? COLORS.text : COLORS.accent,
            borderRadius: "50%",
            border: `1px solid ${COLORS.border}`,
          }}
          aria-hidden
        >
          {initial}
        </span>
      )}

      <div className={`max-w-[78%] flex flex-col gap-1 ${isRight ? "items-end" : "items-start"}`}>
        {!isRight && (
          <span style={{ ...F.body, fontSize: 11, fontWeight: 520, color: COLORS.muted, paddingLeft: 2 }}>
            {author}
            <span style={{ fontWeight: 400 }}> · {isEngineer ? "GCC" : "Product"}</span>
          </span>
        )}

        {anchored && <AreaCommentLabel align={isRight ? "right" : "left"} />}

        <p
          className="px-3.5 py-2.5 text-sm whitespace-pre-wrap w-full break-words"
          style={{
            ...F.body,
            color: isRight ? "#fff" : COLORS.text,
            background: isRight ? COLORS.accent : COLORS.subtle,
            borderRadius: isRight ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
            lineHeight: 1.55,
            overflowWrap: "anywhere",
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
      className={`${align === "right" ? "self-end" : "self-start"} px-2 py-0.5 text-[10px] font-semibold`}
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
