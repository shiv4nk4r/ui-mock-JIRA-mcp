import type { MockupSession, TicketData } from "@lib/types";
import type { ServerTranscript } from "@lib/mockup/server-transcript";
import { repository, generateId } from "@lib/storage";
import { getLatestMockHtml, sessionHasAssistantReply } from "@lib/utils/mockup-html";

export async function fetchServerTranscript(
  ticketId: string,
): Promise<ServerTranscript | null> {
  try {
    const res = await fetch(
      `/api/mockups/transcript?id=${encodeURIComponent(ticketId)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as ServerTranscript;
  } catch {
    return null;
  }
}

function transcriptIsRicher(
  transcript: ServerTranscript,
  saved: MockupSession | null,
): boolean {
  if (!saved) return true;
  const tHasAssistant = sessionHasAssistantReply(transcript.messages);
  const sHasAssistant = sessionHasAssistantReply(saved.messages ?? []);
  const tHtml = getLatestMockHtml(transcript.messages, transcript.activeHtml);
  const sHtml = getLatestMockHtml(saved.messages ?? [], saved.activeHtml);
  if (tHtml && !sHtml) return true;
  if (tHasAssistant && !sHasAssistant) return true;
  if ((transcript.messages?.length ?? 0) > (saved.messages?.length ?? 0)) return true;
  if (transcript.status === "done" && saved.messages?.some((m) => m.isStreaming)) return true;
  return false;
}

/** Merge a finished (or in-progress) server transcript into the local session store. */
export async function applyServerTranscript(opts: {
  userId: string;
  ticket: TicketData;
  saved: MockupSession | null;
  transcript: ServerTranscript;
  selectedModel?: string;
}): Promise<MockupSession> {
  const { userId, ticket, saved, transcript, selectedModel } = opts;
  const sessionId = transcript.sessionId || saved?.id || generateId();

  const usageFromSaved = saved?.usageRecords ?? [];
  const usageFromTranscript = transcript.usageRecords ?? [];
  const usageRecords =
    usageFromTranscript.length >= usageFromSaved.length
      ? usageFromTranscript
      : usageFromSaved;

  const session: MockupSession = {
    id: sessionId,
    userId,
    ticketId: ticket.id,
    ticketData: ticket,
    messages: (transcript.messages ?? []).map((m) => ({
      ...m,
      isStreaming: transcript.status === "running" ? m.isStreaming : false,
    })),
    activeHtml:
      transcript.activeHtml ||
      getLatestMockHtml(transcript.messages, "") ||
      saved?.activeHtml ||
      "",
    usageRecords,
    selectedModel: transcript.model || selectedModel || saved?.selectedModel || "",
    status: transcript.status === "error" ? "in_progress" : (saved?.status ?? "in_progress"),
    savedAt: Date.now(),
    reviewId: saved?.reviewId,
  };

  if (transcript.status === "done" || transcriptIsRicher(transcript, saved)) {
    await repository.saveSession(session);
  }

  return session;
}

export function shouldPreferTranscript(
  transcript: ServerTranscript | null,
  saved: MockupSession | null,
): boolean {
  if (!transcript) return false;
  if (transcript.status === "running") return true;
  return transcriptIsRicher(transcript, saved);
}

/** Poll until the server marks the transcript done/error or timeout. */
export async function waitForTranscriptSettled(
  ticketId: string,
  opts?: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal },
): Promise<ServerTranscript | null> {
  const intervalMs = opts?.intervalMs ?? 2000;
  const timeoutMs = opts?.timeoutMs ?? 15 * 60 * 1000;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    if (opts?.signal?.aborted) return null;
    const transcript = await fetchServerTranscript(ticketId);
    if (!transcript) return null;
    if (transcript.status !== "running") return transcript;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return fetchServerTranscript(ticketId);
}
