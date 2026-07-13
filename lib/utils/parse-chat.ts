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
