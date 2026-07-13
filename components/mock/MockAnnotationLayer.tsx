"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Comment, MockAnchor, UserRole } from "@lib/types";
import { repository, generateId } from "@lib/storage";
import { useAuth } from "@lib/auth/auth-context";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { relativeTime } from "@lib/utils/review-ui";
import { MockupIframe } from "@/components/shared/MockupIframe";

type AnnotateMode = "off" | "area";

interface Props {
  html: string;
  targetId: string;
  title?: string;
  className?: string;
  onCommentsChange?: () => void;
}

interface DraftBox {
  anchor: MockAnchor;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function MockAnnotationLayer({
  html,
  targetId,
  title = "Mockup",
  className = "",
  onCommentsChange,
}: Props) {
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [mode, setMode] = useState<AnnotateMode>("off");
  const [draft, setDraft] = useState<DraftBox | null>(null);
  const [draftText, setDraftText] = useState("");
  const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  const areaComments = useMemo(() => comments.filter((c) => c.anchor), [comments]);

  const loadComments = useCallback(async () => {
    const list = await repository.getComments(targetId);
    setComments(list);
  }, [targetId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  function pctFromEvent(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clampPct(((e.clientX - rect.left) / rect.width) * 100),
      y: clampPct(((e.clientY - rect.top) / rect.height) * 100),
    };
  }

  function handleOverlayMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "area") return;
    e.preventDefault();
    const pt = pctFromEvent(e);
    if (!pt) return;
    setDragStart(pt);
    setDragCurrent(pt);
    setDraft(null);
    setActiveCommentId(null);
  }

