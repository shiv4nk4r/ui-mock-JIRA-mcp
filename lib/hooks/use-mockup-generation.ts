"use client";

import { useCallback, useRef, useState } from "react";
import type { Message, TicketData, UsageRecord, UserRole } from "@lib/types";
import { parseAssistantSections } from "@lib/utils/parse-chat";
import { normalizeMockupHtml } from "@lib/utils/mockup-html";

interface StreamOptions {
  userRole: UserRole;
  onHtml?: (html: string) => void;
}

export function useMockupGeneration() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [thinkingLog, setThinkingLog] = useState<string[]>([]);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const updateLastMessage = useCallback(
    (patchOrFn: Partial<Message> | ((m: Message) => Message)) => {
      setMessages((prev) => {
        const msgs = [...prev];
        const last = msgs[msgs.length - 1];
        if (!last) return msgs;
        msgs[msgs.length - 1] =
          typeof patchOrFn === "function" ? patchOrFn(last) : { ...last, ...patchOrFn };
        return msgs;
      });
    },
    [],
  );

  const streamChat = useCallback(
    async (
      requestBody: Record<string, unknown>,
      usageLabel: string,
      options: StreamOptions,
    ): Promise<void> => {
      setIsStreaming(true);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...requestBody, userRole: options.userRole }),
      });
      if (!res.body) throw new Error("No response body");

      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "", isStreaming: true, thinking: { log: [], done: false } },
      ]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let streamingHtml: string | undefined;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
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
                setThinkingLog((prev) => [...prev, t]);
                updateLastMessage((m) => ({
                  ...m,
                  thinking: { log: [...(m.thinking?.log ?? []), t], done: false },
                }));
              }
              if (ev.thinkingDone) {
                updateLastMessage((m) => ({
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
                const display =
                  options.userRole === "external"
                    ? parsed.text
                    : parsed.text;
                updateLastMessage({ text: display, isStreaming: true });
              }
              if (ev.html) {
                streamingHtml = normalizeMockupHtml(ev.html as string);
                if (streamingHtml) options.onHtml?.(streamingHtml);
              }
              if (ev.done) {
                const parsed = parseAssistantSections(accumulated);
                const isInternal = options.userRole === "internal";
                updateLastMessage({
                  text: parsed.text,
                  htmlComponent: streamingHtml,
                  effortEstimation: isInternal ? parsed.effortEstimation : undefined,
                  changeLog: isInternal ? parsed.changeLog : undefined,
                  agentPrompt: isInternal ? parsed.agentPrompt : undefined,
                  isStreaming: false,
                });
                const inT = (ev.inputTokens as number) ?? 0;
                const outT = (ev.outputTokens as number) ?? 0;
                const cost = (ev.costUsd as number) ?? 0;
                if (inT || outT || cost) {
                  setUsageRecords((prev) => [
                    ...prev,
                    {
                      timestamp: Date.now(),
                      label: usageLabel,
                      model: (requestBody.model as string) ?? "claude-haiku-4-5-20251001",
                      inputTokens: inT,
                      outputTokens: outT,
                      costUsd: cost,
                    },
                  ]);
                }
              }
              if (ev.error) {
                updateLastMessage({ text: `Error: ${ev.error as string}`, isStreaming: false });
              }
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [updateLastMessage],
  );

  const generate = useCallback(
    async (ticket: TicketData, model: string, userRole: UserRole, onHtml: (html: string) => void) => {
      setThinkingLog([]);
      setMessages([
        { role: "user", text: `Auto-generate UI mockup · ${ticket.id}: "${ticket.summary}"` },
      ]);
      await streamChat(
        { jiraTicketId: ticket.id, jiraData: ticket, enableVisualSkill: true, model, isRefinement: false },
        "Initial mockup generation",
        { userRole, onHtml },
      );
    },
    [streamChat],
  );

  const refine = useCallback(
    async (
      ticket: TicketData,
      prompt: string,
      model: string,
      currentHtml: string,
      userRole: UserRole,
      onHtml: (html: string) => void,
      attachedFiles?: Array<{ name: string; type: string; content: string; contentType: string }>,
    ) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          text: prompt,
          attachedFiles: attachedFiles?.map(({ name, contentType }) => ({
            name,
            contentType,
            sizeLabel: "",
          })),
        },
      ]);
      await streamChat(
        {
          jiraTicketId: ticket.id,
          jiraData: ticket,
          additionalPmContext: prompt,
          enableVisualSkill: true,
          model,
          isRefinement: true,
          currentHtml,
          attachedFiles,
        },
        `Refinement: "${prompt.slice(0, 45)}${prompt.length > 45 ? "…" : ""}"`,
        { userRole, onHtml },
      );
    },
    [streamChat],
  );

  return {
    messages,
    setMessages,
    thinkingLog,
    setThinkingLog,
    usageRecords,
    setUsageRecords,
    isStreaming,
    generate,
    refine,
  };
}

export { EFFORT_MARKER } from "@lib/utils/parse-chat";
