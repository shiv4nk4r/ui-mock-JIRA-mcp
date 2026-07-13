import { HTML_END, HTML_START, extractMockupHtmlFromText } from "@lib/utils/parse-chat";
import type { Message } from "@lib/types";

/** Strip fences, marker wrappers, and stray "html" lines from mockup HTML. */
export function normalizeMockupHtml(raw: string): string {
  if (!raw?.trim()) return "";

  let html = raw.trim();

  const si = html.indexOf(HTML_START);
  const ei = html.indexOf(HTML_END);
  if (si !== -1 && ei !== -1 && ei > si) {
    html = html.slice(si + HTML_START.length, ei).trim();
  }

  html = html.replace(/^```(?:html|HTML)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  // Bare language tag line some models emit inside marker blocks
  html = html.replace(/^html\s*(\r?\n)/i, "").trim();

  if (!/^<!DOCTYPE/i.test(html) && !/^<html[\s>]/i.test(html)) {
    const docIdx = html.search(/<!DOCTYPE html>/i);
    const htmlIdx = html.search(/<html[\s>]/i);
    const start = [docIdx, htmlIdx].filter((i) => i >= 0).sort((a, b) => a - b)[0];
    if (start !== undefined && start > 0) {
      html = html.slice(start).trim();
    }
  }

  return html;
}

export function isValidMockupHtml(html: string): boolean {
  const n = normalizeMockupHtml(html);
  return /^<!DOCTYPE/i.test(n) || /^<html[\s>]/i.test(n);
}

/** Prefer saved active HTML, then the latest assistant message with a mock component. */
export function getLatestMockHtml(messages: Message[], activeHtml?: string): string {
  const fromActive = normalizeMockupHtml(activeHtml ?? "");
  if (fromActive) return fromActive;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== "assistant") continue;
    if (msg.htmlComponent) {
      const normalized = normalizeMockupHtml(msg.htmlComponent);
      if (normalized) return normalized;
    }
    if (msg.text) {
      const { html } = extractMockupHtmlFromText(msg.text);
      if (html) {
        const normalized = normalizeMockupHtml(html);
        if (normalized) return normalized;
      }
    }
  }

  return "";
}

export function sessionHasAssistantReply(messages: Message[]): boolean {
  return messages.some((m) => m.role === "assistant" && !m.isStreaming);
}