  function handleOverlayMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "area" || !dragStart) return;
    const pt = pctFromEvent(e);
    if (pt) setDragCurrent(pt);
  }

  function handleOverlayMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    if (mode !== "area" || !dragStart || !dragCurrent) return;
    const pt = pctFromEvent(e) ?? dragCurrent;
    const x = Math.min(dragStart.x, pt.x);
    const y = Math.min(dragStart.y, pt.y);
    const width = Math.abs(pt.x - dragStart.x);
    const height = Math.abs(pt.y - dragStart.y);
    setDragStart(null);
    setDragCurrent(null);
    if (width < 1.5 && height < 1.5) return;
    setDraft({
      anchor: { x, y, width, height },
    });
    setDraftText("");
  }

  async function submitComment(e: FormEvent) {
    e.preventDefault();
    if (!user || !draft || !draftText.trim()) return;
    const comment: Comment = {
      id: generateId(),
      targetId,
      authorName: user.name,
      authorId: user.id,
      authorRole: user.role,
      text: draftText.trim(),
      createdAt: Date.now(),
      kind: "message",
      anchor: draft.anchor,
    };
    await repository.addComment(comment);
    setComments((prev) => [...prev, comment]);
    setDraft(null);
    setDraftText("");
    onCommentsChange?.();
  }

  const dragRect =
    dragStart && dragCurrent
      ? {
          x: Math.min(dragStart.x, dragCurrent.x),
          y: Math.min(dragStart.y, dragCurrent.y),
          width: Math.abs(dragCurrent.x - dragStart.x),
          height: Math.abs(dragCurrent.y - dragStart.y),
        }
      : null;

  const activeComment = areaComments.find((c) => c.id === activeCommentId);

  return (
    <div className={`relative w-full h-full flex flex-col min-h-0 ${className}`}>
      <div
        className="flex-none flex items-center gap-2 px-3 py-2 border-b min-h-[44px]"
        style={{ borderColor: COLORS.border, background: COLORS.surface }}
      >
        <span style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.muted, whiteSpace: "nowrap" }}>
          Mock comments
        </span>
        <ModeButton active={mode === "off"} onClick={() => setMode("off")} label="View" />
        <ModeButton active={mode === "area"} onClick={() => setMode("area")} label="Draw area" />
        <span
          className="ml-auto text-right min-w-0"
          style={{ ...F.body, fontSize: 11, color: COLORS.muted, lineHeight: 1.35 }}
        >
          {mode === "area" ? (
            "Drag on the mockup to highlight an area, then add your comment."
          ) : areaComments.length > 0 ? (
            `${areaComments.length} area comment${areaComments.length !== 1 ? "s" : ""}`
          ) : null}
        </span>
      </div>

      <div ref={containerRef} className="relative flex-1 min-h-0 bg-white">
        <MockupIframe html={html} className="w-full h-full" title={title} />

        {areaComments.map((comment, index) => (
          <button
            key={comment.id}
            type="button"
            onClick={() => {
              setActiveCommentId(comment.id);
              setDraft(null);
            }}
            className="absolute border-2 transition-shadow hover:shadow-md"
            style={{
              left: `${comment.anchor!.x}%`,
              top: `${comment.anchor!.y}%`,
              width: `${comment.anchor!.width}%`,
              height: `${comment.anchor!.height}%`,
              borderColor: activeCommentId === comment.id ? COLORS.accent : "rgba(217,119,6,0.65)",
              background:
                activeCommentId === comment.id ? "rgba(217,119,6,0.18)" : "rgba(217,119,6,0.08)",
              borderRadius: RADIUS.sm,
              zIndex: 15,
            }}
            title={comment.text}
          >
            <span
              className="absolute -top-2 -left-2 w-5 h-5 flex items-center justify-center text-[10px] font-bold"
              style={{ background: COLORS.accent, color: "#fff", borderRadius: "50%" }}
            >
              {index + 1}
            </span>
          </button>
        ))}

        {dragRect && mode === "area" && (
          <div
            className="absolute border-2 border-dashed pointer-events-none"
            style={{
              left: `${dragRect.x}%`,
              top: `${dragRect.y}%`,
              width: `${dragRect.width}%`,
              height: `${dragRect.height}%`,
              borderColor: COLORS.accent,
              background: "rgba(217,119,6,0.12)",
              zIndex: 20,
            }}
          />
        )}

        {draft && (
          <div
            className="absolute border-2 pointer-events-none"
            style={{
              left: `${draft.anchor.x}%`,
              top: `${draft.anchor.y}%`,
              width: `${draft.anchor.width}%`,
              height: `${draft.anchor.height}%`,
              borderColor: COLORS.accent,
              background: "rgba(217,119,6,0.15)",
              zIndex: 20,
            }}
          />
        )}

        {mode === "area" && (
          <div
            className="absolute inset-0"
            style={{ cursor: "crosshair", zIndex: 25 }}
            onMouseDown={handleOverlayMouseDown}
            onMouseMove={handleOverlayMouseMove}
            onMouseUp={handleOverlayMouseUp}
            onMouseLeave={() => {
              if (dragStart) {
                setDragStart(null);
                setDragCurrent(null);
              }
            }}
          />
        )}

        {(draft || activeComment) && (
          <div
            className="absolute z-30 w-[min(92%,280px)] p-3 shadow-lg"
            style={{
              background: COLORS.surface,
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
              right: 12,
              bottom: 12,
            }}
          >
            {draft ? (
              <form onSubmit={submitComment} className="space-y-2">
                <p style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.text }}>
                  New area comment
                </p>
                <textarea
                  rows={3}
                  autoFocus
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  placeholder="What should change here?"
                  className="w-full px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: COLORS.subtle, borderRadius: RADIUS.sm, border: `1px solid ${COLORS.border}`, ...F.body }}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setDraft(null)} className="flex-1 py-2 text-sm" style={{ color: COLORS.muted, ...F.body }}>
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!draftText.trim()}
                    className="flex-1 py-2 text-sm font-semibold disabled:opacity-40"
                    style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
                  >
                    Add comment
                  </button>
                </div>
              </form>
            ) : activeComment ? (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p style={{ ...F.body, fontSize: 12, fontWeight: 600, color: COLORS.text }}>
                      {activeComment.authorName}
                      <RoleBadge role={activeComment.authorRole} />
                    </p>
                    <p style={{ ...F.body, fontSize: 10, color: COLORS.muted }}>
                      {relativeTime(activeComment.createdAt)}
                    </p>
                  </div>
                  <button type="button" onClick={() => setActiveCommentId(null)} style={{ color: COLORS.muted }}>
                    ×
                  </button>
                </div>
                <p style={{ ...F.body, fontSize: 13, color: COLORS.text, lineHeight: 1.5 }}>{activeComment.text}</p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 text-xs font-medium"
      style={{
        ...F.body,
        borderRadius: RADIUS.pill,
        background: active ? COLORS.accentSoft : "transparent",
        color: active ? COLORS.accent : COLORS.muted,
        border: `1px solid ${active ? "rgba(217,119,6,0.25)" : COLORS.border}`,
      }}
    >
      {label}
    </button>
  );
}

function RoleBadge({ role }: { role?: UserRole }) {
  if (!role) return null;
  return (
    <span style={{ ...F.body, fontSize: 10, color: COLORS.muted, marginLeft: 6 }}>
      · {role === "internal" ? "Engineering" : "Product"}
    </span>
  );
}
