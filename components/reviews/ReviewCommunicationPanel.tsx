"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Comment, MockupSession, ReviewItem, UserEngagement } from "@lib/types";
import { repository, generateId } from "@lib/storage";
import { useAuth } from "@lib/auth/auth-context";
import { getMockUser } from "@lib/auth/mock-users";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { extractPmRevisions, initialMockLabel, relativeTime } from "@lib/utils/review-ui";

interface Props {
  review: ReviewItem;
  session: MockupSession | null;
  engagement: UserEngagement[];
  onCommentAdded: () => void;
  refreshKey?: number;
}

export function ReviewCommunicationPanel({ review, session, engagement, onCommentAdded, refreshKey = 0 }: Props) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    repository.getComments(review.id).then(setComments);
  }, [review.id, refreshKey]);

  const revisions = extractPmRevisions(session);
  const feedback = engagement.filter((e) => e.type === "feedback");

  async function sendComment(e: FormEvent) {
    e.preventDefault();
    if (!draft.trim() || !user) return;
    const comment: Comment = {
      id: generateId(),
      targetId: review.id,
      authorName: user.name,
      authorId: user.id,
      text: draft.trim(),
      createdAt: Date.now(),
    };
    await repository.addComment(comment);
    setComments((prev) => [...prev, comment]);
    setDraft("");
    onCommentAdded();
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-none px-5 py-4 border-b" style={{ borderColor: COLORS.border }}>
        <h2 style={{ ...F.body, fontSize: 17, fontWeight: 600, color: COLORS.text }}>Conversation</h2>
        <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
          Thread with {review.userName}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 min-h-0">
        <ThreadEvent
          avatar={review.userName.charAt(0)}
          author={review.userName}
          role="pm"
          time={review.submittedAt}
          title="Submitted mockup for review"
          body={initialMockLabel(session?.messages ?? [])}
        />

        {revisions.map((rev) => (
          <ThreadEvent
            key={rev.id}
            avatar={review.userName.charAt(0)}
            author={review.userName}
            role="pm"
            time={rev.timestamp ?? review.submittedAt}
            title="Requested a revision"
            body={rev.prompt}
          />
        ))}

        {feedback.map((f) => (
          <ThreadEvent
            key={f.id}
            avatar={review.userName.charAt(0)}
            author={review.userName}
            role="pm"
            time={f.createdAt}
            title="Session feedback"
            body={f.rating === "positive" ? "👍 Helpful mockup session" : "👎 Mockup needs improvement"}
          />
        ))}

        {comments.map((c) => {
          const isEngineer = c.authorId ? getMockUser(c.authorId)?.role === "internal" : false;
          return (
            <ThreadEvent
              key={c.id}
              avatar={c.authorName.charAt(0)}
              author={c.authorName}
              role={isEngineer ? "engineer" : "pm"}
              time={c.createdAt}
              body={c.text}
            />
          );
        })}

        {revisions.length === 0 && feedback.length === 0 && comments.length === 0 && (
          <p className="text-center py-6" style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
            No replies yet — approve or request changes below
          </p>
        )}
      </div>

      <form
        onSubmit={sendComment}
        className="flex-none p-4 border-t space-y-2"
        style={{ borderColor: COLORS.border, background: COLORS.subtle }}
      >
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message the PM — questions, clarifications, or change requests…"
          className="w-full px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-amber-500/20"
          style={{
            ...F.body,
            background: COLORS.surface,
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
            color: COLORS.text,
          }}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="w-full py-2.5 text-sm font-semibold disabled:opacity-40"
          style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
        >
          Send message
        </button>
      </form>
    </div>
  );
}

function ThreadEvent({
  avatar,
  author,
  role,
  time,
  title,
  body,
}: {
  avatar: string;
  author: string;
  role: "pm" | "engineer";
  time: number;
  title?: string;
  body: string;
}) {
  const isEngineer = role === "engineer";
  return (
    <div className="flex gap-3">
      <span
        className="shrink-0 w-8 h-8 flex items-center justify-center text-xs font-semibold"
        style={{
          background: isEngineer ? "rgba(41,130,204,0.12)" : COLORS.accentSoft,
          color: isEngineer ? "#2982cc" : COLORS.accent,
          borderRadius: "50%",
        }}
      >
        {avatar}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span style={{ ...F.body, fontSize: 14, fontWeight: 600, color: COLORS.text }}>{author}</span>
          <span style={{ ...F.body, fontSize: 11, color: COLORS.muted }}>
            {isEngineer ? "Engineering" : "Product"}
          </span>
          <span style={{ ...F.body, fontSize: 11, color: COLORS.muted }}>{relativeTime(time)}</span>
        </div>
        {title && (
          <p style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.muted, marginTop: 2 }}>{title}</p>
        )}
        <p
          className="mt-1.5 px-3 py-2.5 text-sm whitespace-pre-wrap"
          style={{
            ...F.body,
            color: COLORS.text,
            background: isEngineer ? "rgba(41,130,204,0.06)" : COLORS.subtle,
            borderRadius: RADIUS.md,
            borderLeft: `3px solid ${isEngineer ? "#2982cc" : COLORS.accent}`,
            lineHeight: 1.55,
          }}
        >
          {body}
        </p>
      </div>
    </div>
  );
}
