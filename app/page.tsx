"use client";

import { useRef, useState, useEffect, FormEvent, KeyboardEvent } from "react";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface JiraMetadata {
  status: string; priority: string; assignee: string;
  reporter: string; issueType: string; labels: string[]; storyPoints?: number;
}
interface JiraComment     { author: string; body: string; created: string }
interface JiraSubtask     { id: string; summary: string; status: string; priority?: string }
interface JiraLinkedIssue { id: string; summary: string; type: string; status: string }
interface JiraAttachment  { filename: string; mimeType: string; size: number; sizeLabel?: string; content?: string }
interface LinkedUrl {
  url: string;
  type: "design-tool" | "html" | "json" | "text" | "binary" | "error" | "skip";
  tool?: string; title?: string; content: string;
}
interface TicketData {
  id: string; summary: string; description: string;
  metadata?: JiraMetadata; comments?: JiraComment[]; subtasks?: JiraSubtask[];
  linkedIssues?: JiraLinkedIssue[]; attachments?: JiraAttachment[]; linkedUrls?: LinkedUrl[];
}
interface ContentBlock  { type: string; text: string }
interface ModelOption   { id: string; label: string; description: string }
interface ProviderConfig {
  provider: "claude-code" | "claude" | "gemini" | "openai" | "mock";
  providerLabel: string; baseUrl: string; defaultModel: string; models: ModelOption[];
}
interface AttachedFile {
  name: string; type: string; size: number; sizeLabel: string;
  content: string; contentType: "text" | "html" | "image" | "binary";
}
interface Message {
  role: "user" | "assistant";
  text?: string; htmlComponent?: string; effortEstimation?: string;
  rawBlocks?: ContentBlock[]; isStreaming?: boolean;
  thinking?: { log: string[]; elapsed?: number; done: boolean };
  attachedFiles?: Array<{ name: string; contentType: string; sizeLabel: string; htmlContent?: string }>;
}
interface UsageRecord {
  timestamp: number; label: string; model: string;
  inputTokens: number; outputTokens: number; costUsd: number;
}
interface PersistedSession {
  ticketId: string; ticketData: TicketData; messages: Message[];
  activeHtml: string; usageRecords: UsageRecord[]; selectedModel: string; savedAt: number;
}
interface RecentSession { ticketId: string; summary: string; timestamp: number }

// ── Storage keys ──────────────────────────────────────────────────────────────

const SESSION_KEY = (id: string) => `poc-mcp-v2-${id}`;
const RECENT_KEY  = "poc-mcp-recent-v2";

// ── File helpers ──────────────────────────────────────────────────────────────

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
const TEXT_EXTS = new Set([
  ".txt",".md",".json",".ts",".tsx",".js",".jsx",".vue",".css",".scss",
  ".py",".java",".yaml",".yml",".csv",".xml",".sh",".env",".graphql",
  ".gql",".toml",".ini",".html",".htm",".sql",".prisma",".tf",
]);
async function readFileContent(file: File): Promise<AttachedFile> {
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const isText  = file.type.startsWith("text/") || TEXT_EXTS.has(ext) || file.type.includes("json") || file.type.includes("yaml");
  const isHtml  = ext === ".html" || ext === ".htm" || file.type.includes("text/html");
  const isImage = file.type.startsWith("image/");
  const base    = { name: file.name, type: file.type, size: file.size, sizeLabel: formatBytes(file.size) };
  if ((isText || isHtml) && file.size < 200_000) {
    const raw: string = await new Promise((res, rej) => {
      const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsText(file);
    });
    if (isHtml) return { ...base, content: raw.slice(0, 50_000), contentType: "html" };
    return { ...base, content: raw.slice(0, 15_000), contentType: "text" };
  }
  if (isImage) return { ...base, content: `[Image: ${file.name} — ${formatBytes(file.size)}]`, contentType: "image" };
  return { ...base, content: `[${file.name} — ${file.type || "binary"}, ${formatBytes(file.size)}]`, contentType: "binary" };
}

// ── Parsing helpers ───────────────────────────────────────────────────────────

const HTML_START    = "RAW_HTML_COMPONENT_START";
const HTML_END      = "RAW_HTML_COMPONENT_END";
const EFFORT_MARKER = "### 📊 Engineering Effort Estimation Summary";

function parseBlocks(blocks: ContentBlock[]): { text: string; htmlComponent: string; effortEstimation: string } {
  let text = "", htmlComponent = "", effortEstimation = "";
  for (const block of blocks) {
    const raw = block.text ?? "";
    if (raw.includes(HTML_START) && raw.includes(HTML_END)) {
      const si = raw.indexOf(HTML_START) + HTML_START.length;
      const ei = raw.indexOf(HTML_END);
      htmlComponent = raw.slice(si, ei).trim();
    } else if (raw.includes(EFFORT_MARKER)) {
      const mi = raw.indexOf(EFFORT_MARKER);
      const before = raw.slice(0, mi).trim();
      if (before) text += (text ? "\n\n" : "") + before;
      effortEstimation = raw.slice(mi).trim();
    } else {
      text += (text ? "\n\n" : "") + raw.trim();
    }
  }
  return { text, htmlComponent, effortEstimation };
}

// keep parseBlocks referenced so TS doesn't complain (used in non-streaming path)
void parseBlocks;

// ── Font constants ────────────────────────────────────────────────────────────

const F = {
  display:   { fontFamily: "'Bebas Neue', cursive" },
  condensed: { fontFamily: "'Barlow Condensed', sans-serif" },
  body:      { fontFamily: "'Barlow', sans-serif" },
  mono:      { fontFamily: "'Fira Code', monospace" },
};

// ── Effort Estimation Renderer ────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i} style={{ color: "#1A1510", fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`"))
          return <code key={i} style={{ fontFamily: "'Fira Code',monospace", fontSize: "0.9em", color: "#D97706", background: "rgba(217,119,6,0.12)", padding: "1px 5px", borderRadius: 2 }}>{p.slice(1, -1)}</code>;
        return p || null;
      })}
    </>
  );
}

