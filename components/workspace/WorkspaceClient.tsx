"use client";

import { useRef, useState, useEffect, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository, generateId } from "@lib/storage";
import { useMockupGeneration } from "@lib/hooks/use-mockup-generation";
import type { AttachedFile, MockupSession, ProviderConfig, ReviewStatus, TicketData, UserEngagement, UserRole } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { readFileContent, openHtmlInNewTab } from "@lib/utils/files";
import { normalizeMockupHtml } from "@lib/utils/mockup-html";
import { MockupIframe } from "@/components/shared/MockupIframe";
import { submitOrResubmitReview } from "@lib/utils/review-workflow";
import { SessionStatusChip } from "@/components/shared/SessionStatusChip";
import { Toast, IconButton } from "@/components/shared/Toast";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ChatMarkdown, EffortMarkdown } from "@/components/chat/ChatMarkdown";
import { JiraTicketLink } from "@/components/workspace/JiraTicketLink";
import { ExternalEngagementWidget } from "@/components/feedback/ExternalEngagementWidget";
import { InternalFeedbackWidget } from "@/components/feedback/InternalFeedbackWidget";

type Phase = "loading" | "ready";

interface Props {
  ticketId: string;
}

export function WorkspaceClient({ ticketId }: Props) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [isGenerating, setIsGenerating] = useState(false);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [sessionStatus, setSessionStatus] = useState<MockupSession["status"]>("draft");
  const [activeHtml, setActiveHtml] = useState("");
  const [refineInput, setRefineInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus | null>(null);
  const [engagement, setEngagement] = useState<UserEngagement[]>([]);
  const [showChat, setShowChat] = useState(true);
  const [mockFullscreen, setMockFullscreen] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const refineRef = useRef<HTMLTextAreaElement>(null);
  const jiraBaseUrl = process.env.NEXT_PUBLIC_JIRA_BASE_URL ?? "";

  const {
    messages,
    setMessages,
    thinkingLog,
    usageRecords,
    setUsageRecords,
    isStreaming,
    generate,
    refine,
  } = useMockupGeneration();

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg: ProviderConfig) => setSelectedModel(cfg.defaultModel))
      .catch(() => {});
  }, []);

  async function runGeneration(ticket: TicketData, role: UserRole) {
    const id = sessionId || generateId();
    if (!sessionId) setSessionId(id);
    setFetchError("");
    setIsGenerating(true);
    try {
      await generate(
        ticket,
        selectedModel || "claude-haiku-4-5-20251001",
        role,
        (html) => {
          setActiveHtml(normalizeMockupHtml(html));
          setSessionStatus("in_progress");
        },
      );
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : "Mockup generation failed");
    } finally {
      setIsGenerating(false);
    }
  }

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }

    setPhase("loading");
    setFetchError("");
    setTicketData(null);
    setActiveHtml("");
    setSessionId("");
    setMessages([]);
    setIsGenerating(false);

    let cancelled = false;

    (async () => {
      try {
        await repository.migrateLegacySessions(user.id);
        const saved = await repository.getSession(user.id, ticketId);

        let ticket: TicketData;
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 20_000);
          const res = await fetch(`/api/jira?id=${encodeURIComponent(ticketId)}`, {
            signal: controller.signal,
          });
          clearTimeout(timer);
          const data = await res.json();
          if (!res.ok || data.error) {
            throw new Error(data.error ?? "Failed to fetch ticket");
          }
          ticket = data as TicketData;
        } catch (err) {
          if (cancelled) return;
          setFetchError(err instanceof Error ? err.message : "Could not load JIRA ticket");
          setPhase("ready");
          return;
        }

        if (cancelled) return;
        setTicketData(ticket);
        setPhase("ready");

        if (saved?.activeHtml) {
          setSessionId(saved.id);
          setSessionStatus(saved.status);
          setActiveHtml(normalizeMockupHtml(saved.activeHtml));
          setMessages(saved.messages ?? []);
          setUsageRecords(saved.usageRecords ?? []);
          if (saved.selectedModel) setSelectedModel(saved.selectedModel);
          const existingReview = await repository.getReviewByTicket(ticketId, user.id);
          if (existingReview) {
            setReviewId(existingReview.id);
            setReviewStatus(existingReview.status);
          }
          setEngagement(await repository.getEngagement({ sessionId: saved.id }));
          return;
        }

        if (cancelled) return;
        const id = generateId();
        setSessionId(id);
        setIsGenerating(true);
        try {
          await generate(
            ticket,
            selectedModel || "claude-haiku-4-5-20251001",
            user.role,
            (html) => {
              setActiveHtml(normalizeMockupHtml(html));
              setSessionStatus("in_progress");
            },
          );
        } catch (err) {
          if (!cancelled) {
            setFetchError(err instanceof Error ? err.message : "Mockup generation failed");
          }
        } finally {
          if (!cancelled) setIsGenerating(false);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Something went wrong");
          setPhase("ready");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, ticketId, router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  useEffect(() => {
    if (!user || !ticketData || phase !== "ready" || !sessionId) return;
    repository.saveSession({
      id: sessionId,
      userId: user.id,
      ticketId: ticketData.id,
      ticketData,
      messages: messages.map((m) => ({ ...m, isStreaming: false })),
      activeHtml,
      usageRecords,
      selectedModel,
      status: sessionStatus,
      savedAt: Date.now(),
      reviewId: reviewId ?? undefined,
    });
  }, [messages, activeHtml, usageRecords, selectedModel, phase, ticketData, user, sessionId, sessionStatus, reviewId]);

  async function handleRefine() {
    const prompt = refineInput.trim();
    if (!prompt || isStreaming || !activeHtml || !ticketData || !user) return;
    const filesToSend = attachedFiles.length
      ? attachedFiles.map(({ name, type, content, contentType }) => ({ name, type, content, contentType }))
      : undefined;
    setRefineInput("");
    setAttachedFiles([]);
    setShowChat(true);
    try {
      await refine(
        ticketData,
        prompt,
        selectedModel || "claude-haiku-4-5-20251001",
        activeHtml,
        user.role,
        (html) => {
          setActiveHtml(normalizeMockupHtml(html));
          setSessionStatus("in_progress");
        },
        filesToSend,
      );
    } catch { /* shown in chat */ }
  }

  function handleRefineKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleRefine();
    }
  }

  async function handleShare() {
    if (!user || !ticketData || !activeHtml) return;
    const shareId = generateId().slice(-8);
    await repository.createShare({
      id: generateId(),
      shareId,
      sessionId,
      ticketId: ticketData.id,
      ticketSummary: ticketData.summary,
      activeHtml,
      createdBy: user.id,
      createdByName: user.name,
      createdAt: Date.now(),
    });
    const url = `${window.location.origin}/share/${shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      setToast("Link copied — ready to share");
    } catch {
      setToast(url);
    }
  }

  async function handleSendToReview() {
    if (!user || !ticketData || !activeHtml) return;
    try {
      const { reviewId: id, resubmitted } = await submitOrResubmitReview({
        user,
        sessionId,
        ticketId: ticketData.id,
        ticketSummary: ticketData.summary,
        activeHtml,
      });
      setReviewId(id);
      setReviewStatus("pending_review");
      setSessionStatus("pending_review");
      setToast(resubmitted ? "Updated mockup sent back for review" : "Sent to the engineering team for review");
      await repository.saveSession({
        id: sessionId,
        userId: user.id,
        ticketId: ticketData.id,
        ticketData,
        messages: messages.map((m) => ({ ...m, isStreaming: false })),
        activeHtml,
        usageRecords,
        selectedModel,
        status: "pending_review",
        savedAt: Date.now(),
        reviewId: id,
      });
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not send for review");
    }
  }

  async function refreshEngagement() {
    if (!sessionId) return;
    setEngagement(await repository.getEngagement({ sessionId }));
  }

  if (phase === "loading" || authLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-3" style={{ background: COLORS.bg }}>
        <div className="signal-bars"><span /><span /><span /><span /><span /></div>
        <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>Loading ticket…</p>
      </div>
    );
  }

  const isInternal = user?.role === "internal";
  const lastAssistantIdx = messages
    .map((m, i) => (m.role === "assistant" && !m.isStreaming ? i : -1))
    .filter((i) => i >= 0)
    .pop();

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: COLORS.bg }}>
      <Toast message={toast} onDone={() => setToast(null)} />

      {/* Minimal top bar */}
      <header
        className="flex-none flex items-center gap-3 px-4 py-2.5 shrink-0"
        style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="p-2 -ml-1 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Back to home"
          style={{ ...F.body, fontSize: 20, color: COLORS.accent, lineHeight: 1 }}
        >
          ‹
        </button>
        <div className="flex-1 min-w-0">
          <div className="truncate" style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text }}>
            {ticketData?.summary ?? ticketId}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <JiraTicketLink ticketId={ticketData?.id ?? ticketId} jiraBaseUrl={jiraBaseUrl} className="hover:underline" />
            <SessionStatusChip status={sessionStatus} />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <IconButton
            label="Full screen"
            onClick={() => setMockFullscreen(true)}
            disabled={!activeHtml || isStreaming || isGenerating}
          >
            ⛶
          </IconButton>
          <IconButton label="Share" onClick={handleShare} disabled={!activeHtml}>
            ↗
          </IconButton>
          {reviewId && (
            <IconButton label="Review channel" onClick={() => router.push(`/reviews/${reviewId}`)}>
              💬
            </IconButton>
          )}
          {(reviewStatus === "pending_review" || sessionStatus === "pending_review") ? (
            <span style={{ ...F.body, fontSize: 13, color: "#f9b115", fontWeight: 500 }}>In review</span>
          ) : reviewStatus === "needs_changes" ? (
            <IconButton label="Resubmit for review" onClick={handleSendToReview} disabled={!activeHtml} primary>
              Resubmit
            </IconButton>
          ) : reviewStatus === "approved" || sessionStatus === "reviewed" ? (
            <span style={{ ...F.body, fontSize: 13, color: "#34C759", fontWeight: 500 }}>✓ Approved</span>
          ) : (
            <IconButton label="Send to review" onClick={handleSendToReview} disabled={!activeHtml} primary>
              Review
            </IconButton>
          )}
        </div>
      </header>

      {fetchError && (
        <div className="px-4 py-2 text-sm text-center" style={{ background: "rgba(255,59,48,0.08)", color: "#FF3B30" }}>
          {fetchError}
        </div>
      )}

      {/* Split: mockup + chat */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 relative min-h-0 bg-white">
            {isStreaming && activeHtml && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3" style={{ background: "rgba(255,255,255,0.85)" }}>
                <div className="signal-bars"><span /><span /><span /><span /><span /></div>
                <p style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>Updating mockup…</p>
              </div>
            )}
            {isGenerating && !isStreaming && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 px-6" style={{ background: "rgba(255,255,255,0.92)" }}>
                <div className="signal-bars"><span /><span /><span /><span /><span /></div>
                <p style={{ ...F.body, fontSize: 16, fontWeight: 600, color: COLORS.text }}>Creating your mockup</p>
                <p style={{ ...F.body, fontSize: 14, color: COLORS.muted, textAlign: "center" }}>
                  {ticketData?.summary ?? ticketId}
                </p>
                {thinkingLog.length > 0 && (
                  <p className="max-w-md truncate" style={{ ...F.body, fontSize: 12, color: COLORS.muted }}>
                    {thinkingLog[thinkingLog.length - 1]}
                  </p>
                )}
              </div>
            )}
            {activeHtml ? (
              <MockupIframe html={activeHtml} className="w-full h-full" title="Mockup" />
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-4 px-6" style={{ ...F.body, color: COLORS.muted }}>
                {!isGenerating && (
                  <>
                    <p>Mockup will appear here</p>
                    {ticketData && user && (
                      <button
                        type="button"
                        onClick={() => runGeneration(ticketData, user.role)}
                        className="px-4 py-2 text-sm font-semibold"
                        style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
                      >
                        Generate mockup
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Refine bar — always visible, iMessage-style */}
          <div className="flex-none px-4 py-3 border-t" style={{ borderColor: COLORS.border, background: COLORS.surface }}>
            <input ref={fileInputRef} type="file" multiple accept="*/*" className="hidden" onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              if (!files.length) return;
              const parsed = await Promise.all(files.map(readFileContent));
              setAttachedFiles((prev) => [...prev, ...parsed].slice(0, 8));
              e.target.value = "";
            }} />
            <div
              className="flex items-end gap-2 px-3 py-2"
              style={{ background: COLORS.subtle, borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}` }}
            >
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isStreaming} className="p-1.5 opacity-60 hover:opacity-100 disabled:opacity-30" aria-label="Attach file">
                📎
              </button>
              <textarea
                ref={refineRef}
                rows={1}
                placeholder="Describe a change and press Enter…"
                value={refineInput}
                onChange={(e) => setRefineInput(e.target.value)}
                onKeyDown={handleRefineKeyDown}
                disabled={isStreaming || !activeHtml}
                className="flex-1 bg-transparent text-sm outline-none resize-none max-h-24 disabled:opacity-50"
                style={{ ...F.body, color: COLORS.text, lineHeight: 1.5 }}
              />
              <button
                type="button"
                onClick={handleRefine}
                disabled={isStreaming || !refineInput.trim() || !activeHtml}
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
            <div className="flex items-center justify-between mt-2 px-1">
              <button type="button" onClick={() => setShowChat((v) => !v)} className="text-xs font-medium" style={{ color: COLORS.muted }}>
                {showChat ? "Hide chat" : "Show chat"}
              </button>
            </div>
          </div>
        </div>

        {/* Chat panel — always accessible, no tab switch */}
        {showChat && (
          <aside
            className="hidden lg:flex flex-col w-[340px] xl:w-[380px] shrink-0 border-l min-h-0"
            style={{ borderColor: COLORS.border, background: COLORS.surface }}
          >
            <div className="flex-none px-4 py-3 border-b" style={{ borderColor: COLORS.border }}>
              <span style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text }}>Conversation</span>
            </div>
            <ChatPanel
              messages={messages}
              isInternal={isInternal}
              isStreaming={isStreaming}
              sessionId={sessionId}
              ticketId={ticketId}
              lastAssistantIdx={lastAssistantIdx}
              engagement={engagement}
              userRole={user?.role}
              onRefreshEngagement={refreshEngagement}
              chatEndRef={chatEndRef}
            />
          </aside>
        )}
      </div>

      {/* Mobile chat drawer */}
      {showChat && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 max-h-[45vh] flex flex-col shadow-2xl border-t" style={{ background: COLORS.surface, borderColor: COLORS.border, borderRadius: `${RADIUS.lg}px ${RADIUS.lg}px 0 0` }}>
          <div className="flex-none px-4 py-2 border-b flex justify-between items-center" style={{ borderColor: COLORS.border }}>
            <span style={{ ...F.body, fontSize: 15, fontWeight: 600 }}>Conversation</span>
            <button type="button" onClick={() => setShowChat(false)} className="text-sm" style={{ color: COLORS.muted }}>Hide</button>
          </div>
          <ChatPanel
            messages={messages}
            isInternal={isInternal}
            isStreaming={isStreaming}
            sessionId={sessionId}
            ticketId={ticketId}
            lastAssistantIdx={lastAssistantIdx}
            engagement={engagement}
            userRole={user?.role}
            onRefreshEngagement={refreshEngagement}
            chatEndRef={chatEndRef}
          />
        </div>
      )}

      {mockFullscreen && activeHtml && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: COLORS.bg }}>
          <div
            className="flex-none flex items-center justify-between gap-3 px-4 py-3 border-b"
            style={{ background: COLORS.surface, borderColor: COLORS.border }}
          >
            <div className="min-w-0">
              <p className="truncate" style={{ ...F.body, fontSize: 15, fontWeight: 600, color: COLORS.text }}>
                {ticketData?.summary ?? ticketId}
              </p>
              <JiraTicketLink ticketId={ticketData?.id ?? ticketId} jiraBaseUrl={jiraBaseUrl} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => openHtmlInNewTab(normalizeMockupHtml(activeHtml))}
                className="px-3 py-1.5 text-xs font-medium"
                style={{ color: COLORS.accent, ...F.body }}
              >
                Open in new tab
              </button>
              <button
                type="button"
                onClick={() => setMockFullscreen(false)}
                className="px-4 py-1.5 text-xs font-semibold"
                style={{ background: COLORS.text, color: "#fff", borderRadius: RADIUS.pill, ...F.body }}
              >
                Exit full screen
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 bg-white">
            <MockupIframe html={activeHtml} className="w-full h-full" title="Mockup full screen" />
          </div>
        </div>
      )}
    </div>
  );
}

