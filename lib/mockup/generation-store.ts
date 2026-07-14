/**
 * Module-level mockup generation store.
 * Streams survive SPA navigation so leaving workspace does not pause/abort Claude.
 * WorkspaceClient subscribes on mount; persistence continues via repository while detached.
 */

import type { Message, MockupSession, TicketData, UsageRecord, UserRole } from "@lib/types";
import { repository } from "@lib/storage";
import { parseAssistantSections } from "@lib/utils/parse-chat";
import { normalizeMockupHtml } from "@lib/utils/mockup-html";

export type GenerationKind = "idle" | "generate" | "refine";

export interface GenerationSnapshot {
  userId: string;
  ticketId: string;
  sessionId: string;
  ticketData: TicketData;
  selectedModel: string;
  sessionStatus: MockupSession["status"];
  reviewId?: string;
  messages: Message[];
  thinkingLog: string[];
  usageRecords: UsageRecord[];
  activeHtml: string;
  kind: GenerationKind;
  isStreaming: boolean;
  error?: string;
}

type Listener = (snap: GenerationSnapshot) => void;

function jobKey(userId: string, ticketId: string) {
  return `${userId}::${ticketId}`;
}

function cloneSnap(s: GenerationSnapshot): GenerationSnapshot {
  return {
    ...s,
    messages: s.messages.map((m) => ({ ...m, thinking: m.thinking ? { ...m.thinking, log: [...m.thinking.log] } : undefined })),
    thinkingLog: [...s.thinkingLog],
    usageRecords: [...s.usageRecords],
  };
}

class MockupGenerationStore {
  private jobs = new Map<string, GenerationSnapshot>();
  private listeners = new Map<string, Set<Listener>>();
  private globalListeners = new Set<() => void>();
  private aborts = new Map<string, AbortController>();
  private persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

  get(userId: string, ticketId: string): GenerationSnapshot | null {
    const snap = this.jobs.get(jobKey(userId, ticketId));
    return snap ? cloneSnap(snap) : null;
  }

  /** All in-flight jobs for a user (generate or refine). */
  listRunning(userId: string): GenerationSnapshot[] {
    const prefix = `${userId}::`;
    const out: GenerationSnapshot[] = [];
    for (const [key, snap] of this.jobs) {
      if (!key.startsWith(prefix)) continue;
      if (snap.isStreaming || snap.kind !== "idle") out.push(cloneSnap(snap));
    }
    return out;
  }

  isRunning(userId: string, ticketId: string): boolean {
    const snap = this.jobs.get(jobKey(userId, ticketId));
    return !!snap && (snap.isStreaming || snap.kind !== "idle");
  }

  /** Notify on any job change (history list, dashboard badges, etc.). */
  subscribeGlobal(listener: () => void): () => void {
    this.globalListeners.add(listener);
    return () => {
      this.globalListeners.delete(listener);
    };
  }

