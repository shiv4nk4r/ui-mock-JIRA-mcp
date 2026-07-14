/**
 * Server-side mockup chat transcript.
 * Survives client disconnect so agent messages / thinking / HTML remain recoverable.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { Message, UsageRecord } from "@lib/types";

export type TranscriptStatus = "running" | "done" | "error";

export interface ServerTranscript {
  ticketId: string;
  sessionId?: string;
  userId?: string;
  updatedAt: number;
  status: TranscriptStatus;
  isRefinement: boolean;
  model?: string;
  thinkingLog: string[];
  messages: Message[];
  activeHtml?: string;
  usageRecords?: UsageRecord[];
  error?: string;
}

export interface PersistSessionMeta {
  sessionId?: string;
  userId?: string;
  /** Conversation so far for this turn (typically includes the latest user message). */
  messages?: Message[];
}

const DESIGN_DIR = join(homedir(), "claude-ui-designs");

function safeTicketId(ticketId: string): string {
  return ticketId.replace(/[^A-Za-z0-9._-]+/g, "_");
}

export function transcriptPath(ticketId: string): string {
  return join(DESIGN_DIR, `${safeTicketId(ticketId)}.transcript.json`);
}

export function readServerTranscript(ticketId: string): ServerTranscript | null {
  try {
    const path = transcriptPath(ticketId);
    if (!existsSync(path)) return null;
    const data = JSON.parse(readFileSync(path, "utf8")) as ServerTranscript;
    if (!data || data.ticketId !== ticketId) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeServerTranscript(transcript: ServerTranscript): void {
  try {
    mkdirSync(DESIGN_DIR, { recursive: true });
    writeFileSync(transcriptPath(transcript.ticketId), JSON.stringify(transcript, null, 2), "utf8");
  } catch {
    /* best-effort */
  }
}

export function patchServerTranscript(
  ticketId: string,
  patch: Partial<ServerTranscript> | ((prev: ServerTranscript) => ServerTranscript),
): ServerTranscript | null {
  const prev =
    readServerTranscript(ticketId) ??
    ({
      ticketId,
      updatedAt: Date.now(),
      status: "running",
      isRefinement: false,
      thinkingLog: [],
      messages: [],
    } satisfies ServerTranscript);

  const next =
    typeof patch === "function"
      ? patch(prev)
      : { ...prev, ...patch, ticketId, updatedAt: Date.now() };

  if (typeof patch !== "function") {
    next.updatedAt = Date.now();
  } else {
    next.updatedAt = Date.now();
  }

  writeServerTranscript(next);
  return next;
}

/** Start (or reset) a running transcript for this generation turn. */
export function beginServerTranscript(opts: {
  ticketId: string;
  isRefinement: boolean;
  model?: string;
  persist?: PersistSessionMeta;
  userPrompt: string;
  attachedFiles?: Array<{ name: string; contentType: string; sizeLabel?: string }>;
}): ServerTranscript {
  const prior = (opts.persist?.messages ?? []).map((m) => ({
    ...m,
    isStreaming: false,
  }));

  const last = prior[prior.length - 1];
  const hasUser =
    last?.role === "user" &&
    (last.text === opts.userPrompt ||
      (typeof last.text === "string" && last.text.startsWith("Auto-generate UI mockup")));

  const messages: Message[] = hasUser
    ? [...prior]
    : [
        ...prior,
        {
          role: "user",
          text: opts.userPrompt,
          attachedFiles: opts.attachedFiles,
        },
      ];

  messages.push({
    role: "assistant",
    text: "",
    isStreaming: true,
    thinking: { log: [], done: false },
  });

  const transcript: ServerTranscript = {
    ticketId: opts.ticketId,
    sessionId: opts.persist?.sessionId,
    userId: opts.persist?.userId,
    updatedAt: Date.now(),
    status: "running",
    isRefinement: opts.isRefinement,
    model: opts.model,
    thinkingLog: [],
    messages,
  };
  writeServerTranscript(transcript);
  return transcript;
}

export function appendTranscriptThinking(ticketId: string, thinking: string): void {
  patchServerTranscript(ticketId, (prev) => {
    if (prev.status !== "running") return prev;
    const thinkingLog = [...prev.thinkingLog, thinking];
    const messages = [...prev.messages];
    const last = messages[messages.length - 1];
    if (last?.role === "assistant") {
      messages[messages.length - 1] = {
        ...last,
        isStreaming: true,
        thinking: {
          log: [...(last.thinking?.log ?? []), thinking],
          done: false,
        },
      };
    }
    return { ...prev, thinkingLog, messages, updatedAt: Date.now() };
  });
}

export function finalizeServerTranscript(opts: {
  ticketId: string;
  displayText: string;
  html?: string;
  effortEstimation?: string;
  changeLog?: string;
  agentPrompt?: string;
  thinkingElapsed?: number;
  usage?: UsageRecord;
  error?: string;
}): void {
  patchServerTranscript(opts.ticketId, (prev) => {
    const messages = [...prev.messages];
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];

    if (last?.role === "assistant") {
      messages[lastIdx] = {
        ...last,
        text: opts.displayText || last.text || (opts.error ? `Error: ${opts.error}` : ""),
        htmlComponent: opts.html ?? last.htmlComponent,
        effortEstimation: opts.effortEstimation ?? last.effortEstimation,
        changeLog: opts.changeLog ?? last.changeLog,
        agentPrompt: opts.agentPrompt ?? last.agentPrompt,
        isStreaming: false,
        thinking: {
          log: last.thinking?.log ?? prev.thinkingLog,
          done: true,
          elapsed: opts.thinkingElapsed ?? last.thinking?.elapsed,
        },
      };
    } else if (opts.displayText || opts.html || opts.error) {
      messages.push({
        role: "assistant",
        text: opts.displayText || (opts.error ? `Error: ${opts.error}` : ""),
        htmlComponent: opts.html,
        effortEstimation: opts.effortEstimation,
        changeLog: opts.changeLog,
        agentPrompt: opts.agentPrompt,
        isStreaming: false,
        thinking: { log: prev.thinkingLog, done: true, elapsed: opts.thinkingElapsed },
      });
    }

    const usageRecords = [...(prev.usageRecords ?? [])];
    if (opts.usage && (opts.usage.inputTokens || opts.usage.outputTokens || opts.usage.costUsd)) {
      usageRecords.push(opts.usage);
    }

    return {
      ...prev,
      status: opts.error ? "error" : "done",
      error: opts.error,
      messages,
      activeHtml: opts.html ?? prev.activeHtml,
      usageRecords,
      updatedAt: Date.now(),
    };
  });
}