function ChatPanel({
  messages,
  isInternal,
  isStreaming,
  sessionId,
  ticketId,
  lastAssistantIdx,
  engagement,
  userRole,
  onRefreshEngagement,
  chatEndRef,
}: {
  messages: import("@lib/types").Message[];
  isInternal: boolean;
  isStreaming: boolean;
  sessionId: string;
  ticketId: string;
  lastAssistantIdx?: number;
  engagement: UserEngagement[];
  userRole?: "external" | "internal";
  onRefreshEngagement: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
      {messages.length === 0 && (
        <p className="text-center py-8" style={{ ...F.body, fontSize: 14, color: COLORS.muted }}>
          Changes appear here as you refine
        </p>
      )}
      {messages.map((msg, midx) => (
        <div key={midx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className="max-w-[95%] px-3.5 py-2.5"
            style={{
              borderRadius: RADIUS.md,
              background: msg.role === "user" ? COLORS.accent : COLORS.subtle,
              color: msg.role === "user" ? "#fff" : COLORS.text,
            }}
          >
            {msg.thinking && msg.role === "assistant" && (
              <ThinkingBlock log={msg.thinking.log} done={msg.thinking.done} elapsed={msg.thinking.elapsed} showMcp={isInternal} />
            )}
            {msg.role === "user" ? (
              <span className="whitespace-pre-wrap text-sm">{msg.text}</span>
            ) : (
              <>
                {msg.text && <div className="text-sm"><ChatMarkdown text={msg.text} /></div>}
                {msg.isStreaming && <span className="inline-block w-0.5 h-3 bg-amber-400 ml-0.5 animate-pulse" />}
              </>
            )}
            {isInternal && msg.effortEstimation && (
              <div className="mt-3 pt-3 border-t text-sm" style={{ borderColor: COLORS.border }}>
                <EffortMarkdown text={msg.effortEstimation} />
              </div>
            )}
          </div>
        </div>
      ))}
      {isInternal && lastAssistantIdx !== undefined && !isStreaming && (
        <InternalFeedbackWidget sessionId={sessionId} ticketId={ticketId} messageIndex={lastAssistantIdx} onSubmitted={onRefreshEngagement} />
      )}
      {userRole === "external" && !isStreaming && messages.some((m) => m.role === "assistant" && !m.isStreaming) && (
        <ExternalEngagementWidget sessionId={sessionId} ticketId={ticketId} existing={engagement} onSubmitted={onRefreshEngagement} />
      )}
      <div ref={chatEndRef} />
    </div>
  );
}