  subscribe(userId: string, ticketId: string, listener: Listener): () => void {
    const key = jobKey(userId, ticketId);
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(listener);
    const current = this.jobs.get(key);
    if (current) listener(cloneSnap(current));
    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.listeners.delete(key);
    };
  }

  /** Seed or replace snapshot from a saved session (does not abort a running job). */
  hydrate(session: MockupSession): void {
    const key = jobKey(session.userId, session.ticketId);
    if (this.isRunning(session.userId, session.ticketId)) return;

    const snap: GenerationSnapshot = {
      userId: session.userId,
      ticketId: session.ticketId,
      sessionId: session.id,
      ticketData: session.ticketData,
      selectedModel: session.selectedModel,
      sessionStatus: session.status,
      reviewId: session.reviewId,
      messages: session.messages ?? [],
      thinkingLog: [],
      usageRecords: session.usageRecords ?? [],
      activeHtml: session.activeHtml ?? "",
      kind: "idle",
      isStreaming: false,
    };
    this.jobs.set(key, snap);
    this.emit(key);
  }

  cancel(userId: string, ticketId: string): void {
    const key = jobKey(userId, ticketId);
    this.aborts.get(key)?.abort();
    this.aborts.delete(key);
    const timer = this.persistTimers.get(key);
    if (timer) clearTimeout(timer);
    this.persistTimers.delete(key);
    this.jobs.delete(key);
    this.emit(key);
  }

  async generate(params: {
    userId: string;
    sessionId: string;
    ticket: TicketData;
    model: string;
    userRole: UserRole;
    reviewId?: string;
  }): Promise<void> {
    const { userId, sessionId, ticket, model, userRole, reviewId } = params;
    const key = jobKey(userId, ticket.id);
    if (this.isRunning(userId, ticket.id)) return;

    const snap: GenerationSnapshot = {
      userId,
      ticketId: ticket.id,
      sessionId,
      ticketData: ticket,
      selectedModel: model,
      sessionStatus: "in_progress",
      reviewId,
      messages: [
        { role: "user", text: `Auto-generate UI mockup · ${ticket.id}: "${ticket.summary}"` },
      ],
      thinkingLog: [],
      usageRecords: [],
      activeHtml: "",
      kind: "generate",
      isStreaming: false,
    };
    this.jobs.set(key, snap);
    this.emit(key);
    this.schedulePersist(key);

    await this.streamChat(key, {
      requestBody: {
        jiraTicketId: ticket.id,
        jiraData: ticket,
        enableVisualSkill: true,
        model,
        isRefinement: false,
        persistSession: {
          sessionId,
          userId,
          messages: snap.messages,
        },
      },
      usageLabel: "Initial mockup generation",
      userRole,
    });
  }

  async refine(params: {
    userId: string;
    sessionId: string;
    ticket: TicketData;
    prompt: string;
    model: string;
    currentHtml: string;
    userRole: UserRole;
    messages: Message[];
    usageRecords: UsageRecord[];
    sessionStatus: MockupSession["status"];
    reviewId?: string;
    attachedFiles?: Array<{ name: string; type: string; content: string; contentType: string }>;
  }): Promise<void> {
    const {
      userId,
      sessionId,
      ticket,
      prompt,
      model,
      currentHtml,
      userRole,
      messages,
      usageRecords,
      sessionStatus,
      reviewId,
      attachedFiles,
    } = params;
    const key = jobKey(userId, ticket.id);
    if (this.isRunning(userId, ticket.id)) return;

    const snap: GenerationSnapshot = {
      userId,
      ticketId: ticket.id,
      sessionId,
      ticketData: ticket,
      selectedModel: model,
      sessionStatus,
      reviewId,
      messages: [
        ...messages,
        {
          role: "user",
          text: prompt,
          attachedFiles: attachedFiles?.map(({ name, contentType }) => ({
            name,
            contentType,
            sizeLabel: "",
          })),
        },
      ],
      thinkingLog: [],
      usageRecords: [...usageRecords],
      activeHtml: currentHtml,
      kind: "refine",
      isStreaming: false,
    };
    this.jobs.set(key, snap);
    this.emit(key);

    const prior = (() => {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role !== "assistant") continue;
        if (m.changeLog || m.effortEstimation || m.agentPrompt) {
          return {
            effortEstimation: m.effortEstimation,
            changeLog: m.changeLog,
            agentPrompt: m.agentPrompt,
          };
        }
      }
      return undefined;
    })();

    await this.streamChat(key, {
      requestBody: {
        jiraTicketId: ticket.id,
        jiraData: ticket,
        additionalPmContext: prompt,
        enableVisualSkill: true,
        model,
        isRefinement: true,
        currentHtml,
        attachedFiles,
        priorHandoff: prior,
        persistSession: {
          sessionId,
          userId,
          messages: snap.messages,
        },
      },
      usageLabel: `Refinement: "${prompt.slice(0, 45)}${prompt.length > 45 ? "…" : ""}"`,
      userRole,
    });
  }

  private emit(key: string, notifyGlobal = true) {
    const snap = this.jobs.get(key);
    const set = this.listeners.get(key);
    if (set && snap) {
      const copy = cloneSnap(snap);
      for (const listener of set) listener(copy);
    }
    if (notifyGlobal) {
      for (const listener of this.globalListeners) listener();
    }
  }

  private patch(key: string, updater: (s: GenerationSnapshot) => void, notifyGlobal = false) {
    const snap = this.jobs.get(key);
    if (!snap) return;
    const prevKind = snap.kind;
    const prevStreaming = snap.isStreaming;
    updater(snap);
    const statusChanged =
      snap.kind !== prevKind || snap.isStreaming !== prevStreaming;
    this.emit(key, notifyGlobal || statusChanged);
    this.schedulePersist(key);
  }

  private schedulePersist(key: string) {
    const existing = this.persistTimers.get(key);
    if (existing) clearTimeout(existing);
    this.persistTimers.set(
      key,
      setTimeout(() => {
        this.persistTimers.delete(key);
        void this.persistNow(key);
      }, 400),
    );
  }

  private async persistNow(key: string) {
    const snap = this.jobs.get(key);
    if (!snap) return;
    try {
      await repository.saveSession({
        id: snap.sessionId,
        userId: snap.userId,
        ticketId: snap.ticketId,
        ticketData: snap.ticketData,
        messages: snap.messages.map((m) => ({ ...m, isStreaming: false })),
        activeHtml: snap.activeHtml,
        usageRecords: snap.usageRecords,
        selectedModel: snap.selectedModel,
        status: snap.sessionStatus,
        savedAt: Date.now(),
        reviewId: snap.reviewId,
      });
    } catch {
      /* persistence is best-effort while streaming */
    }
  }

  private updateLastMessage(
    key: string,
    patchOrFn: Partial<Message> | ((m: Message) => Message),
  ) {
    this.patch(key, (snap) => {
      const msgs = [...snap.messages];
      const last = msgs[msgs.length - 1];
      if (!last) return;
      msgs[msgs.length - 1] =
        typeof patchOrFn === "function" ? patchOrFn(last) : { ...last, ...patchOrFn };
      snap.messages = msgs;
    });
  }

  private async streamChat(
    key: string,
    opts: {
      requestBody: Record<string, unknown>;
      usageLabel: string;
      userRole: UserRole;
    },
  ): Promise<void> {
    const abort = new AbortController();
    this.aborts.set(key, abort);

    this.patch(key, (s) => {
      s.isStreaming = true;
      s.error = undefined;
    });

    this.patch(key, (s) => {
      s.messages = [
        ...s.messages,
        { role: "assistant", text: "", isStreaming: true, thinking: { log: [], done: false } },
      ];
    });

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...opts.requestBody, userRole: opts.userRole }),
        signal: abort.signal,
      });
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let streamingHtml: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!this.jobs.has(key)) {
          abort.abort();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const line = event.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.thinking) {
              const t = ev.thinking as string;
              this.patch(key, (s) => {
                s.thinkingLog = [...s.thinkingLog, t];
              });
              this.updateLastMessage(key, (m) => ({
                ...m,
                thinking: { log: [...(m.thinking?.log ?? []), t], done: false },
              }));
            }
            if (ev.thinkingDone) {
              this.updateLastMessage(key, (m) => ({
                ...m,
                thinking: {
                  log: m.thinking?.log ?? [],
                  done: true,
                  elapsed: ev.elapsed as number,
                },
              }));
            }
            if (ev.delta) {
              accumulated += ev.delta as string;
              const parsed = parseAssistantSections(accumulated);
              this.updateLastMessage(key, { text: parsed.text, isStreaming: true });
            }
            if (ev.html) {
              streamingHtml = normalizeMockupHtml(ev.html as string);
              if (streamingHtml) {
                this.patch(key, (s) => {
                  s.activeHtml = streamingHtml!;
                  s.sessionStatus = "in_progress";
                });
              }
            }
            if (ev.done) {
              const parsed = parseAssistantSections(accumulated);
              const parsedHtml = parsed.html ? normalizeMockupHtml(parsed.html) : undefined;
              const doneHtml =
                typeof ev.html === "string" ? normalizeMockupHtml(ev.html) : undefined;
              const finalHtml = streamingHtml ?? doneHtml ?? parsedHtml;
              if (finalHtml && !streamingHtml) {
                streamingHtml = finalHtml;
                this.patch(key, (s) => {
                  s.activeHtml = finalHtml;
                  s.sessionStatus = "in_progress";
                });
              }
              const effortEstimation =
                (typeof ev.effortEstimation === "string" ? ev.effortEstimation : undefined) ??
                parsed.effortEstimation;
              const changeLog =
                (typeof ev.changeLog === "string" ? ev.changeLog : undefined) ?? parsed.changeLog;
              const agentPrompt =
                (typeof ev.agentPrompt === "string" ? ev.agentPrompt : undefined) ??
                parsed.agentPrompt;
              const replyText =
                parsed.text?.trim() ||
                (finalHtml ? "Updated the mockup based on your request." : "Done.");
              this.updateLastMessage(key, {
                text: replyText,
                isStreaming: false,
                ...(finalHtml ? { htmlComponent: finalHtml } : {}),
                ...(effortEstimation ? { effortEstimation } : {}),
                ...(changeLog ? { changeLog } : {}),
                ...(agentPrompt ? { agentPrompt } : {}),
              });
              if (finalHtml) {
                this.patch(key, (s) => {
                  s.activeHtml = finalHtml!;
                  s.sessionStatus = "in_progress";
                });
              }
              const inT = (ev.inputTokens as number) ?? 0;
              const outT = (ev.outputTokens as number) ?? 0;
              const cost = (ev.costUsd as number) ?? 0;
              if (inT || outT || cost) {
                this.patch(key, (s) => {
                  s.usageRecords = [
                    ...s.usageRecords,
                    {
                      timestamp: Date.now(),
                      label: opts.usageLabel,
                      model: (opts.requestBody.model as string) ?? "claude-haiku-4-5-20251001",
                      inputTokens: inT,
                      outputTokens: outT,
                      costUsd: cost,
                    },
                  ];
                });
              }
            }
            if (ev.error) {
              this.updateLastMessage(key, {
                text: `Error: ${ev.error as string}`,
                isStreaming: false,
              });
              this.patch(key, (s) => {
                s.error = ev.error as string;
              });
            }
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        /* cancelled intentionally */
      } else {
        const message = err instanceof Error ? err.message : "Mockup generation failed";
        this.patch(key, (s) => {
          s.error = message;
        });
        this.updateLastMessage(key, (m) =>
          m.role === "assistant" && m.isStreaming
            ? { ...m, text: m.text || `Error: ${message}`, isStreaming: false }
            : m,
        );
      }
    } finally {
      this.aborts.delete(key);
      this.patch(key, (s) => {
        s.isStreaming = false;
        s.kind = "idle";
      });
      await this.persistNow(key);
    }
  }
}

export const mockupGenerationStore = new MockupGenerationStore();
