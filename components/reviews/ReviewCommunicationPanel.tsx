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
    default:
      return "";
  }
}

export function ReviewCommunicationPanel({ review, session: _session, onCommentAdded, refreshKey = 0 }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInternal = user?.role === "internal";
  const counterpart = isInternal ? review.userName : "Engineering";

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
    : `Message engineering — ask questions or share context…`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-none px-5 py-4 border-b" style={{ borderColor: COLORS.border }}>
        <h2 style={{ ...F.body, fontSize: 17, fontWeight: 600, color: COLORS.text }}>Review channel</h2>
        <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
          {isInternal ? `Thread with ${review.userName}` : `Back-and-forth with ${counterpart}`}
        </p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
        {timeline.map((entry) => {
          if (entry.isSystem) {
            return <SystemEvent key={entry.id} entry={entry} />;
          }
          const isOwn = entry.authorId === user?.id;
          const isEngineer = entry.authorRole
            ? entry.authorRole === "internal"
            : entry.authorId
              ? getMockUser(entry.authorId)?.role === "internal"
              : false;
          return (
            <ChatBubble
              key={entry.id}
              side={isOwn ? "right" : "left"}
              author={entry.authorName}
              role={isEngineer ? "engineer" : "pm"}
              time={entry.createdAt}
              text={entry.text}
            />
          );
        })}

        {timeline.length <= 1 && review.status === "pending_review" && isInternal && (
          <p className="text-center py-4" style={{ ...F.body, fontSize: 13, color: COLORS.muted }}>
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

function SystemEvent({ entry }: { entry: TimelineEntry }) {
  const label = systemLabel(entry.kind);
  const isPositive = entry.kind === "approval" || entry.kind === "submission" || entry.kind === "resubmission";
  const isNegative = entry.kind === "changes_requested";

  return (
    <div className="flex flex-col items-center gap-1 py-1">
      <span
        className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
        style={{
          ...F.body,
          color: isNegative ? "#FF3B30" : isPositive ? "#34C759" : COLORS.muted,
          background: isNegative
            ? "rgba(255,59,48,0.08)"
            : isPositive
              ? "rgba(52,199,89,0.08)"
              : COLORS.subtle,
          borderRadius: RADIUS.pill,
        }}
      >
        {label}
      </span>
      {entry.text && entry.kind !== "submission" && (
        <p
          className="max-w-[90%] text-center text-sm px-4 py-2"
          style={{
            ...F.body,
            color: COLORS.text,
            background: COLORS.subtle,
            borderRadius: RADIUS.md,
            lineHeight: 1.5,
          }}
        >
          {entry.text}
        </p>
      )}
      <span style={{ ...F.body, fontSize: 11, color: COLORS.muted }}>
        {entry.authorName} · {relativeTime(entry.createdAt)}
      </span>
    </div>
  );
}

function ChatBubble({
  side,
  author,
  role,
  time,
  text,
}: {
  side: "left" | "right";
  author: string;
  role: "pm" | "engineer";
  time: number;
  text: string;
}) {
  const isEngineer = role === "engineer";
  const isRight = side === "right";

  return (
    <div className={`flex ${isRight ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isRight ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`flex items-baseline gap-2 ${isRight ? "flex-row-reverse" : ""}`}>
          <span style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.text }}>{author}</span>
          <span style={{ ...F.body, fontSize: 10, color: COLORS.muted }}>
            {isEngineer ? "Engineering" : "Product"} · {relativeTime(time)}
          </span>
        </div>
        <p
          className="px-3.5 py-2.5 text-sm whitespace-pre-wrap"
          style={{
            ...F.body,
            color: isRight ? "#fff" : COLORS.text,
            background: isRight ? COLORS.accent : isEngineer ? "rgba(41,130,204,0.1)" : COLORS.subtle,
            borderRadius: isRight ? `${RADIUS.md}px ${RADIUS.md}px 4px ${RADIUS.md}px` : `${RADIUS.md}px ${RADIUS.md}px ${RADIUS.md}px 4px`,
            lineHeight: 1.55,
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