function EffortTable({ rows }: { rows: string[] }) {
  const isSep    = (r: string) => /^\|[-|\s:]+\|/.test(r);
  const parseRow = (r: string) => r.split("|").filter(Boolean).map((c) => c.trim());
  const dataRows = rows.filter((r) => !isSep(r));
  const [headerRow, ...bodyRows] = dataRows;
  const headers = parseRow(headerRow ?? "");
  const bodies  = bodyRows.map(parseRow);
  if (headers.length === 3 && bodies.length === 1) {
    return (
      <div className="flex gap-2 my-3">
        {headers.map((h, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1 border px-3 pt-2 pb-3" style={{ borderColor: "#C4C0BA", background: "#F5F3EF" }}>
            <span style={{ ...F.condensed, fontSize: 9, color: "#6A6560", letterSpacing: "0.22em", textTransform: "uppercase" }}>{h}</span>
            <span style={{ ...F.display, fontSize: 22, color: "#D97706", lineHeight: 1 }}>{bodies[0]?.[i] ?? "—"}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto my-2">
      <table className="w-full border-collapse">
        <thead><tr style={{ borderBottom: "1px solid #D0CCC6" }}>{headers.map((h, i) => <th key={i} className="text-left px-3 py-2" style={{ ...F.condensed, fontSize: 10, color: "#6A6560", letterSpacing: "0.18em", textTransform: "uppercase" }}>{h}</th>)}</tr></thead>
        <tbody>{bodies.map((row, ri) => <tr key={ri} style={{ borderBottom: "1px solid #E2DDD8" }}>{row.map((cell, ci) => <td key={ci} className="px-3 py-1.5" style={{ ...F.body, fontSize: 12, color: "#4A4540" }}>{renderInline(cell)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function EffortMarkdown({ text }: { text: string }) {
  interface Group { type: "table" | "line"; lines: string[] }
  const groups: Group[] = [];
  const rawLines = text.split("\n");
  let i = 0;
  while (i < rawLines.length) {
    if (rawLines[i].startsWith("|")) {
      const block: string[] = [];
      while (i < rawLines.length && rawLines[i].startsWith("|")) block.push(rawLines[i++]);
      groups.push({ type: "table", lines: block });
    } else { groups.push({ type: "line", lines: [rawLines[i++]] }); }
  }
  return (
    <div className="space-y-0.5">
      {groups.map((g, gi) => {
        if (g.type === "table") return <EffortTable key={gi} rows={g.lines} />;
        const line = g.lines[0]; const trimmed = line.trim();
        if (!trimmed) return <div key={gi} style={{ height: 8 }} />;
        if (trimmed.startsWith("### ")) {
          const content = trimmed.slice(4);
          const idMatch = content.match(/\[([^\]]+)\]$/);
          const mainText = idMatch ? content.slice(0, idMatch.index).trim() : content;
          return (
            <div key={gi} className="flex items-baseline gap-3 pb-2 mb-1" style={{ borderBottom: "1px solid #E2DDD8" }}>
              <span style={{ ...F.condensed, fontSize: 13, fontWeight: 700, color: "#D97706", letterSpacing: "0.04em" }}>{mainText}</span>
              {idMatch && <span style={{ ...F.mono, fontSize: 10, color: "#6A6560" }}>[{idMatch[1]}]</span>}
            </div>
          );
        }
        if (trimmed.startsWith("## ")) return <div key={gi} className="pt-2 pb-0.5" style={{ ...F.condensed, fontSize: 11, fontWeight: 600, color: "#3A3530", letterSpacing: "0.12em", textTransform: "uppercase" }}>{trimmed.slice(3)}</div>;
        const chk = trimmed.match(/^[-*]\s+\[([ x])\]\s+(.*)/);
        if (chk) {
          const checked = chk[1] === "x";
          return <div key={gi} className="flex items-start gap-2.5" style={{ paddingLeft: 4 }}><span className="flex-none flex items-center justify-center mt-px" style={{ width: 13, height: 13, borderRadius: 2, fontSize: 9, border: `1px solid ${checked ? "#D97706" : "#A8A4A0"}`, background: checked ? "rgba(217,119,6,0.15)" : "transparent", color: "#D97706" }}>{checked ? "✓" : ""}</span><span style={{ ...F.body, fontSize: 12, color: checked ? "#4A4540" : "#7A7068", lineHeight: "1.55" }}>{renderInline(chk[2])}</span></div>;
        }
        if (/^\s{2,}[*-]\s/.test(line)) return <div key={gi} className="flex items-start gap-2" style={{ paddingLeft: 20 }}><span className="flex-none" style={{ color: "#A8A4A0", marginTop: 5, fontSize: 10 }}>·</span><span style={{ ...F.body, fontSize: 11, color: "#6A6260", lineHeight: "1.55" }}>{renderInline(line.replace(/^\s+[*-]\s/, ""))}</span></div>;
        if (/^[-*]\s/.test(trimmed)) return <div key={gi} className="flex items-start gap-2" style={{ paddingLeft: 4 }}><span className="flex-none" style={{ color: "#D97706", fontSize: 7, marginTop: 5 }}>▶</span><span style={{ ...F.body, fontSize: 12, color: "#4A4540", lineHeight: "1.6" }}>{renderInline(trimmed.slice(2))}</span></div>;
        return <div key={gi} style={{ ...F.body, fontSize: 12, color: "#4A4540", lineHeight: "1.6", paddingLeft: 4 }}>{renderInline(trimmed)}</div>;
      })}
    </div>
  );
}

// ── Chat Markdown Renderer ────────────────────────────────────────────────────

function renderChatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^\s*][^*]*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} style={{ color: "#1A1510", fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("`") && p.endsWith("`")) return <code key={i} style={{ fontFamily: "'Fira Code',monospace", fontSize: "0.87em", color: "#D97706", background: "rgba(217,119,6,0.12)", padding: "1px 5px", borderRadius: 2 }}>{p.slice(1, -1)}</code>;
        if (p.startsWith("*") && p.endsWith("*")) return <em key={i} style={{ color: "#6A6260", fontStyle: "italic" }}>{p.slice(1, -1)}</em>;
        return p || null;
      })}
    </>
  );
}

function ChatTable({ rows }: { rows: string[] }) {
  const isSep    = (r: string) => /^\|[-|\s:]+\|/.test(r);
  const parseRow = (r: string) => r.split("|").filter(Boolean).map((c) => c.trim());
  const data    = rows.filter((r) => !isSep(r));
  const [header, ...body] = data;
  return (
    <div className="overflow-x-auto my-2">
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead><tr style={{ borderBottom: "1px solid #D0CCC6" }}>{parseRow(header ?? "").map((h, i) => <th key={i} className="px-3 py-1.5 text-left" style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, color: "#6A6560", textTransform: "uppercase", letterSpacing: "0.18em" }}>{h}</th>)}</tr></thead>
        <tbody>{body.map(parseRow).map((row, ri) => <tr key={ri} style={{ borderBottom: "1px solid #E2DDD8" }}>{row.map((cell, ci) => <td key={ci} className="px-3 py-1.5" style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, color: "#4A4540" }}>{renderChatInline(cell)}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function ChatMarkdown({ text }: { text: string }) {
  interface Group { type: "code" | "table" | "line"; lines: string[]; meta?: string }
  const rawLines = text.split("\n");
  const groups: Group[] = [];
  let idx = 0, inCode = false, codeLang = "", codeLines: string[] = [];
  while (idx < rawLines.length) {
    const line = rawLines[idx];
    if (!inCode && line.trimStart().startsWith("```")) { inCode = true; codeLang = line.trimStart().slice(3).trim(); codeLines = []; idx++; }
    else if (inCode && line.trimStart().startsWith("```")) { inCode = false; groups.push({ type: "code", lines: codeLines, meta: codeLang }); idx++; }
    else if (inCode) { codeLines.push(line); idx++; }
    else if (line.startsWith("|")) {
      const block: string[] = [];
      while (idx < rawLines.length && rawLines[idx].startsWith("|")) block.push(rawLines[idx++]);
      groups.push({ type: "table", lines: block });
    } else { groups.push({ type: "line", lines: [line] }); idx++; }
  }
  return (
    <div>
      {groups.map((g, gi) => {
        if (g.type === "code") return (
          <div key={gi} className="mb-3 overflow-hidden" style={{ border: "1px solid #E2DDD8", borderRadius: 2 }}>
            {g.meta && <div className="px-3 py-1 border-b" style={{ background: "#FFFFFF", borderColor: "#E2DDD8" }}><span style={{ fontFamily: "'Fira Code',monospace", fontSize: 10, color: "#6A6560", letterSpacing: "0.1em" }}>{g.meta}</span></div>}
            <pre className="px-4 py-3 overflow-x-auto m-0" style={{ fontFamily: "'Fira Code',monospace", fontSize: 12, color: "#3A3530", background: "#EDEBE8", lineHeight: "1.6" }}>{g.lines.join("\n")}</pre>
          </div>
        );
        if (g.type === "table") return <ChatTable key={gi} rows={g.lines} />;
        const line = g.lines[0]; const t = line.trim();
        if (!t) return <div key={gi} style={{ height: 8 }} />;
        if (/^# (?!#)/.test(t)) return <div key={gi} className="mt-3 mb-2" style={{ fontFamily: "'Bebas Neue',cursive", fontSize: 24, color: "#D97706" }}>{renderChatInline(t.slice(2))}</div>;
        if (/^## (?!#)/.test(t)) return <div key={gi} className="mt-2 mb-1.5 pb-1" style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 15, fontWeight: 700, color: "#1A1510", borderBottom: "1px solid #E2DDD8" }}>{renderChatInline(t.slice(3))}</div>;
        if (/^### /.test(t)) return <div key={gi} className="mt-2 mb-1" style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 600, color: "#3A3530", letterSpacing: "0.06em" }}>{renderChatInline(t.slice(4))}</div>;
        if (/^[-*_]{3,}$/.test(t)) return <div key={gi} className="my-3" style={{ borderTop: "1px solid #E2DDD8" }} />;
        if (t.startsWith("> ")) return <div key={gi} className="pl-3 mb-1" style={{ borderLeft: "2px solid #D0CCC6", fontFamily: "'Barlow',sans-serif", fontSize: 12, color: "#6E6560", lineHeight: "1.7", fontStyle: "italic" }}>{renderChatInline(t.slice(2))}</div>;
        const chk = t.match(/^[-*]\s+\[([ x])\]\s+(.*)/);
        if (chk) { const checked = chk[1] === "x"; return <div key={gi} className="flex items-start gap-2 mb-0.5"><span className="flex-none flex items-center justify-center" style={{ width: 13, height: 13, marginTop: 2, borderRadius: 2, fontSize: 9, border: `1px solid ${checked ? "#D97706" : "#A8A4A0"}`, background: checked ? "rgba(217,119,6,0.15)" : "transparent", color: "#D97706" }}>{checked ? "✓" : ""}</span><span style={{ fontFamily: "'Barlow',sans-serif", fontSize: 13, color: checked ? "#0E0A06" : "#7A7068", lineHeight: "1.6" }}>{renderChatInline(chk[2])}</span></div>; }
        const num = t.match(/^(\d+)\.\s+(.*)/);
        if (num) return <div key={gi} className="flex items-start gap-2 mb-0.5"><span className="flex-none" style={{ fontFamily: "'Fira Code',monospace", fontSize: 11, color: "#D97706", minWidth: 20, marginTop: 1 }}>{num[1]}.</span><span style={{ fontFamily: "'Barlow',sans-serif", fontSize: 13, color: "#0E0A06", lineHeight: "1.65" }}>{renderChatInline(num[2])}</span></div>;
        if (/^\s{2,}[*-]\s/.test(line)) return <div key={gi} className="flex items-start gap-2 mb-0.5" style={{ paddingLeft: 20 }}><span className="flex-none" style={{ color: "#A8A4A0", marginTop: 5, fontSize: 10 }}>·</span><span style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, color: "#6A6260", lineHeight: "1.55" }}>{renderChatInline(line.replace(/^\s+[*-]\s/, ""))}</span></div>;
        if (/^[-*]\s/.test(t)) return <div key={gi} className="flex items-start gap-2 mb-0.5"><span className="flex-none" style={{ color: "#D97706", fontSize: 7, marginTop: 6 }}>▶</span><span style={{ fontFamily: "'Barlow',sans-serif", fontSize: 13, color: "#0E0A06", lineHeight: "1.65" }}>{renderChatInline(t.slice(2))}</span></div>;
        return <div key={gi} className="mb-1" style={{ fontFamily: "'Barlow',sans-serif", fontSize: 13, color: "#0E0A06", lineHeight: "1.75" }}>{renderChatInline(t)}</div>;
      })}
    </div>
  );
}

// ── ThinkingBlock ─────────────────────────────────────────────────────────────

function ThinkingBlock({ log, done, elapsed }: { log: string[]; done: boolean; elapsed?: number }) {
  const [expanded, setExpanded] = useState(false);
  const latest = log[log.length - 1] ?? "Processing…";
  if (!done) return (
    <div className="flex items-start gap-3 px-4 py-3 border-l-2 mb-2" style={{ borderLeftColor: "#D0CCC6", background: "#FFFFFF" }}>
      <div className="signal-bars flex-none" style={{ marginTop: 3 }}><span /><span /><span /><span /><span /></div>
      <div>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, color: "#6A6560", letterSpacing: "0.22em", textTransform: "uppercase", marginBottom: 3 }}>Thinking</div>
        <div style={{ fontFamily: "'Barlow',sans-serif", fontSize: 12, color: "#8A8680", lineHeight: "1.4" }}>{latest}</div>
      </div>
    </div>
  );
  return (
    <div className="border-l-2 mb-2 overflow-hidden" style={{ borderLeftColor: "#E2DDD8" }}>
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-2 px-4 py-2 text-left" style={{ background: "#FFFFFF" }}>
        <span style={{ color: "#A8A4A0", fontSize: 9 }}>{expanded ? "▾" : "▸"}</span>
        <span style={{ fontFamily: "'Fira Code',monospace", fontSize: 10, color: "#8A8680", letterSpacing: "0.05em" }}>Thought for {elapsed?.toFixed(1)}s</span>
        {log.length > 0 && <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 10, color: "#C4C0BA", letterSpacing: "0.08em" }}>· {log.length} step{log.length !== 1 ? "s" : ""}</span>}
      </button>
      {expanded && (
        <div className="px-4 py-2 space-y-1.5" style={{ background: "#EDEBE8", borderTop: "1px solid #E2DDD8" }}>
          {log.map((entry, i) => (
            <div key={i} className="flex items-start gap-2">
              <span style={{ color: "#C4C0BA", fontSize: 10, marginTop: 1, flexShrink: 0 }}>›</span>
              <span style={{ fontFamily: "'Barlow',sans-serif", fontSize: 11, color: "#706C68", lineHeight: "1.45" }}>{entry}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TicketPanel ───────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { color: string; bg: string }> = {
  "Done":        { color: "#66bb6a", bg: "rgba(102,187,106,0.1)" },
  "In Progress": { color: "#2982cc", bg: "rgba(41,130,204,0.1)"  },
  "To Do":       { color: "#636f83", bg: "rgba(99,111,131,0.1)"  },
  "Blocked":     { color: "#ED3324", bg: "rgba(237,51,36,0.1)"   },
  "In Review":   { color: "#f9b115", bg: "rgba(249,177,21,0.1)"  },
};
function statusChip(status: string) {
  const c = STATUS_COLORS[status] ?? { color: "#6A6560", bg: "rgba(132,122,112,0.1)" };
  return <span style={{ ...F.condensed, fontSize: 10, color: c.color, background: c.bg, padding: "1px 6px", borderRadius: 2, letterSpacing: "0.08em" }}>{status}</span>;
}
function PanelSection({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border-b" style={{ borderColor: "#E2DDD8" }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-2.5 text-left" style={{ background: "#FFFFFF" }}>
        <span style={{ color: "#A8A4A0", fontSize: 9 }}>{open ? "▾" : "▸"}</span>
        <span style={{ ...F.condensed, fontSize: 10, color: "#6A6560", letterSpacing: "0.2em", textTransform: "uppercase" }}>{label}</span>
        {count !== undefined && <span style={{ ...F.mono, fontSize: 9, color: "#A8A4A0" }}>({count})</span>}
      </button>
      {open && <div className="px-4 pb-3 space-y-2">{children}</div>}
    </div>
  );
}
function TicketPanel({ ticketData, jiraBaseUrl }: { ticketData: TicketData | null; jiraBaseUrl: string }) {
  const t = ticketData;
  if (!t) return null;
  const priorityColor: Record<string, string> = { High: "#ED3324", Medium: "#f9b115", Low: "#66bb6a", Highest: "#ED3324", Lowest: "#66bb6a" };
  return (
    <aside className="w-[30%] flex-none flex flex-col overflow-hidden border-r" style={{ background: "#FFFFFF", borderColor: "#E2DDD8" }}>
      <div className="flex-none h-px" style={{ background: "linear-gradient(90deg, #D97706 0%, transparent 55%)" }} />
      <div className="flex-none px-4 pt-4 pb-3 border-b space-y-2" style={{ borderColor: "#E2DDD8" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ ...F.mono, fontSize: 11, color: "#D97706", letterSpacing: "0.08em" }}>{t.id}</span>
          {t.metadata?.issueType && <span style={{ ...F.condensed, fontSize: 9, color: "#6A6560", background: "rgba(132,122,112,0.1)", padding: "1px 5px", borderRadius: 2 }}>{t.metadata.issueType}</span>}
          {t.metadata?.status && statusChip(t.metadata.status)}
          {t.metadata?.priority && <span style={{ ...F.condensed, fontSize: 9, color: priorityColor[t.metadata.priority] ?? "#6A6560", letterSpacing: "0.06em" }}>▲ {t.metadata.priority}</span>}
        </div>
        <h2 style={{ ...F.body, fontSize: 13, fontWeight: 600, color: "#1A1510", lineHeight: "1.45" }}>{t.summary}</h2>
        {t.metadata && (
          <div className="space-y-0.5">
            {t.metadata.assignee !== "Unassigned" && <div style={{ ...F.condensed, fontSize: 10, color: "#6E6560" }}>Assignee · <span style={{ color: "#4A4540" }}>{t.metadata.assignee}</span></div>}
            {t.metadata.storyPoints !== undefined && <div style={{ ...F.condensed, fontSize: 10, color: "#6E6560" }}>Story points · <span style={{ ...F.mono, color: "#D97706" }}>{t.metadata.storyPoints} SP</span></div>}
            {t.metadata.labels.length > 0 && <div className="flex flex-wrap gap-1 pt-0.5">{t.metadata.labels.map((l) => <span key={l} style={{ ...F.mono, fontSize: 9, color: "#8A8680", border: "1px solid #E2DDD8", padding: "0 4px", borderRadius: 2 }}>{l}</span>)}</div>}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        <PanelSection label="Description"><p style={{ ...F.body, fontSize: 12, color: "#4A4540", lineHeight: "1.75", whiteSpace: "pre-wrap" }}>{t.description || "No description provided."}</p></PanelSection>
        {t.subtasks && t.subtasks.length > 0 && (<PanelSection label="Subtasks" count={t.subtasks.length}>{t.subtasks.map((s) => <div key={s.id} className="flex items-start gap-2"><span style={{ ...F.mono, fontSize: 10, color: "#8A8680", flexShrink: 0, marginTop: 1 }}>{s.id}</span><span style={{ ...F.body, fontSize: 12, color: "#4A4540", flex: 1, lineHeight: "1.4" }}>{s.summary}</span>{statusChip(s.status)}</div>)}</PanelSection>)}
        {t.linkedIssues && t.linkedIssues.length > 0 && (<PanelSection label="Linked Issues" count={t.linkedIssues.length}>{t.linkedIssues.map((l) => <div key={l.id + l.type} className="flex items-start gap-2"><span style={{ ...F.condensed, fontSize: 9, color: "#8A8680", flexShrink: 0, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l.type}</span><div className="flex-1 min-w-0"><div style={{ ...F.mono, fontSize: 10, color: "#D97706" }}>{l.id}</div><div style={{ ...F.body, fontSize: 11, color: "#6A6260", lineHeight: "1.3" }} className="truncate">{l.summary}</div></div>{statusChip(l.status)}</div>)}</PanelSection>)}
        {t.comments && t.comments.length > 0 && (<PanelSection label="Comments" count={t.comments.length}>{t.comments.slice(0, 5).map((c, i) => <div key={i} className="space-y-0.5" style={{ paddingBottom: 8, borderBottom: i < Math.min(t.comments!.length, 5) - 1 ? "1px solid #E2DDD8" : "none" }}><div className="flex items-center gap-2"><span style={{ ...F.condensed, fontSize: 10, color: "#4A4540", fontWeight: 600 }}>{c.author}</span><span style={{ ...F.condensed, fontSize: 9, color: "#A8A4A0" }}>{c.created}</span></div><p style={{ ...F.body, fontSize: 11, color: "#6E6560", lineHeight: "1.5" }}>{c.body.length > 180 ? c.body.slice(0, 180) + "…" : c.body}</p></div>)}</PanelSection>)}
        {t.attachments && t.attachments.length > 0 && (<PanelSection label="Attachments" count={t.attachments.length}>{t.attachments.map((a, i) => <div key={i} className="flex items-center gap-2"><span style={{ fontSize: 14 }}>{a.mimeType?.includes("image") ? "🖼" : a.content ? "📄" : "📎"}</span><div className="flex-1 min-w-0"><div style={{ ...F.mono, fontSize: 10, color: a.content ? "#4A4540" : "#6E6560" }} className="truncate">{a.filename}</div><div style={{ ...F.condensed, fontSize: 9, color: "#A8A4A0" }}>{a.sizeLabel ?? a.size}{a.content && " · content extracted"}</div></div></div>)}</PanelSection>)}
        {t.linkedUrls && t.linkedUrls.filter((u) => u.type !== "skip").length > 0 && (<PanelSection label="Referenced Links" count={t.linkedUrls.filter((u) => u.type !== "skip").length}>{t.linkedUrls.filter((u) => u.type !== "skip").map((lu, i) => { const icon = lu.type === "design-tool" ? "🎨" : lu.type === "html" ? "🌐" : lu.type === "json" ? "{ }" : lu.type === "text" ? "📄" : lu.type === "error" ? "⚠" : "🔗"; const label = lu.tool ?? lu.title ?? new URL(lu.url).hostname; const fetched = lu.type !== "design-tool" && lu.type !== "error" && lu.type !== "binary"; return <div key={i} className="flex items-start gap-2"><span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{icon}</span><div className="flex-1 min-w-0"><div style={{ ...F.body, fontSize: 11, color: "#4A4540", lineHeight: "1.3" }} className="truncate">{label}</div><div style={{ ...F.condensed, fontSize: 9, color: "#A8A4A0", letterSpacing: "0.08em" }}>{lu.type === "design-tool" ? lu.tool : lu.type}{fetched && " · context fetched"}</div></div></div>; })}</PanelSection>)}
      </div>
      {jiraBaseUrl && !jiraBaseUrl.includes("your-company") && (<div className="flex-none px-4 py-2 border-t" style={{ borderColor: "#E2DDD8" }}><span style={{ ...F.mono, fontSize: 9, color: "#C4C0BA" }} className="truncate block">{jiraBaseUrl}</span></div>)}
    </aside>
  );
}

// ── Generating Screen ─────────────────────────────────────────────────────────

function GeneratingScreen({ ticketId, summary, model, thinkingLog }: { ticketId: string; summary: string; model: string; thinkingLog: string[] }) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [thinkingLog]);
  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden" style={{ background: "#F8F6F3" }}>
      <div className="absolute inset-0 grid-pattern pointer-events-none" />
      <div className="absolute pointer-events-none" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "600px", height: "600px", background: "radial-gradient(circle, rgba(217,119,6,0.07) 0%, transparent 70%)" }} />
      <div className="relative z-10 w-full max-w-[520px] px-8 space-y-8">
        <div className="flex items-center gap-3">
          <div className="signal-bars"><span /><span /><span /><span /><span /></div>
          <span style={{ ...F.condensed, fontSize: 10, color: "#D97706", letterSpacing: "0.3em", textTransform: "uppercase" }}>Generating Mockup</span>
        </div>
        <div>
          <div className="leading-none text-[64px]" style={{ ...F.display, color: "#1A1510" }}>BUILDING</div>
          <div className="leading-none text-[64px]" style={{ ...F.display, color: "#D97706" }}>UI MOCKUP</div>
        </div>
        <div className="space-y-1 border-l-2 pl-4" style={{ borderColor: "#D97706" }}>
          <div style={{ ...F.mono, fontSize: 12, color: "#D97706", letterSpacing: "0.1em" }}>{ticketId}</div>
          <div style={{ ...F.body, fontSize: 13, color: "#4A4540", lineHeight: "1.5" }}>{summary}</div>
          <div style={{ ...F.condensed, fontSize: 10, color: "#A8A4A0", letterSpacing: "0.15em", textTransform: "uppercase", marginTop: 4 }}>Model: {model}</div>
        </div>
        <div className="h-px" style={{ background: "linear-gradient(90deg, #D97706 0%, transparent 70%)" }} />
        <div ref={logRef} className="space-y-1.5 overflow-y-auto" style={{ maxHeight: 220 }}>
          {thinkingLog.length === 0 && <div style={{ ...F.condensed, fontSize: 10, color: "#C4C0BA", letterSpacing: "0.15em" }}>Initialising…</div>}
          {thinkingLog.map((entry, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span style={{ ...F.mono, fontSize: 10, color: i === thinkingLog.length - 1 ? "#D97706" : "#C4C0BA", flexShrink: 0, marginTop: 1 }}>{i === thinkingLog.length - 1 ? "›" : "✓"}</span>
              <span style={{ ...F.body, fontSize: 12, color: i === thinkingLog.length - 1 ? "#4A4540" : "#8A8680", lineHeight: "1.45" }}>{entry}</span>
            </div>
          ))}
        </div>
        <p style={{ ...F.condensed, fontSize: 9, color: "#A8A4A0", letterSpacing: "0.2em", textTransform: "uppercase" }}>This may take 30–90 seconds · Do not close the tab</p>
      </div>
    </div>
  );
}

// ── Usage Tab ─────────────────────────────────────────────────────────────────

function UsageTab({ records }: { records: UsageRecord[] }) {
  const totals = records.reduce((acc, r) => ({ in: acc.in + r.inputTokens, out: acc.out + r.outputTokens, cost: acc.cost + r.costUsd }), { in: 0, out: 0, cost: 0 });
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Input Tokens",  value: totals.in.toLocaleString(),   sub: "context + prompts" },
          { label: "Total Output Tokens", value: totals.out.toLocaleString(),  sub: "generated tokens" },
          { label: "Total Cost (USD)",    value: `$${totals.cost.toFixed(6)}`, sub: "all calls combined" },
        ].map((card, i) => (
          <div key={i} className="border p-4 flex flex-col gap-1" style={{ borderColor: "#D0CCC6", background: "#FFFFFF" }}>
            <div style={{ ...F.condensed, fontSize: 9, color: "#A8A4A0", letterSpacing: "0.22em", textTransform: "uppercase" }}>{card.label}</div>
            <div style={{ ...F.display, fontSize: 26, color: "#D97706", lineHeight: 1.1 }}>{card.value}</div>
            <div style={{ ...F.condensed, fontSize: 9, color: "#C4C0BA", letterSpacing: "0.1em" }}>{card.sub}</div>
          </div>
        ))}
      </div>
      {records.length > 0 ? (
        <div className="border overflow-hidden" style={{ borderColor: "#E2DDD8" }}>
          <div className="px-4 py-2.5 border-b flex items-center gap-2" style={{ background: "#FFFFFF", borderColor: "#E2DDD8" }}>
            <span style={{ ...F.condensed, fontSize: 10, color: "#6A6560", letterSpacing: "0.2em", textTransform: "uppercase" }}>Call Breakdown</span>
            <span style={{ ...F.mono, fontSize: 9, color: "#A8A4A0" }}>({records.length} call{records.length !== 1 ? "s" : ""})</span>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid #E2DDD8", background: "#F5F3EF" }}>
                {["#", "Label", "Model", "Input Tok", "Output Tok", "Cost (USD)", "Time"].map((h, i) => <th key={i} className="px-3 py-2 text-left" style={{ ...F.condensed, fontSize: 9, color: "#6A6560", letterSpacing: "0.18em", textTransform: "uppercase" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F0EDE8" }}>
                  <td className="px-3 py-2" style={{ ...F.mono, fontSize: 10, color: "#A8A4A0" }}>{i + 1}</td>
                  <td className="px-3 py-2 max-w-[180px]" style={{ ...F.body, fontSize: 12, color: "#3A3530" }}><span className="block truncate" title={r.label}>{r.label}</span></td>
                  <td className="px-3 py-2" style={{ ...F.mono, fontSize: 10, color: "#6A6560" }}>{r.model.replace("claude-", "").replace("-20251001", "")}</td>
                  <td className="px-3 py-2" style={{ ...F.mono, fontSize: 11, color: "#4A4540" }}>{r.inputTokens.toLocaleString()}</td>
                  <td className="px-3 py-2" style={{ ...F.mono, fontSize: 11, color: "#4A4540" }}>{r.outputTokens.toLocaleString()}</td>
                  <td className="px-3 py-2" style={{ ...F.mono, fontSize: 11, color: "#D97706", fontWeight: 600 }}>${r.costUsd.toFixed(6)}</td>
                  <td className="px-3 py-2" style={{ ...F.condensed, fontSize: 10, color: "#A8A4A0" }}>{new Date(r.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-12">
          <span style={{ ...F.display, fontSize: 40, color: "rgba(217,119,6,0.08)" }}>NO DATA YET</span>
          <span style={{ ...F.condensed, fontSize: 10, color: "#A8A4A0", letterSpacing: "0.2em", textTransform: "uppercase" }}>Usage data appears after first generation</span>
        </div>
      )}
    </div>
  );
}

// ── Main Home Component ───────────────────────────────────────────────────────

export default function Home() {
  type Phase = "gateway" | "generating" | "workspace";
  type Tab   = "mockup" | "history" | "usage";

  const [phase, setPhase]           = useState<Phase>("gateway");
  const [ticketIdInput, setTicketIdInput] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [ticketData, setTicketData] = useState<TicketData | null>(null);

  const [activeHtml, setActiveHtml] = useState("");
  const [activeTab, setActiveTab]   = useState<Tab>("mockup");
  const [messages, setMessages]     = useState<Message[]>([]);
  const [thinkingLog, setThinkingLog] = useState<string[]>([]);

  const [refineInput, setRefineInput] = useState("");
  const [isRefining, setIsRefining]   = useState(false);

  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(null);
  const [selectedModel, setSelectedModel]   = useState("");

  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);

  const [usageRecords, setUsageRecords]     = useState<UsageRecord[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [savedAt, setSavedAt]               = useState<Date | null>(null);

  const chatEndRef   = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jiraBaseUrl  = process.env.NEXT_PUBLIC_JIRA_BASE_URL ?? "";

  // ── Mount ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/config").then((r) => r.json()).then((cfg: ProviderConfig) => { setProviderConfig(cfg); setSelectedModel(cfg.defaultModel); }).catch(() => {});
    try { const raw = localStorage.getItem(RECENT_KEY); if (raw) setRecentSessions(JSON.parse(raw)); } catch {}
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isRefining]);

  // ── Persist session ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ticketData || phase !== "workspace") return;
    try {
      const s: PersistedSession = { ticketId: ticketData.id, ticketData, messages: messages.map((m) => ({ ...m, isStreaming: false })), activeHtml, usageRecords, selectedModel, savedAt: Date.now() };
      localStorage.setItem(SESSION_KEY(ticketData.id), JSON.stringify(s));
      setSavedAt(new Date());
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeHtml, usageRecords, selectedModel, phase, ticketData]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function recordRecent(ticketId: string, summary: string) {
    const updated = [{ ticketId, summary, timestamp: Date.now() }, ...recentSessions.filter((r) => r.ticketId !== ticketId)].slice(0, 5);
    setRecentSessions(updated);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(updated)); } catch {}
  }

  const updateLastMessage = (patchOrFn: Partial<Message> | ((m: Message) => Message)) =>
    setMessages((prev) => {
      const msgs = [...prev];
      const last = msgs[msgs.length - 1];
      if (!last) return msgs;
      msgs[msgs.length - 1] = typeof patchOrFn === "function" ? patchOrFn(last) : { ...last, ...patchOrFn };
      return msgs;
    });

  // ── Core SSE stream handler ────────────────────────────────────────────────

  async function streamChat(requestBody: Record<string, unknown>, usageLabel: string, onHtml: (html: string) => void): Promise<void> {
    const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
    if (!res.body) throw new Error("No response body");

    setMessages((prev) => [...prev, { role: "assistant", text: "", isStreaming: true, thinking: { log: [], done: false } }]);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", accumulated = "", streamingHtml: string | undefined;

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
            updateLastMessage((m) => ({ ...m, thinking: { log: [...(m.thinking?.log ?? []), t], done: false } }));
          }
          if (ev.thinkingDone) updateLastMessage((m) => ({ ...m, thinking: { log: m.thinking?.log ?? [], done: true, elapsed: ev.elapsed as number } }));
          if (ev.delta) { accumulated += ev.delta as string; updateLastMessage({ text: accumulated, isStreaming: true }); }
          if (ev.html) { streamingHtml = ev.html as string; onHtml(ev.html as string); }
          if (ev.done) {
            const mi = accumulated.indexOf(EFFORT_MARKER);
            updateLastMessage({ text: mi >= 0 ? accumulated.slice(0, mi).trim() : accumulated, htmlComponent: streamingHtml, effortEstimation: mi >= 0 ? accumulated.slice(mi).trim() : undefined, isStreaming: false });
            const inT = (ev.inputTokens as number) ?? 0, outT = (ev.outputTokens as number) ?? 0, cost = (ev.costUsd as number) ?? 0;
            if (inT || outT || cost) setUsageRecords((prev) => [...prev, { timestamp: Date.now(), label: usageLabel, model: (requestBody.model as string) ?? "claude-haiku-4-5-20251001", inputTokens: inT, outputTokens: outT, costUsd: cost }]);
          }
          if (ev.error) updateLastMessage({ text: `Error: ${ev.error as string}`, isStreaming: false });
        } catch { /* skip malformed */ }
      }
    }
  }

  // ── Generate (initial) ─────────────────────────────────────────────────────

  async function doGenerate(ticket: TicketData, model: string) {
    setThinkingLog([]);
    setPhase("generating");
    setMessages([{ role: "user", text: `Auto-generate UI mockup · ${ticket.id}: "${ticket.summary}"` }]);
    try {
      await streamChat({ jiraTicketId: ticket.id, jiraData: ticket, enableVisualSkill: true, model, isRefinement: false }, "Initial mockup generation", (html) => setActiveHtml(html));
    } finally {
      setPhase("workspace");
      setActiveTab("mockup");
    }
  }

  // ── Unlock ─────────────────────────────────────────────────────────────────

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    const id = ticketIdInput.trim().toUpperCase();
    if (!id) return;
    setIsFetching(true); setFetchError("");
    try {
      const res = await fetch(`/api/jira?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok || data.error) { setFetchError(data.error ?? "Failed to fetch ticket"); return; }
      const ticket = data as TicketData;
      setTicketData(ticket);
      recordRecent(ticket.id, ticket.summary);
      try {
        const raw = localStorage.getItem(SESSION_KEY(ticket.id));
        if (raw) {
          const saved: PersistedSession = JSON.parse(raw);
          if (saved.activeHtml && saved.messages?.length > 0) {
            setActiveHtml(saved.activeHtml); setMessages(saved.messages.map((m) => ({ ...m, isStreaming: false })));
            setUsageRecords(saved.usageRecords ?? []); if (saved.selectedModel) setSelectedModel(saved.selectedModel);
            setSavedAt(new Date(saved.savedAt)); setPhase("workspace"); setActiveTab("mockup");
            return;
          }
        }
      } catch {}
      await doGenerate(ticket, selectedModel || "claude-haiku-4-5-20251001");
    } catch { if (phase !== "workspace") setPhase("gateway"); setFetchError("Network error — check connection and try again."); }
    finally { setIsFetching(false); }
  }

  // ── Load recent session ────────────────────────────────────────────────────

  async function loadRecent(ticketId: string) {
    setTicketIdInput(ticketId); setIsFetching(true); setFetchError("");
    try {
      const res = await fetch(`/api/jira?id=${encodeURIComponent(ticketId)}`);
      const data = await res.json();
      if (!res.ok || data.error) { setFetchError(data.error ?? "Failed to fetch ticket"); return; }
      const ticket = data as TicketData;
      setTicketData(ticket);
      try {
        const raw = localStorage.getItem(SESSION_KEY(ticketId));
        if (raw) {
          const saved: PersistedSession = JSON.parse(raw);
          if (saved.activeHtml) {
            setActiveHtml(saved.activeHtml); setMessages(saved.messages.map((m) => ({ ...m, isStreaming: false })));
            setUsageRecords(saved.usageRecords ?? []); if (saved.selectedModel) setSelectedModel(saved.selectedModel);
            setSavedAt(new Date(saved.savedAt)); setPhase("workspace"); setActiveTab("mockup");
            return;
          }
        }
      } catch {}
      await doGenerate(ticket, selectedModel || "claude-haiku-4-5-20251001");
    } catch { setFetchError("Network error."); }
    finally { setIsFetching(false); }
  }

  // ── Refine ─────────────────────────────────────────────────────────────────

  async function handleRefine() {
    const prompt = refineInput.trim();
    if (!prompt || isRefining || !activeHtml || !ticketData) return;
    setRefineInput(""); setIsRefining(true); setActiveTab("history");
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    try {
      await streamChat(
        { jiraTicketId: ticketData.id, jiraData: ticketData, additionalPmContext: prompt, enableVisualSkill: true, model: selectedModel || "claude-haiku-4-5-20251001", isRefinement: true, currentHtml: activeHtml },
        `Refinement: "${prompt.slice(0, 45)}${prompt.length > 45 ? "…" : ""}"`,
        (html) => setActiveHtml(html),
      );
    } finally { setIsRefining(false); setActiveTab("mockup"); }
  }

  function handleRefineKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleRefine(); }
  }

  // ── Clear ──────────────────────────────────────────────────────────────────

  function clearSession() {
    if (ticketData) try { localStorage.removeItem(SESSION_KEY(ticketData.id)); } catch {}
    setTicketData(null); setTicketIdInput(""); setMessages([]); setActiveHtml(""); setUsageRecords([]);
    setSavedAt(null); setThinkingLog([]); setPhase("gateway"); setFetchError("");
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const parsed = await Promise.all(files.map(readFileContent));
    setAttachedFiles((prev) => [...prev, ...parsed].slice(0, 8));
    e.target.value = "";
  }

  const totalCost   = usageRecords.reduce((s, r) => s + r.costUsd, 0);
  const totalTokens = usageRecords.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: GATEWAY
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === "gateway") {
    return (
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "#F8F6F3" }}>
        <div className="absolute inset-0 grid-pattern pointer-events-none" />
        <div className="absolute pointer-events-none" style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "480px", height: "480px", background: "radial-gradient(circle, rgba(217,119,6,0.08) 0%, transparent 70%)" }} />
        <div className="corner-mark tl" /><div className="corner-mark tr" />
        <div className="corner-mark bl" /><div className="corner-mark br" />

        <div className="relative z-10 w-full max-w-[400px] px-6 space-y-8">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: "#D97706", animation: "subtle-pulse 2s ease-in-out infinite" }} />
              <span className="text-xs font-semibold tracking-[0.3em] uppercase" style={{ ...F.condensed, color: "#D97706" }}>PM Orchestrator</span>
            </div>
            <h1 className="leading-[0.9] text-[72px]" style={{ ...F.display, color: "#1A1510" }}>TICKET</h1>
            <h1 className="leading-[0.9] text-[72px]" style={{ ...F.display, color: "#D97706" }}>GATEWAY</h1>
            <p className="text-xs tracking-[0.22em] uppercase pt-1" style={{ ...F.condensed, color: "#6A6560" }}>Initialize workspace · Enter target ticket ID</p>
          </div>

          <div className="h-px w-full" style={{ background: "linear-gradient(90deg, #D97706 0%, transparent 70%)" }} />

          <form onSubmit={handleUnlock} className="space-y-6">
            <div className="space-y-2.5">
              <label htmlFor="ticketId" className="block text-xs font-semibold tracking-[0.25em] uppercase" style={{ ...F.condensed, color: "#6A6560" }}>Target Ticket ID</label>
              <div className="relative" style={{ overflow: "hidden" }}>
                <div className="scanner-sweep" style={{ top: 0 }} />
                <div className="relative flex items-center gap-3 pb-3 border-b-2 transition-colors duration-200 focus-within:border-amber-400" style={{ borderColor: "#D0CCC6", zIndex: 2 }}>
                  <span style={{ ...F.mono, color: "#D97706", fontSize: "13px" }}>▶</span>
                  <input id="ticketId" type="text" placeholder="GM-246050" value={ticketIdInput}
                    onChange={(e) => setTicketIdInput(e.target.value)} disabled={isFetching}
                    className="flex-1 bg-transparent outline-none text-sm font-medium tracking-[0.12em] uppercase disabled:opacity-50"
                    style={{ ...F.mono, color: "#1A1510", caretColor: "#D97706" }} />
                </div>
              </div>
            </div>

            {fetchError && (
              <div className="flex items-start gap-2 text-xs px-3 py-2.5 border" style={{ background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.18)", color: "#F87171", ...F.condensed, letterSpacing: "0.04em" }}>
                <span className="flex-none font-bold mt-px">✕</span><span>{fetchError}</span>
              </div>
            )}

            <button type="submit" disabled={isFetching || !ticketIdInput.trim()}
              className="w-full py-4 flex items-center justify-center gap-3 text-sm font-semibold tracking-[0.18em] uppercase transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ ...F.condensed, background: isFetching ? "rgba(217,119,6,0.10)" : "#D97706", color: isFetching ? "#D97706" : "#F8F6F3", border: isFetching ? "1px solid rgba(217,119,6,0.30)" : "none" }}>
              {isFetching
                ? <><div className="signal-bars"><span /><span /><span /><span /><span /></div><span>Fetching ticket data</span></>
                : <><span>Initialize Workspace</span><span className="opacity-50 ml-1">──▶</span></>}
            </button>
          </form>

          {recentSessions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span style={{ ...F.condensed, fontSize: 9, color: "#A8A4A0", letterSpacing: "0.22em", textTransform: "uppercase" }}>Recent Sessions</span>
                <div className="flex-1 h-px" style={{ background: "#E2DDD8" }} />
              </div>
              <div className="space-y-1.5">
                {recentSessions.map((s) => (
                  <button key={s.ticketId} onClick={() => loadRecent(s.ticketId)} disabled={isFetching}
                    className="w-full flex items-center gap-3 px-3 py-2.5 border text-left transition-all duration-150 disabled:opacity-40"
                    style={{ borderColor: "#E2DDD8", background: "#FFFFFF" }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#D97706")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E2DDD8")}>
                    <span style={{ ...F.mono, fontSize: 10, color: "#D97706", flexShrink: 0 }}>{s.ticketId}</span>
                    <span style={{ ...F.body, fontSize: 11, color: "#6A6260", flex: 1, lineHeight: "1.3" }} className="truncate">{s.summary}</span>
                    <span style={{ ...F.condensed, fontSize: 9, color: "#C4C0BA", flexShrink: 0 }}>{new Date(s.timestamp).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-xs tracking-[0.3em] uppercase" style={{ ...F.condensed, color: "#524C48" }}>MCP · Claude · GreyOrange</p>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: GENERATING
  // ══════════════════════════════════════════════════════════════════════════

  if (phase === "generating") {
    return <GeneratingScreen ticketId={ticketData?.id ?? ticketIdInput} summary={ticketData?.summary ?? ""} model={selectedModel || "claude-haiku-4-5-20251001"} thinkingLog={thinkingLog} />;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER: WORKSPACE
  // ══════════════════════════════════════════════════════════════════════════

  const mockupVersions = messages.filter((m) => m.htmlComponent);

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "#F8F6F3" }}>

      {/* Header */}
      <header className="flex-none relative flex items-center justify-between px-5 py-2.5 border-b" style={{ background: "#FFFFFF", borderColor: "#E2DDD8" }}>
        <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: "#D97706" }} />
        <div className="flex items-center gap-3 pl-3">
          <span className="text-xl tracking-widest" style={{ ...F.display, color: "#D97706" }}>PM·ORCH</span>
          <span style={{ color: "#D0CCC6", fontSize: "10px" }}>◆</span>
          <span className="text-xs tracking-[0.22em] uppercase" style={{ ...F.condensed, color: "#6A6560" }}>Active Session</span>
        </div>
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1 border" style={{ ...F.mono, color: "#D97706", borderColor: "rgba(217,119,6,0.25)", background: "rgba(217,119,6,0.08)", letterSpacing: "0.1em" }}>{ticketData?.id}</span>
          {ticketData?.metadata?.status && statusChip(ticketData.metadata.status)}
        </div>
        <div className="flex items-center gap-4">
          {providerConfig && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 border tracking-wider uppercase" style={{ ...F.condensed, fontSize: "9px", letterSpacing: "0.18em", color: "#D97706", borderColor: "rgba(245,158,11,0.4)", background: "rgba(217,119,6,0.10)" }}>{providerConfig.providerLabel}</span>
              <div className="relative">
                <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)} className="appearance-none pr-6 pl-2.5 py-1 text-xs border outline-none cursor-pointer" style={{ ...F.mono, fontSize: "11px", background: "#FFFFFF", color: "#3A3530", borderColor: "#C8C4BE", borderRadius: "2px" }}>
                  {providerConfig.models.map((m) => <option key={m.id} value={m.id} style={{ background: "#EEECE8" }}>{m.label}</option>)}
                </select>
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#6E6560", fontSize: "8px" }}>▾</span>
              </div>
            </div>
          )}
          {totalCost > 0 && (
            <button onClick={() => setActiveTab("usage")} className="flex items-center gap-1.5 px-2.5 py-1 border transition-colors" style={{ borderColor: "rgba(217,119,6,0.3)", background: "rgba(217,119,6,0.06)", borderRadius: 2 }} title="View full usage breakdown">
              <span style={{ ...F.condensed, fontSize: 9, color: "#A8A4A0", letterSpacing: "0.1em" }}>COST</span>
              <span style={{ ...F.mono, fontSize: 11, color: "#D97706", fontWeight: 600 }}>${totalCost.toFixed(5)}</span>
              <span style={{ ...F.condensed, fontSize: 9, color: "#C4C0BA" }}>{(totalTokens / 1000).toFixed(1)}k tok</span>
            </button>
          )}
          {savedAt && <span className="text-xs tracking-[0.15em] uppercase" style={{ ...F.condensed, color: "#16A34A", fontSize: "9px", opacity: 0.7 }} title={`Last saved ${savedAt.toLocaleTimeString()}`}>✦ saved {savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>}
          <button onClick={clearSession} className="text-xs tracking-[0.15em] uppercase px-2 py-0.5 border transition-colors duration-150 hover:border-red-400 hover:text-red-400" style={{ ...F.condensed, fontSize: "9px", color: "#6E6560", borderColor: "#D0CCC6", background: "transparent" }} title="Clear session and start fresh">New Session</button>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" style={{ animation: "status-ping 2s cubic-bezier(0,0,0.2,1) infinite" }} /><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" /></span>
            <span className="text-xs tracking-[0.2em] uppercase" style={{ ...F.condensed, color: "#6A6560", fontSize: "10px" }}>Live</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <TicketPanel ticketData={ticketData} jiraBaseUrl={jiraBaseUrl} />

        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Tab bar */}
          <div className="flex-none flex items-stretch border-b" style={{ background: "#FFFFFF", borderColor: "#E2DDD8" }}>
            {(["mockup", "history", "usage"] as Tab[]).map((tab) => {
              const labels: Record<Tab, string> = { mockup: "Mockup Preview", history: "Chat History", usage: "Usage & Cost" };
              const active = activeTab === tab;
              return (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className="relative px-5 py-2.5 flex items-center gap-2 transition-colors duration-150"
                  style={{ ...F.condensed, fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: active ? "#D97706" : "#6A6560", background: active ? "rgba(217,119,6,0.05)" : "transparent", borderRight: "1px solid #E2DDD8" }}>
                  {active && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "#D97706" }} />}
                  {labels[tab]}
                  {tab === "history" && messages.length > 0 && <span style={{ ...F.mono, fontSize: 9, color: active ? "#D97706" : "#A8A4A0" }}>({messages.length})</span>}
                  {tab === "usage"   && usageRecords.length > 0 && <span style={{ ...F.mono, fontSize: 9, color: active ? "#D97706" : "#A8A4A0" }}>({usageRecords.length})</span>}
                </button>
              );
            })}
            <div className="flex-1" />
            {isRefining && (
              <div className="flex items-center gap-2 px-4">
                <div className="signal-bars"><span /><span /><span /><span /><span /></div>
                <span style={{ ...F.condensed, fontSize: 9, color: "#D97706", letterSpacing: "0.15em" }}>Applying refinement…</span>
              </div>
            )}
          </div>

          {/* ── Mockup tab ─────────────────────────────────────────────────── */}
          {activeTab === "mockup" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-hidden relative" style={{ minHeight: 0 }}>
                {activeHtml ? (
                  <>
                    {isRefining && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3" style={{ background: "rgba(248,246,243,0.90)", backdropFilter: "blur(2px)" }}>
                        <div className="signal-bars"><span /><span /><span /><span /><span /></div>
                        <span style={{ ...F.condensed, fontSize: 11, color: "#D97706", letterSpacing: "0.2em", textTransform: "uppercase" }}>Applying refinements…</span>
                      </div>
                    )}
                    <iframe srcDoc={activeHtml} sandbox="allow-scripts allow-same-origin" className="w-full h-full bg-white" style={{ border: "none" }} title="UI Mockup Preview" />
                  </>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    <span style={{ ...F.display, fontSize: 48, color: "rgba(217,119,6,0.08)" }}>NO MOCKUP</span>
                    <span style={{ ...F.condensed, fontSize: 10, color: "#A8A4A0", letterSpacing: "0.2em", textTransform: "uppercase" }}>Mockup will appear here after generation</span>
                  </div>
                )}
              </div>

              {/* Refine strip */}
              <div className="flex-none border-t" style={{ background: "#FFFFFF", borderColor: "#E2DDD8" }}>
                <input ref={fileInputRef} type="file" multiple accept="*/*" className="hidden" onChange={handleFileSelect} />
                <div className="flex items-stretch">
                  <div className="flex items-center gap-2 px-4 border-r flex-none" style={{ borderColor: "#E2DDD8" }}>
                    <span style={{ ...F.condensed, fontSize: 9, color: "#A8A4A0", letterSpacing: "0.2em", textTransform: "uppercase" }}>Refine</span>
                    <span style={{ ...F.mono, color: "#D97706", fontSize: "12px" }}>›</span>
                  </div>
                  <textarea rows={1} placeholder="Describe changes: move filter row, change header color, add modal on click…"
                    value={refineInput} onChange={(e) => setRefineInput(e.target.value)} onKeyDown={handleRefineKeyDown}
                    disabled={isRefining} className="flex-1 px-4 py-3 text-sm resize-none outline-none bg-transparent disabled:opacity-50 chat-textarea"
                    style={{ ...F.body, color: "#1A1510", caretColor: "#D97706", lineHeight: "1.5" }} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={isRefining} title="Attach file"
                    className="flex-none flex items-center justify-center px-3 border-l transition-colors disabled:opacity-30" style={{ borderColor: "#E2DDD8" }}>
                    <span style={{ fontSize: 14, color: attachedFiles.length > 0 ? "#D97706" : "#A8A4A0" }}>📎</span>
                    {attachedFiles.length > 0 && <span style={{ ...F.mono, fontSize: 9, color: "#D97706", marginLeft: 3 }}>{attachedFiles.length}</span>}
                  </button>
                  <button onClick={handleRefine} disabled={isRefining || !refineInput.trim() || !activeHtml}
                    className="flex-none px-5 py-2 text-xs font-semibold tracking-[0.18em] uppercase transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed border-l"
                    style={{ ...F.condensed, borderColor: "#E2DDD8", background: isRefining ? "transparent" : "#D97706", color: isRefining ? "#D97706" : "#F8F6F3" }}>
                    {isRefining ? "···" : "Apply"}
                  </button>
                </div>
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 px-4 pb-2 pt-1">
                    {attachedFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-1.5 px-2 py-1 border" style={{ borderColor: "#E2DDD8", background: "#F5F3EF", borderRadius: 2 }}>
                        <span style={{ fontSize: 10 }}>{f.contentType === "image" ? "🖼" : "📄"}</span>
                        <span style={{ ...F.mono, fontSize: 10, color: "#6A6260" }}>{f.name}</span>
                        <button onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))} style={{ color: "#A8A4A0", fontSize: 13, marginLeft: 2 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between px-4 pb-1.5">
                  <span style={{ ...F.condensed, fontSize: 9, color: "#C4C0BA", letterSpacing: "0.1em" }}>
                    {mockupVersions.length} version{mockupVersions.length !== 1 ? "s" : ""} · {messages.length} interaction{messages.length !== 1 ? "s" : ""}
                  </span>
                  <span style={{ ...F.mono, color: "#C4C0BA", fontSize: "10px" }}>⌘ + ↵ to apply</span>
                </div>
              </div>
            </div>
          )}

          {/* ── History tab ────────────────────────────────────────────────── */}
          {activeTab === "history" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {messages.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center gap-3">
                    <span style={{ ...F.display, fontSize: 60, color: "rgba(217,119,6,0.06)" }}>STANDBY</span>
                    <p style={{ ...F.condensed, fontSize: 10, color: "#6A6560", letterSpacing: "0.2em", textTransform: "uppercase" }}>No interactions yet for <span style={{ color: "#D97706" }}>{ticketData?.id}</span></p>
                  </div>
                )}

                {messages.map((msg, midx) => (
                  <div key={midx} className="msg-appear space-y-2" style={{ animationDelay: `${midx * 20}ms` }}>
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-semibold tracking-[0.22em] uppercase" style={{ ...F.condensed, color: msg.role === "user" ? "#6060A0" : "#D97706" }}>{msg.role === "user" ? "Operator" : "Claude · AI"}</span>
                      <div className="flex-1 h-px" style={{ background: msg.role === "user" ? "#C4C0BA" : "linear-gradient(90deg, rgba(217,119,6,0.40) 0%, transparent 80%)" }} />
                      {msg.role === "assistant" && <span style={{ ...F.mono, color: "#6E6560", fontSize: "9px" }}>MCP</span>}
                    </div>

                    {msg.thinking && <ThinkingBlock log={msg.thinking.log} done={msg.thinking.done} elapsed={msg.thinking.elapsed} />}

                    {(msg.text || msg.isStreaming) && (
                      <div className="px-4 py-3 border-l-2" style={{ borderLeftColor: msg.role === "user" ? "#A8A4A0" : "#D97706", background: msg.role === "user" ? "#ECEAE6" : "rgba(217,119,6,0.06)" }}>
                        {msg.role === "user"
                          ? <span className="whitespace-pre-wrap" style={{ ...F.body, fontSize: 13, color: "#3A3530", lineHeight: "1.75" }}>{msg.text}</span>
                          : <>{msg.text && <ChatMarkdown text={msg.text} />}{msg.isStreaming && <span className="streaming-cursor inline-block w-[2px] h-[1.1em] ml-[1px] align-text-bottom bg-amber-400" />}</>}
                      </div>
                    )}

                    {/* Mockup version thumbnail with "Load" button */}
                    {msg.htmlComponent && (
                      <div className="border overflow-hidden" style={{ borderColor: "#D0CCC6" }}>
                        <div className="flex items-center justify-between gap-2 px-4 py-2 border-b" style={{ background: "#EEECE8", borderColor: "#E2DDD8" }}>
                          <div className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 inline-block" style={{ animation: "subtle-pulse 2s ease-in-out infinite" }} />
                            <span style={{ ...F.mono, color: "#3A3530", fontSize: "11px" }}>
                              {`v${messages.slice(0, midx + 1).filter(m => m.htmlComponent).length}`} · Mockup snapshot
                            </span>
                          </div>
                          <button onClick={() => { setActiveHtml(msg.htmlComponent!); setActiveTab("mockup"); }}
                            className="flex items-center gap-1.5 px-2.5 py-1 border text-xs transition-all duration-150"
                            style={{ ...F.condensed, fontSize: 9, letterSpacing: "0.15em", color: "#D97706", borderColor: "rgba(217,119,6,0.3)", background: "rgba(217,119,6,0.06)" }}
                            title="Restore this version as the active mockup">
                            ↑ Load Version
                          </button>
                        </div>
                        <iframe srcDoc={msg.htmlComponent} sandbox="allow-scripts allow-same-origin" className="w-full bg-white" style={{ height: "280px", border: "none" }} title={`Mockup v${midx}`} />
                      </div>
                    )}

                    {msg.effortEstimation && (
                      <div className="border overflow-hidden" style={{ borderColor: "#C4C0BA" }}>
                        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ background: "#FFFFFF", borderColor: "#E2DDD8" }}>
                          <div className="flex items-center gap-2"><span style={{ fontSize: 10 }}>📊</span><span style={{ ...F.condensed, fontSize: 10, color: "#D97706", letterSpacing: "0.22em", textTransform: "uppercase" }}>Effort Estimation</span></div>
                          <span style={{ ...F.mono, fontSize: 9, color: "#A8A4A0" }}>MCP · estimate-effort</span>
                        </div>
                        <div className="px-4 py-4" style={{ background: "#F5F3EF" }}><EffortMarkdown text={msg.effortEstimation} /></div>
                      </div>
                    )}
                  </div>
                ))}

                {isRefining && (
                  <div className="msg-appear space-y-2">
                    <div className="flex items-center gap-2.5">
                      <span style={{ ...F.condensed, fontSize: 10, fontWeight: 600, letterSpacing: "0.22em", textTransform: "uppercase", color: "#D97706" }}>Claude · AI</span>
                      <div className="flex-1 h-px" style={{ background: "linear-gradient(90deg, rgba(217,119,6,0.30) 0%, transparent 80%)" }} />
                    </div>
                    <div className="px-4 py-4 border-l-2 flex items-center gap-4" style={{ borderLeftColor: "#D97706", background: "rgba(217,119,6,0.04)" }}>
                      <div className="signal-bars"><span /><span /><span /><span /><span /></div>
                      <span className="text-xs tracking-[0.2em] uppercase" style={{ ...F.condensed, color: "#3A3530" }}>Processing refinement…</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* History chat input */}
              <div className="flex-none border-t p-4" style={{ background: "#FFFFFF", borderColor: "#E2DDD8" }}>
                <div className="border" style={{ borderColor: "#E2DDD8" }}>
                  <div className="flex">
                    <div className="flex-none flex items-start pt-3.5 px-3 border-r" style={{ borderColor: "#E2DDD8" }}><span style={{ ...F.mono, color: "#D97706", fontSize: "14px" }}>›</span></div>
                    <textarea rows={3} placeholder="Describe refinements or ask about the mockup…" value={refineInput} onChange={(e) => setRefineInput(e.target.value)} onKeyDown={handleRefineKeyDown} disabled={isRefining} className="chat-textarea flex-1 px-4 py-3 text-sm resize-none outline-none bg-transparent disabled:opacity-50" style={{ ...F.body, color: "#1A1510", caretColor: "#D97706" }} />
                    <div className="flex-none flex flex-col items-stretch gap-px border-l" style={{ borderColor: "#E2DDD8" }}>
                      <button onClick={() => fileInputRef.current?.click()} disabled={isRefining} title="Attach" className="flex-1 flex items-center justify-center px-3 transition-colors disabled:opacity-30" style={{ background: "#FFFFFF", borderBottom: "1px solid #E2DDD8" }}>
                        <span style={{ fontSize: 15, color: attachedFiles.length > 0 ? "#D97706" : "#A8A4A0" }}>📎</span>
                        {attachedFiles.length > 0 && <span style={{ ...F.mono, fontSize: 9, color: "#D97706", marginLeft: 3 }}>{attachedFiles.length}</span>}
                      </button>
                      <button onClick={handleRefine} disabled={isRefining || !refineInput.trim() || !activeHtml} className="flex-none px-4 py-2.5 text-xs font-semibold tracking-[0.18em] uppercase transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed" style={{ ...F.condensed, background: isRefining ? "transparent" : "#D97706", color: isRefining ? "#D97706" : "#F8F6F3", border: isRefining ? "1px solid rgba(217,119,6,0.30)" : "none", borderRadius: 0 }}>
                        {isRefining ? "···" : "Send"}
                      </button>
                    </div>
                  </div>
                  <div className="px-4 pb-2 pt-1 flex justify-end"><span style={{ ...F.mono, color: "#C4C0BA", fontSize: "10px" }}>⌘ + ↵ to send</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ── Usage tab ──────────────────────────────────────────────────── */}
          {activeTab === "usage" && <UsageTab records={usageRecords} />}

        </main>
      </div>
    </div>
  );
}
