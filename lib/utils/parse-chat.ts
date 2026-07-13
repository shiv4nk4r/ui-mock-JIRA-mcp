export const HTML_START = "RAW_HTML_COMPONENT_START";
export const HTML_END = "RAW_HTML_COMPONENT_END";
export const EFFORT_MARKER = "### 📊 Engineering Effort Estimation Summary";
export const CHANGE_LOG_MARKER = "### 📋 Implementation Change Log";
export const AGENT_PROMPT_MARKER = "### 🤖 Standalone Agent Prompt";

const INTERNAL_MARKERS = [EFFORT_MARKER, CHANGE_LOG_MARKER, AGENT_PROMPT_MARKER] as const;

export interface ParsedAssistantSections {
  text: string;
  html?: string;
  effortEstimation?: string;
  changeLog?: string;
  agentPrompt?: string;
}

function stripMarkdownHtmlFence(text: string): string {
  return text
    .replace(/```html[\s\S]*?```/gi, "")
    .replace(/RAW_HTML_COMPONENT_START[\s\S]*?RAW_HTML_COMPONENT_END/gi, "")
    .trim();
}

function stripFenceWrapper(html: string): string {
  return html
    .replace(/^```(?:html|HTML)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .replace(/^html\s*(\r?\n)/i, "")
    .trim();
}

function looksLikeHtmlDocument(text: string): boolean {
  return (
    /^<!DOCTYPE\s+html/i.test(text) ||
    /^<html[\s>]/i.test(text) ||
    /<head[\s>]/i.test(text)
  );
}

function extractHtmlDocumentSlice(text: string): string | undefined {
  const docIdx = text.search(/<!DOCTYPE\s+html/i);
  const htmlIdx = text.search(/<html[\s>]/i);
  const starts = [docIdx, htmlIdx].filter((i) => i >= 0).sort((a, b) => a - b);
  const start = starts[0];
  if (start === undefined) return undefined;

  const closeIdx = text.lastIndexOf("</html>");
  if (closeIdx > start) return text.slice(start, closeIdx + 7).trim();
  return text.slice(start).trim();
}

function extractLargestHtmlFence(text: string): string | undefined {
  const fenceRegex = /```(?:html|HTML)?\s*([\s\S]*?)```/g;
  let best = "";
  let match: RegExpExecArray | null;
  while ((match = fenceRegex.exec(text)) !== null) {
    const candidate = stripFenceWrapper(match[1]);
    if (candidate.length > best.length && looksLikeHtmlDocument(candidate)) {
      best = candidate;
    }
  }
  return best || undefined;
}

function extractFromMarkers(text: string): { text: string; html?: string } | null {
  const startMatch = /RAW_HTML_COMPONENT_START/i.exec(text);
  if (!startMatch) return null;
  const endMatch = /RAW_HTML_COMPONENT_END/i.exec(text);
  if (!endMatch || endMatch.index <= startMatch.index + startMatch[0].length) return null;

  const si = startMatch.index + startMatch[0].length;
  const ei = endMatch.index;
  const html = stripFenceWrapper(text.slice(si, ei));
  const displayText = stripMarkdownHtmlFence(
    (text.slice(0, startMatch.index) + text.slice(endMatch.index + endMatch[0].length)).trim(),
  );
  return { text: displayText, html: html || undefined };
}

/** Extract mock HTML from markers, fenced blocks, or inline documents. */
export function extractMockupHtmlFromText(text: string): { text: string; html?: string } {
  if (!text?.trim()) return { text: "" };

  const fromMarkers = extractFromMarkers(text);
  if (fromMarkers?.html) return fromMarkers;

  const fromFence = extractLargestHtmlFence(text);
  if (fromFence) {
    const displayText = stripMarkdownHtmlFence(
      text.replace(/```(?:html|HTML)?\s*[\s\S]*?```/gi, "").trim(),
    );
    return { text: displayText, html: fromFence };
  }

  const fromDoc = extractHtmlDocumentSlice(text);
  if (fromDoc) {
    const displayText = stripMarkdownHtmlFence(text.replace(fromDoc, "").trim());
    return { text: displayText, html: fromDoc };
  }

  if (fromMarkers) return fromMarkers;

  return { text: stripMarkdownHtmlFence(text) };
}

export function stripHtmlFromText(text: string): { text: string; html?: string } {
  return extractMockupHtmlFromText(text);
}

function extractMarkedSection(text: string, marker: string, endMarkers: string[]): string | undefined {
  const start = text.indexOf(marker);
  if (start < 0) return undefined;
  const contentStart = start + marker.length;
  let end = text.length;
  for (const endMarker of endMarkers) {
    const idx = text.indexOf(endMarker, contentStart);
    if (idx >= 0 && idx < end) end = idx;
  }
  const section = text.slice(contentStart, end).trim();
  return section || undefined;
}

export function parseAssistantSections(text: string): ParsedAssistantSections {
  const { text: withoutHtml, html } = stripHtmlFromText(text);
  let remainder = withoutHtml;

  const effortEstimation = extractMarkedSection(remainder, EFFORT_MARKER, [CHANGE_LOG_MARKER, AGENT_PROMPT_MARKER]);
  const changeLog = extractMarkedSection(remainder, CHANGE_LOG_MARKER, [AGENT_PROMPT_MARKER]);
  const agentPrompt = extractMarkedSection(remainder, AGENT_PROMPT_MARKER, []);

  const firstMarkerIdx = INTERNAL_MARKERS.reduce((min, marker) => {
    const idx = remainder.indexOf(marker);
    if (idx < 0) return min;
    return min < 0 ? idx : Math.min(min, idx);
  }, -1);

  const displayText =
    firstMarkerIdx >= 0 ? remainder.slice(0, firstMarkerIdx).trim() : remainder.trim();

  return {
    text: displayText,
    html,
    effortEstimation,
    changeLog,
    agentPrompt,
  };
}

export function stripInternalTechnicalSections(text: string): string {
  const { text: withoutHtml } = stripHtmlFromText(text);
  const firstMarkerIdx = INTERNAL_MARKERS.reduce((min, marker) => {
    const idx = withoutHtml.indexOf(marker);
    if (idx < 0) return min;
    return min < 0 ? idx : Math.min(min, idx);
  }, -1);
  return firstMarkerIdx >= 0 ? withoutHtml.slice(0, firstMarkerIdx).trim() : withoutHtml.trim();
}

/** @deprecated Prefer parseAssistantSections */
export function stripEffortFromText(text: string): { text: string; effortEstimation?: string } {
  const parsed = parseAssistantSections(text);
  return { text: parsed.text, effortEstimation: parsed.effortEstimation };
}
