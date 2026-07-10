import { HTML_END, HTML_START } from "@lib/utils/parse-chat";

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
