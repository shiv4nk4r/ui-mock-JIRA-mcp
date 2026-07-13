"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@lib/auth/auth-context";
import { repository, generateId } from "@lib/storage";
import { useMockupGeneration } from "@lib/hooks/use-mockup-generation";
import type { AttachedFile, MockupSession, ProviderConfig, ReviewStatus, TicketData, UserEngagement, UserRole } from "@lib/types";
import { F, COLORS, RADIUS } from "@lib/design/tokens";
import { openHtmlInNewTab, downloadHtmlFile } from "@lib/utils/files";
import { normalizeMockupHtml, getLatestMockHtml, sessionHasAssistantReply } from "@lib/utils/mockup-html";
import { MockAnnotationLayer } from "@/components/mock/MockAnnotationLayer";
import { MockupAspectFrame } from "@/components/shared/MockupAspectFrame";
import { DownloadIcon } from "@/components/shared/DownloadIcon";
import { MockupIframe } from "@/components/shared/MockupIframe";
import { submitOrResubmitReview, retractReview } from "@lib/utils/review-workflow";
import { SessionStatusChip } from "@/components/shared/SessionStatusChip";
import { Toast, IconButton } from "@/components/shared/Toast";
import { JiraTicketLink } from "@/components/workspace/JiraTicketLink";
import { SendForReviewModal } from "@/components/workspace/SendForReviewModal";
import { RetractReviewModal } from "@/components/workspace/RetractReviewModal";
import { MockVersionPicker } from "@/components/workspace/MockVersionPicker";
import { FloatingChatWidget } from "@/components/workspace/FloatingChatWidget";
import { MockCostBreakdownModal, MockCostBadge } from "@/components/workspace/MockCostBreakdownModal";
import { buildRevisions } from "@lib/utils/session-history";
import { sumUsageRecords } from "@lib/utils/usage-cost";

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
  const [chatOpen, setChatOpen] = useState(false);
  const [mockFullscreen, setMockFullscreen] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewModalResubmit, setReviewModalResubmit] = useState(false);
  const [retractModalOpen, setRetractModalOpen] = useState(false);
  const [retractingReview, setRetractingReview] = useState(false);
  const [sendingReview, setSendingReview] = useState(false);
  const [costOpen, setCostOpen] = useState(false);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);

  const prevRevisionCountRef = useRef(0);

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

  const revisions = useMemo(() => {
    if (!sessionId || !ticketData || !user) return [];
    return buildRevisions(
      {
        id: sessionId,
        userId: user.id,
        ticketId,
        ticketData,
        messages,
        activeHtml,
        usageRecords,
        selectedModel,
        status: sessionStatus,
        savedAt: Date.now(),
      },
      user.role,
    );
  }, [sessionId, ticketData, user, ticketId, messages, activeHtml, usageRecords, selectedModel, sessionStatus]);

  const selectedRevision =
    revisions.find((r) => r.id === selectedRevisionId) ?? revisions[revisions.length - 1];
  const latestMockHtml = useMemo(
    () => getLatestMockHtml(messages, activeHtml),
    [messages, activeHtml],
  );
  const previewHtml =
    isStreaming || isGenerating
      ? latestMockHtml
      : (selectedRevision?.html ?? latestMockHtml);
  const usageTotals = useMemo(() => sumUsageRecords(usageRecords), [usageRecords]);
  const hasAssistantReply = sessionHasAssistantReply(messages);
  const showGenerateMock = !previewHtml && !isGenerating && !isStreaming && !hasAssistantReply;

  useEffect(() => {
    if (isStreaming || isGenerating) return;
    if (!latestMockHtml || latestMockHtml === activeHtml) return;
    setActiveHtml(latestMockHtml);
  }, [isStreaming, isGenerating, latestMockHtml, activeHtml]);

  useEffect(() => {
    if (revisions.length === 0) {
      setSelectedRevisionId(null);
      prevRevisionCountRef.current = 0;
      return;
    }
    setSelectedRevisionId((prev) => {
      if (revisions.length > prevRevisionCountRef.current) {
        return revisions[revisions.length - 1].id;
      }
      if (!prev || !revisions.some((r) => r.id === prev)) {
        return revisions[revisions.length - 1].id;
      }
      return prev;
    });
    prevRevisionCountRef.current = revisions.length;
  }, [revisions]);

  useEffect(() => {
    if (isStreaming || isGenerating) setChatOpen(true);
  }, [isStreaming, isGenerating]);

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

        if (saved) {
          setSessionId(saved.id);
          setSessionStatus(saved.status);
          setMessages(saved.messages ?? []);
          setUsageRecords(saved.usageRecords ?? []);
          if (saved.selectedModel) setSelectedModel(saved.selectedModel);
          const restoredHtml = getLatestMockHtml(saved.messages ?? [], saved.activeHtml);
          if (restoredHtml) setActiveHtml(restoredHtml);
          const existingReview = await repository.getReviewByTicket(ticketId, user.id);
          if (existingReview) {
            setReviewId(existingReview.id);
            setReviewStatus(existingReview.status);
          }
          setEngagement(await repository.getEngagement({ sessionId: saved.id }));

          if (restoredHtml || sessionHasAssistantReply(saved.messages ?? [])) {
            return;
          }
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
    if (!user || !ticketData || phase !== "ready" || !sessionId) return;
    repository.saveSession({
      id: sessionId,
      userId: user.id,
      ticketId: ticketData.id,
      ticketData,
      messages: messages.map((m) => ({ ...m, isStreaming: false })),
      activeHtml: latestMockHtml || activeHtml,
      usageRecords,
      selectedModel,
      status: sessionStatus,
      savedAt: Date.now(),
      reviewId: reviewId ?? undefined,
    });
  }, [messages, activeHtml, latestMockHtml, usageRecords, selectedModel, phase, ticketData, user, sessionId, sessionStatus, reviewId]);

  async function handleRefine() {
    const prompt = refineInput.trim();
    if (!prompt || isStreaming || !activeHtml || !ticketData || !user) return;
    const filesToSend = attachedFiles.length
      ? attachedFiles.map(({ name, type, content, contentType }) => ({ name, type, content, contentType }))
      : undefined;
    setRefineInput("");
    setAttachedFiles([]);
    setChatOpen(true);
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

  async function handleShare() {
    if (!user || !ticketData || !previewHtml) return;
    const shareId = generateId().slice(-8);
    await repository.createShare({
      id: generateId(),
      shareId,
      sessionId,
      ticketId: ticketData.id,
      ticketSummary: ticketData.summary,
      activeHtml: previewHtml,
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
    if (!user || !ticketData || !previewHtml) return;
    setSendingReview(true);
    try {
      const { reviewId: id, resubmitted } = await submitOrResubmitReview({
        user,
        sessionId,
        ticketId: ticketData.id,
        ticketSummary: ticketData.summary,
        activeHtml: previewHtml,
      });
      setReviewId(id);
      setReviewStatus("pending_review");
      setSessionStatus("pending_review");
      setReviewModalOpen(false);
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
    } finally {
      setSendingReview(false);
    }
  }

  async function handleRetractReview() {
    if (!user || !reviewId) return;
    const review = await repository.getReview(reviewId);
    if (!review) return;
    setRetractingReview(true);
    try {
      await retractReview({ review, user });
      setReviewStatus("withdrawn");
      setSessionStatus("in_progress");
      setRetractModalOpen(false);
      setToast("Mockup retracted — continue refining in the workspace");
      await repository.saveSession({
        id: sessionId,
        userId: user.id,
        ticketId: ticketData!.id,
        ticketData: ticketData!,
        messages: messages.map((m) => ({ ...m, isStreaming: false })),
        activeHtml: latestMockHtml || activeHtml,
        usageRecords,
        selectedModel,
        status: "in_progress",
        savedAt: Date.now(),
        reviewId,
      });
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Could not retract review");
    } finally {
      setRetractingReview(false);
    }
  }

  function openReviewModal(resubmit: boolean) {
    setReviewModalResubmit(resubmit);
    setReviewModalOpen(true);
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
      <SendForReviewModal
        open={reviewModalOpen}
        resubmit={reviewModalResubmit}
        busy={sendingReview}
        revisions={revisions}
        selectedRevisionId={selectedRevisionId}
        onSelectRevision={setSelectedRevisionId}
        onCancel={() => setReviewModalOpen(false)}
        onConfirm={handleSendToReview}
      />
      <RetractReviewModal
        open={retractModalOpen}
        busy={retractingReview}
        onCancel={() => setRetractModalOpen(false)}
        onConfirm={handleRetractReview}
      />

      {/* Minimal top bar */}
      <header
        className="relative z-50 flex-none flex items-center gap-3 px-4 py-2.5 shrink-0"
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
          {(usageRecords.length > 0 || revisions.some((r) => r.usage)) && (
            <MockCostBadge
              costUsd={usageTotals.costUsd}
              onClick={() => setCostOpen(true)}
              disabled={isStreaming || isGenerating}
            />
          )}
          {revisions.length > 0 && (
            <MockVersionPicker
              revisions={revisions}
              selectedId={selectedRevisionId}
              onSelect={setSelectedRevisionId}
              disabled={!previewHtml || isStreaming || isGenerating}
            />
          )}
          <IconButton
            label="Download mockup as HTML"
            onClick={() => downloadHtmlFile(previewHtml, `${ticketData?.id ?? ticketId}.html`)}
            disabled={!previewHtml || isStreaming || isGenerating}
          >
            <DownloadIcon />
          </IconButton>
          <IconButton
            label="Full screen"
            onClick={() => setMockFullscreen(true)}
            disabled={!previewHtml || isStreaming || isGenerating}
          >
            ⛶
          </IconButton>
          <IconButton label="Share" onClick={handleShare} disabled={!previewHtml}>
            ↗
          </IconButton>
          {reviewId && (
            <IconButton label="Review channel" onClick={() => router.push(`/reviews/${reviewId}`)}>
              💬
            </IconButton>
          )}
          {(reviewStatus === "pending_review" || sessionStatus === "pending_review") ? (
            <>
              <span style={{ ...F.body, fontSize: 13, color: "#f9b115", fontWeight: 500 }}>In review</span>
              <IconButton label="Retract from review" onClick={() => setRetractModalOpen(true)}>
                ↩
              </IconButton>
            </>
          ) : reviewStatus === "needs_changes" || reviewStatus === "withdrawn" ? (
            <IconButton label="Resubmit for review" onClick={() => openReviewModal(true)} disabled={!previewHtml} primary>
              Resubmit
            </IconButton>
          ) : reviewStatus === "approved" || sessionStatus === "reviewed" ? (
            <span style={{ ...F.body, fontSize: 13, color: "#34C759", fontWeight: 500 }}>✓ Approved</span>
          ) : (
            <IconButton label="Send to review" onClick={() => openReviewModal(false)} disabled={!previewHtml} primary>
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

      {/* Full-width mockup — locked to 16:9 preview frame */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {previewHtml || isGenerating || isStreaming ? (
          <MockupAspectFrame>
            {isStreaming && previewHtml && (
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
            {previewHtml ? (
              sessionId ? (
                <MockAnnotationLayer
                  html={previewHtml}
                  targetId={reviewId ?? `mock-${sessionId}`}
                  title="Mockup"
                  className="absolute inset-0 z-0"
                />
              ) : (
                <MockupIframe html={previewHtml} className="w-full h-full" title="Mockup" />
              )
            ) : null}
          </MockupAspectFrame>
        ) : showGenerateMock ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6" style={{ ...F.body, color: COLORS.muted, background: COLORS.subtle }}>
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
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center" style={{ ...F.body, color: COLORS.muted, background: COLORS.subtle }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>Response ready — mock HTML missing</p>
            <p style={{ fontSize: 13, maxWidth: 360 }}>
              The assistant replied in chat but no mock HTML was extracted. Try regenerating or refine in the conversation.
            </p>
            {ticketData && user && (
              <button
                type="button"
                onClick={() => runGeneration(ticketData, user.role)}
                className="px-4 py-2 text-sm font-semibold"
                style={{ background: COLORS.accent, color: "#fff", borderRadius: RADIUS.pill }}
              >
                Regenerate mockup
              </button>
            )}
          </div>
        )}
      </div>

      {!mockFullscreen && (
        <FloatingChatWidget
          open={chatOpen}
          onOpenChange={setChatOpen}
          messages={messages}
          isInternal={isInternal}
          isStreaming={isStreaming}
          sessionId={sessionId}
          ticketId={ticketId}
          lastAssistantIdx={lastAssistantIdx}
          engagement={engagement}
          userRole={user?.role}
          onRefreshEngagement={refreshEngagement}
          refineInput={refineInput}
          onRefineInputChange={setRefineInput}
          attachedFiles={attachedFiles}
          onAttachedFilesChange={setAttachedFiles}
          onRefine={handleRefine}
          canRefine={!!activeHtml}
          activityPulse={isStreaming && !chatOpen}
        />
      )}

      {mockFullscreen && previewHtml && (
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
                onClick={() => downloadHtmlFile(previewHtml, `${ticketData?.id ?? ticketId}.html`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
                style={{ color: COLORS.text, ...F.body, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.pill }}
              >
                <DownloadIcon size={14} />
                Download HTML
              </button>
              <button
                type="button"
                onClick={() => openHtmlInNewTab(normalizeMockupHtml(previewHtml))}
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
          <MockupAspectFrame className="flex-1">
            <MockupIframe html={previewHtml} className="w-full h-full" title="Mockup full screen" />
          </MockupAspectFrame>
        </div>
      )}

      <MockCostBreakdownModal
        open={costOpen}
        onClose={() => setCostOpen(false)}
        records={usageRecords}
        revisions={revisions}
        selectedRevisionId={selectedRevisionId}
        ticketLabel={ticketData?.id ?? ticketId}
      />
    </div>
  );
}
