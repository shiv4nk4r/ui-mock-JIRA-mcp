export const HTML_START = "RAW_HTML_COMPONENT_START";
export const HTML_END = "RAW_HTML_COMPONENT_END";
export const EFFORT_MARKER = "### 📊 Engineering Effort Estimation Summary";

export function stripEffortFromText(text: string): { text: string; effortEstimation?: string } {
  const mi = text.indexOf(EFFORT_MARKER);
  if (mi < 0) return { text: stripHtmlFromText(text).text };
  return {
    text: stripHtmlFromText(text.slice(0, mi)).text,
    effortEstimation: text.slice(mi).trim(),
  };
}

export function stripHtmlFromText(text: string): { text: string; html?: string } {
  const si = text.indexOf(HTML_START);
  const ei = text.indexOf(HTML_END);
  if (si === -1 || ei === -1 || ei <= si) {
    return { text: stripMarkdownHtmlFence(text) };
  }
  let html = text.slice(si + HTML_START.length, ei).trim();
  html = html.replace(/^```(?:html|HTML)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  html = html.replace(/^html\s*(\r?\n)/i, "").trim();
  const displayText = stripMarkdownHtmlFence(
    (text.slice(0, si) + text.slice(ei + HTML_END.length)).trim(),
  );
  return { text: displayText, html: html || undefined };
}

function stripMarkdownHtmlFence(text: string): string {
  return text
    .replace(/```html[\s\S]*?```/gi, "")
    .replace(/RAW_HTML_COMPONENT_START[\s\S]*?RAW_HTML_COMPONENT_END/gi, "")
    .trim();
}
