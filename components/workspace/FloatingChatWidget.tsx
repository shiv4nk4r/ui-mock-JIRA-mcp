"use client";

import { useRef, useEffect, type KeyboardEvent } from "react";
import type { AttachedFile, Message, UserEngagement, UserRole } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { readFileContent } from "@lib/utils/files";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ChatMarkdown, EffortMarkdown } from "@/components/chat/ChatMarkdown";
import { ExternalEngagementWidget } from "@/components/feedback/ExternalEngagementWidget";
import { InternalFeedbackWidget } from "@/components/feedback/InternalFeedbackWidget";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: Message[];
  isInternal: boolean;
  isStreaming: boolean;
  sessionId: string;
  ticketId: string;
  lastAssistantIdx?: number;
  engagement: UserEngagement[];
  userRole?: UserRole;
  onRefreshEngagement: () => void;
  refineInput: string;
  onRefineInputChange: (value: string) => void;
  attachedFiles: AttachedFile[];
  onAttachedFilesChange: (files: AttachedFile[]) => void;
  onRefine: () => void;
  canRefine: boolean;
  activityPulse?: boolean;
}

export function FloatingChatWidget({
  open,
  onOpenChange,
  messages,
  isInternal,
  isStreaming,
  sessionId,
  ticketId,
  lastAssistantIdx,
  engagement,
  userRole,
  onRefreshEngagement,
  refineInput,
  onRefineInputChange,
  attachedFiles,
  onAttachedFilesChange,
  onRefine,
  canRefine,
  activityPulse,
}: Props) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages, isStreaming]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 20), 96)}px`;
  }, [refineInput, open]);

  function handleRefineKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onRefine();
    }
  }

  const canSend = !isStreaming && !!refineInput.trim() && canRefine;

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-black/20 lg:bg-transparent lg:backdrop-blur-none"
          style={{ backdropFilter: "blur(2px)" }}
          onClick={() => onOpenChange(false)}
          aria-label="Close conversation"
        />
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Conversation"
          className="fixed z-[70] flex flex-col overflow-hidden"
          style={{
            background: COLORS.surface,
            borderRadius: RADIUS.lg,
            border: `1px solid ${COLORS.border}`,
            boxShadow: "0 24px 64px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.04)",
            bottom: 88,
            right: 24,
            width: "min(calc(100vw - 32px), 400px)",
            height: "min(calc(100vh - 120px), 560px)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-24"
            style={{
              background:
                "radial-gradient(ellipse 90% 100% at 50% 0%, rgba(217,119,6,0.09) 0%, transparent 70%)",
            }}
          />

          <div
            className="relative flex-none flex items-start justify-between gap-3 px-5 pt-5 pb-3"
            style={{ borderBottom: `1px solid ${COLORS.border}` }}
          >
            <div className="min-w-0 space-y-1.5">
              <p
                className="inline-flex items-center px-2.5 py-0.5 text-[11px] font-semibold"
                style={{
                  background: COLORS.accentSoft,
                  color: COLORS.accent,
                  borderRadius: RADIUS.pill,
                  ...F.body,
                }}
              >
                Chat
              </p>
              <p
                style={{
                  ...F.body,
                  fontSize: 17,
                  fontWeight: 560,
                  color: COLORS.text,
                  letterSpacing: "-0.02em",
                }}
              >
                Refine mockup
              </p>
              <p style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
                Describe changes in plain language
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 flex items-center justify-center hover:bg-black/5 shrink-0 transition-colors"
              aria-label="Close"
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
          </div>

          <div className="relative flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
            {messages.length === 0 && (
              <div className="py-12 text-center space-y-2 px-4">
                <p style={{ ...F.body, fontSize: 14, fontWeight: 520, color: COLORS.text }}>
                  Start refining
                </p>
                <p style={{ ...F.body, fontSize: 13, color: COLORS.muted, lineHeight: 1.5 }}>
                  Ask for layout, copy, or component changes — updates show up here
                </p>
              </div>
            )}
            {messages.map((msg, midx) => {
              const thinkingActive =
                msg.role === "assistant" && Boolean(msg.thinking) && !msg.thinking!.done;
              const hasHtmlUpdate = msg.role === "assistant" && Boolean(msg.htmlComponent);
              const hasHandoff =
                isInternal &&
                Boolean(msg.effortEstimation || msg.changeLog || msg.agentPrompt);
              const displayText =
                msg.text?.trim() ||
                (hasHtmlUpdate && !msg.isStreaming ? "Updated the mockup." : "");
              const hasBubbleContent =
                msg.role === "user" ||
                Boolean(displayText) ||
                hasHtmlUpdate ||
                hasHandoff ||
                Boolean(msg.isStreaming && !thinkingActive);

              return (
              <div
                key={midx}
                className={`flex flex-col gap-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                {thinkingActive && <ThinkingBlock done={false} />}
                {hasBubbleContent && (
                <div
                  className="max-w-[92%] px-3.5 py-2.5"
                  style={{
                    borderRadius: msg.role === "user" ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
                    background: msg.role === "user" ? COLORS.accent : COLORS.subtle,
                    color: msg.role === "user" ? "#fff" : COLORS.text,
                  }}
                >
                  {msg.role === "user" ? (
                    <span className="whitespace-pre-wrap text-sm" style={{ ...F.body, lineHeight: 1.5 }}>
                      {msg.text}
                    </span>
                  ) : (
                    <>
                      {displayText && (
                        <div className="text-sm" style={{ ...F.body }}>
                          <ChatMarkdown text={displayText} />
                        </div>
                      )}
                      {msg.isStreaming && (
                        <span
                          className="inline-block w-0.5 h-3 ml-0.5 animate-pulse"
                          style={{ background: COLORS.accent }}
                        />
                      )}
                    </>
                  )}
                  {isInternal && msg.effortEstimation && (
                    <div
                      className="mt-3 pt-3 border-t text-sm"
                      style={{ borderColor: msg.role === "user" ? "rgba(255,255,255,0.25)" : COLORS.border }}
                    >
                      <p style={{ ...F.body, fontSize: 11, fontWeight: 520, color: COLORS.muted, marginBottom: 6 }}>
                        Effort estimation
                      </p>
                      <EffortMarkdown text={msg.effortEstimation} />
                    </div>
                  )}
                  {isInternal && msg.changeLog && !msg.isStreaming && (
                    <details className="mt-3 pt-3 border-t" style={{ borderColor: COLORS.border }}>
                      <summary
                        style={{
                          ...F.body,
                          fontSize: 11,
                          fontWeight: 520,
                          color: COLORS.accent,
                          cursor: "pointer",
                        }}
                      >
                        Implementation change log
                      </summary>
                      <div className="mt-2 text-sm">
                        <EffortMarkdown text={msg.changeLog} />
                      </div>
                    </details>
                  )}
                  {isInternal && msg.agentPrompt && !msg.isStreaming && (
                    <details className="mt-3 pt-3 border-t" style={{ borderColor: COLORS.border }}>
                      <summary
                        style={{
                          ...F.body,
                          fontSize: 11,
                          fontWeight: 520,
                          color: COLORS.accent,
                          cursor: "pointer",
                        }}
                      >
                        Agent prompt
                      </summary>
                      <pre
                        className="mt-2 text-xs whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto p-2.5"
                        style={{
                          background: COLORS.surface,
                          borderRadius: RADIUS.md,
                          color: COLORS.text,
                          lineHeight: 1.5,
                          border: `1px solid ${COLORS.border}`,
                        }}
                      >
                        {msg.agentPrompt}
                      </pre>
                    </details>
                  )}
                </div>
                )}
              </div>
              );
            })}
            {isInternal && lastAssistantIdx !== undefined && !isStreaming && (
              <InternalFeedbackWidget
                sessionId={sessionId}
                ticketId={ticketId}
                messageIndex={lastAssistantIdx}
                onSubmitted={onRefreshEngagement}
              />
            )}
            {userRole === "external" &&
              !isStreaming &&
              messages.some((m) => m.role === "assistant" && !m.isStreaming) && (
                <ExternalEngagementWidget
                  sessionId={sessionId}
                  ticketId={ticketId}
                  existing={engagement}
                  onSubmitted={onRefreshEngagement}
                />
              )}
            <div ref={chatEndRef} />
          </div>

          <div
            className="flex-none px-3 pb-3 pt-2"
            style={{ borderTop: `1px solid ${COLORS.border}`, background: COLORS.surface }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="*/*"
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                if (!files.length) return;
                const parsed = await Promise.all(files.map(readFileContent));
                onAttachedFilesChange([...attachedFiles, ...parsed].slice(0, 8));
                e.target.value = "";
              }}
            />
            {attachedFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2 px-0.5">
                {attachedFiles.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 text-xs max-w-full"
                    style={{
                      background: COLORS.subtle,
                      borderRadius: RADIUS.pill,
                      color: COLORS.text,
                      border: `1px solid ${COLORS.border}`,
                      ...F.body,
                      fontWeight: 520,
                    }}
                  >
                    <span className="truncate min-w-0">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => onAttachedFilesChange(attachedFiles.filter((_, j) => j !== i))}
                      className="w-5 h-5 flex items-center justify-center shrink-0 hover:bg-black/5 transition-colors"
                      style={{ color: COLORS.muted, borderRadius: "50%", lineHeight: 1 }}
                      aria-label={`Remove ${f.name}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div
              className="flex items-end gap-1 px-1.5 py-1.5"
              style={{
                background: COLORS.subtle,
                borderRadius: 22,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                className="w-8 h-8 flex items-center justify-center shrink-0 hover:bg-black/[0.06] disabled:opacity-30 transition-colors"
                aria-label="Attach file"
                title="Attach file"
                style={{
                  borderRadius: RADIUS.pill,
                  color: COLORS.muted,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M21.44 11.05l-8.49 8.49a6 6 0 0 1-8.49-8.49l8.49-8.49a4 4 0 0 1 5.66 5.66l-8.49 8.49a2 2 0 0 1-2.83-2.83l7.78-7.78"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <textarea
                ref={inputRef}
                rows={1}
                placeholder="Describe a change…"
                value={refineInput}
                onChange={(e) => onRefineInputChange(e.target.value)}
                onKeyDown={handleRefineKeyDown}
                disabled={isStreaming || !canRefine}
                className="flex-1 bg-transparent text-sm outline-none resize-none overflow-y-auto disabled:opacity-50 self-center"
                style={{
                  ...F.body,
                  color: COLORS.text,
                  caretColor: COLORS.accent,
                  lineHeight: 1.35,
                  minHeight: 20,
                  maxHeight: 96,
                  padding: "6px 4px",
                  margin: 0,
                }}
              />
              <button
                type="button"
                onClick={onRefine}
                disabled={!canSend}
                className="shrink-0 disabled:opacity-35 transition-all"
                aria-label="Send"
                style={{
                  background: canSend ? COLORS.accent : "rgba(0,0,0,0.06)",
                  color: canSend ? "#fff" : COLORS.muted,
                  borderRadius: "50%",
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 0,
                  boxShadow: canSend ? "0 4px 12px rgba(217,119,6,0.28)" : "none",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M12 19V5M5 12l7-7 7 7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="fixed z-[70] flex items-center justify-center transition-transform hover:scale-[1.04] active:scale-95"
        style={{
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: open ? COLORS.text : COLORS.accent,
          color: "#fff",
          border: `2px solid ${COLORS.subtle}`,
          boxShadow: open
            ? "0 8px 24px rgba(0,0,0,0.16)"
            : "0 8px 24px rgba(217,119,6,0.35)",
        }}
        aria-label={open ? "Close conversation" : "Open conversation"}
        title={open ? "Close conversation" : "Conversation"}
      >
        {open ? (
          <span style={{ ...F.body, fontSize: 22, lineHeight: 1 }}>×</span>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {!open && activityPulse && (
          <span
            className="absolute top-0.5 right-0.5 w-3 h-3 rounded-full border-2"
            style={{ background: "#34C759", borderColor: COLORS.subtle }}
          />
        )}
      </button>
    </>
  );
}
