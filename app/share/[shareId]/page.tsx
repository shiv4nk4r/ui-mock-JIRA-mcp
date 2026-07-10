"use client";

import { FormEvent, useEffect, useState } from "react";
import { repository, generateId } from "@lib/storage";
import type { Comment, SharedMock } from "@lib/types";
import { F, COLORS } from "@lib/design/tokens";

export default function SharePage({ params }: { params: { shareId: string } }) {
  const [share, setShare] = useState<SharedMock | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [authorName, setAuthorName] = useState("");
  const [commentText, setCommentText] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const s = await repository.getShare(params.shareId);
      setShare(s);
      if (s) setComments(await repository.getComments(params.shareId));
      setLoading(false);
    })();
  }, [params.shareId]);

  async function handleComment(e: FormEvent) {
    e.preventDefault();
    if (!commentText.trim() || !authorName.trim()) return;
    const comment: Comment = {
      id: generateId(),
      targetId: params.shareId,
      authorName: authorName.trim(),
      text: commentText.trim(),
      createdAt: Date.now(),
    };
    await repository.addComment(comment);
    setComments((prev) => [...prev, comment]);
    setCommentText("");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
        <div className="signal-bars"><span /><span /><span /><span /><span /></div>
      </div>
    );
  }

  if (!share) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bg }}>
        <span style={{ ...F.display, fontSize: 32, color: "rgba(217,119,6,0.2)" }}>Share not found</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: COLORS.bg }}>
      <header className="px-6 py-4 border-b" style={{ background: COLORS.surface, borderColor: COLORS.border }}>
        <div style={{ ...F.display, fontSize: 24, color: COLORS.accent }}>MOCK STUDIO</div>
        <div className="mt-1 flex items-center gap-3 flex-wrap">
          <span style={{ ...F.mono, fontSize: 12, color: COLORS.accent }}>{share.ticketId}</span>
          <span style={{ ...F.body, fontSize: 14, color: COLORS.text }}>{share.ticketSummary}</span>
        </div>
        <p className="mt-1" style={{ ...F.condensed, fontSize: 10, color: "#A8A4A0" }}>
          Shared by {share.createdByName} · Read-only view
        </p>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="border overflow-hidden" style={{ borderColor: COLORS.border, minHeight: 500 }}>
          <iframe srcDoc={share.activeHtml} sandbox="allow-scripts" className="w-full bg-white" style={{ minHeight: 500, border: "none" }} title="Shared mockup" />
        </div>

        <div className="space-y-4">
          <div style={{ ...F.condensed, fontSize: 10, color: COLORS.muted, letterSpacing: "0.2em", textTransform: "uppercase" }}>
            Comments ({comments.length})
          </div>
          {comments.map((c) => (
            <div key={c.id} className="px-4 py-3 border" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ ...F.condensed, fontSize: 11, fontWeight: 600 }}>{c.authorName}</span>
                <span style={{ ...F.condensed, fontSize: 9, color: "#A8A4A0" }}>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <p style={{ ...F.body, fontSize: 13, color: COLORS.text }}>{c.text}</p>
            </div>
          ))}

          <form onSubmit={handleComment} className="space-y-3 border p-4" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
            <input
              type="text"
              placeholder="Your name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              className="w-full px-3 py-2 border text-sm outline-none"
              style={{ borderColor: COLORS.border, ...F.body }}
            />
            <textarea
              rows={3}
              placeholder="Add a comment…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full px-3 py-2 border text-sm outline-none resize-none"
              style={{ borderColor: COLORS.border, ...F.body }}
            />
            <button type="submit" className="px-4 py-2 text-xs" style={{ ...F.condensed, background: COLORS.accent, color: "#fff", letterSpacing: "0.1em" }}>
              Post comment
            </button>
          </form>
        </div>

        <p className="text-center pb-8" style={{ ...F.condensed, fontSize: 9, color: "#C4C0BA", letterSpacing: "0.2em" }}>
          Powered by GreyOrange Mock Studio
        </p>
      </div>
    </div>
  );
}
