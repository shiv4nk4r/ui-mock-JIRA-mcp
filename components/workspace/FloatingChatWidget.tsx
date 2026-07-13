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

  useEffect(() => {
    if (!open) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [open, messages, isStreaming]);

  function handleRefineKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onRefine();
    }
  }

  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-[60] bg-black/20 lg:bg-transparent"
          onClick={() => onOpenChange(false)}
          aria-label="Close conversation"
        />
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Conversation"
          className="fixed z-[70] flex flex-col overflow-hidden shadow-2xl"
          style={{
            background: COLORS.surface,
            borderRadius: RADIUS.lg,
            border: `1px solid ${COLORS.border}`,
            bottom: 88,
            right: 24,
            width: "min(calc(100vw - 32px), 400px)",
            height: "min(calc(100vh - 120px), 560px)",
          }}
        >
          <div
            className="flex-none flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: COLORS.border, background: "rgba(255,255,255,0.95)" }}
          >
            <div>
              <p style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text }}>Conversation</p>
              <p style={{ ...F.body, fontSize: 12, color: COLORS.muted, marginTop: 1 }}>
                Refine your mockup in plain language
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              aria-label="Close"
              style={{ ...F.body, fontSize: 18, color: COLORS.muted, lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
            {messages.length === 0 && (
              <p className="text-center py-8" style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
                Describe a change below — updates appear here as you refine
              </p>
            )}
            {messages.map((msg, midx) => (
              <div key={midx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[92%] px-3.5 py-2.5"
                  style={{
                    borderRadius: RADIUS.md,
                    background: msg.role === "user" ? COLORS.accent : COLORS.subtle,
                    color: msg.role === "user" ? "#fff" : COLORS.text,
                  }}
                >
                  {msg.thinking && msg.role === "assistant" && (
                    <ThinkingBlock
                      log={msg.thinking.log}
                      done={msg.thinking.done}
                      elapsed={msg.thinking.elapsed}
                      showMcp={isInternal}
                    />
                  )}
                  {msg.role === "user" ? (
                    <span className="whitespace-pre-wrap text-sm">{msg.text}</span>
                  ) : (
                    <>
                      {msg.text && (
                        <div className="text-sm">
                          <ChatMarkdown text={msg.text} />
                        </div>
                      )}
                      {msg.isStreaming && (
                        <span className="inline-block w-0.5 h-3 bg-amber-400 ml-0.5 animate-pulse" />
                      )}
                    </>
                  )}
                  {isInternal && msg.effortEstimation && (
                    <div className="mt-3 pt-3 border-t text-sm" style={{ borderColor: COLORS.border }}>
                      <p style={{ ...F.body, fontSize: 11, fontWeight: 600, color: COLORS.muted, marginBottom: 6 }}>
                        Effort estimation
                      </p>
                      <EffortMarkdown text={msg.effortEstimation} />
                    </div>
                  )}
                  {isInternal && msg.changeLog && !msg.isStreaming && (
                    <details className="mt-3 pt-3 border-t" style={{ borderColor: COLORS.border }}>
                      <summary style={{ ...F.body, fontSize: 11, fontWeight: 600, color: COLORS.accent, cursor: "pointer" }}>
                        Implementation change log
                      </summary>
                      <div className="mt-2 text-sm">
                        <EffortMarkdown text={msg.changeLog} />
                      </div>
                    </details>
                  )}
                  {isInternal && msg.agentPrompt && !msg.isStreaming && (
                    <details className="mt-3 pt-3 border-t" style={{ borderColor: COLORS.border }}>
                      <summary style={{ ...F.body, fontSize: 11, fontWeight: 600, color: COLORS.accent, cursor: "pointer" }}>
                        Standalone agent prompt
                      </summary>
                      <pre
                        className="mt-2 text-xs whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto p-2"
                        style={{ background: COLORS.surface, borderRadius: RADIUS.sm, color: COLORS.text, lineHeight: 1.5 }}
                      >
                        {msg.agentPrompt}
                      </pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
            {isInternal && lastAssistantIdx !== undefined && !isStreaming && (
              <InternalFeedbackWidget
                sessionId={sessionId}
                ticketId={ticketId}
                messageIndex={lastAssistantIdx}
                onSubmitted={onRefreshEngagement}
              />
            )}
            {userRole === "external" && !isStreaming && messages.some((m) => m.role === "assistant" && !m.isStreaming) && (
              <ExternalEngagementWidget
                sessionId={sessionId}
                ticketId={ticketId}
                existing={engagement}
                onSubmitted={onRefreshEngagement}
              />
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="flex-none px-3 py-3 border-t" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
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
              <div className="flex flex-wrap gap-1.5 mb-2 px-1">
                {attachedFiles.map((f, i) => (
                  <span
                    key={`${f.name}-${i}`}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs"
                    style={{ background: COLORS.subtle, borderRadius: RADIUS.sm, color: COLORS.muted }}
                  >
                    {f.name}
                    <button
                      type="button"
                      onClick={() => onAttachedFilesChange(attachedFiles.filter((_, j) => j !== i))}
                      style={{ color: COLORS.muted }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div
              className="flex items-end gap-2 px-3 py-2"
              style={{ background: COLORS.subtle, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
            >
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                className="p-1.5 opacity-60 hover:opacity-100 disabled:opacity-30"
                aria-label="Attach file"
              >
                📎
              </button>
              <textarea
                rows={1}
                placeholder="Describe a change…"
                value={refineInput}
                onChange={(e) => onRefineInputChange(e.target.value)}
                onKeyDown={handleRefineKeyDown}
                disabled={isStreaming || !canRefine}
                className="flex-1 bg-transparent text-sm outline-none resize-none max-h-24 disabled:opacity-50"
                style={{ ...F.body, color: COLORS.text, lineHeight: 1.5 }}
              />
              <button
                type="button"
                onClick={onRefine}
                disabled={isStreaming || !refineInput.trim() || !canRefine}
                className="p-2 disabled:opacity-30 transition-opacity"
                aria-label="Send"
                style={{
                  background: refineInput.trim() ? COLORS.accent : "transparent",
                  color: refineInput.trim() ? "#fff" : COLORS.muted,
                  borderRadius: "50%",
                  width: 36,
                  height: 36,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                }}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="fixed z-[70] flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95"
        style={{
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: open ? COLORS.text : COLORS.accent,
          color: "#fff",
          border: `2px solid ${COLORS.surface}`,
        }}
        aria-label={open ? "Close conversation" : "Open conversation"}
        title={open ? "Close conversation" : "Conversation"}
      >
        {open ? (
          <span style={{ ...F.body, fontSize: 22, lineHeight: 1 }}>×</span>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {!open && activityPulse && (
          <span
            className="absolute top-0 right-0 w-3 h-3 rounded-full border-2"
            style={{ background: "#34C759", borderColor: COLORS.surface }}
          />
        )}
      </button>
    </>
  );
}
