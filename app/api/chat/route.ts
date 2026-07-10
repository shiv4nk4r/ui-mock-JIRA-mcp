import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";
import { request as httpRequest } from "node:http";
import {
  fetchContextResources,
  listProductScreenshots,
  screenshotPath,
} from "@/mcp-bridge";
import {
  buildMockupGrounding,
  injectGroundingIntoHtml,
  stripInjectedCaptureCss,
  type MockupGrounding,
} from "@/capture-grounding";
import { LEAN_MOCKUP_RUN, formatRouteHints } from "@/lean-mockup-run";
import { resolveCaptureLabel, surveyPageTemplates } from "@/capture-catalog";

export const dynamic = "force-dynamic";

// Path to the manager-dashboard source repo indexed by the MCP server.
const MD_REPO_ROOT = process.env.MD_REPO_ROOT ?? "/Users/manish.c/workplace/manager-dashboard";

// URL of the persistent HTTP MCP server (src/mcp-http-server.ts).
const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? "http://127.0.0.1:3100/mcp";
const MCP_HEALTH_URL = MCP_SERVER_URL.replace(/\/mcp$/, "/health");

// ── Context resource cache ────────────────────────────────────────────────────
// fetchContextResources() spins up an InMemory MCP client/server pair and reads
// four files on every call. Cache the result — files change rarely during a dev
// session and never in production.

interface FetchedContextCache { data: Awaited<ReturnType<typeof fetchContextResources>>; expiresAt: number }
let ctxCache: FetchedContextCache | null = null;
const CTX_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedContext() {
  if (ctxCache && Date.now() < ctxCache.expiresAt) return ctxCache.data;
  const data = await fetchContextResources();
  ctxCache = { data, expiresAt: Date.now() + CTX_TTL_MS };
  return data;
}

// Pre-warm on module load so the first request hits cache, not cold file reads.
getCachedContext().catch(() => { /* ignore — will retry on first request */ });

// ── MCP health check cache ────────────────────────────────────────────────────
// Avoid pinging :3100/health on every generation request.
// Cache "ready" for 30 s; cache "not ready" for 5 s so a starting server is
// detected quickly.

interface McpHealthCache { ready: boolean; expiresAt: number }
let mcpHealthCache: McpHealthCache | null = null;

async function checkMcpServerReady(): Promise<boolean> {
  if (mcpHealthCache && Date.now() < mcpHealthCache.expiresAt) return mcpHealthCache.ready;
  const ready = await isMcpServerReady();
  mcpHealthCache = { ready, expiresAt: Date.now() + (ready ? 30_000 : 5_000) };
  return ready;
}

// ── Component library section splitter ───────────────────────────────────────
// SECTION 1 (BASE CSS BLOCK, ~15 KB) is needed for both generation and
// refinement — it has all CSS values Claude must copy verbatim.
// SECTION 2 (HTML SNIPPETS, ~17 KB) is only useful when generating new HTML,
// not when editing existing HTML in a refinement.

function extractBaseCssBlock(componentLibrary: string): string {
  const section2 = componentLibrary.indexOf("\n## SECTION 2:");
  return section2 !== -1 ? componentLibrary.slice(0, section2).trimEnd() : componentLibrary;
}

// MCP tool names exposed by src/md-mcp-server.ts (server name = "md").
const MD_MCP_TOOLS = [
  // Filesystem tools — fast, always available
  "mcp__md__list-routes",
  "mcp__md__find-components",
  "mcp__md__read-source-file",
  "mcp__md__list-graphql",
  "mcp__md__find-usages",
  "mcp__md__list-store-modules",
  "mcp__md__list-resolvers",
  // Parser/graph tools — AST-level, requires index
  "mcp__md__rebuild-code-index",
  "mcp__md__search-code-symbols",
  "mcp__md__get-file-structure",
  "mcp__md__find-callers",
  "mcp__md__get-vue-component",
  "mcp__md__get-resolver-info",
  // Compound context tool — preferred first call for every ticket
  "mcp__md__find-related-context",
  // Capture-grounded visual tools — require `npm run crawl` to populate
  "mcp__md__list-captured-pages",
  "mcp__md__survey-page-templates",
  "mcp__md__get-page-template",
  // Codebase introspection tools for accurate mockup generation
  "mcp__md__get-table-columns",
  "mcp__md__get-domain-status-map",
  "mcp__md__resolve-i18n-keys",
  "mcp__md__read-files-batch",
] as const;

// ── Token pricing (USD per 1 M tokens: [input, output]) ───────────────────────
const TOKEN_PRICING: Record<string, [number, number]> = {
  "claude-haiku-4-5":          [0.80,   4.00],
  "claude-haiku-4-5-20251001": [0.80,   4.00],
  "claude-sonnet-4-6":         [3.00,  15.00],
  "claude-opus-4-7":           [15.00, 75.00],
  "gemini-2.5-flash":          [0.075,  0.30],
  "gemini-2.5-pro":            [1.25,  10.00],
  "gpt-4o-mini":               [0.15,   0.60],
  "gpt-4o":                    [2.50,  10.00],
};

function tokenCost(model: string, inputTokens: number, outputTokens: number): number {
  const [inP, outP] = TOKEN_PRICING[model] ?? [1.00, 5.00];
  return (inputTokens * inP + outputTokens * outP) / 1_000_000;
}

function charsToTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

// ── Session Logger ─────────────────────────────────────────────────────────────

interface LogStep {
  step: string; startTs: number; durationMs: number;
  inputTokens: number; outputTokens: number; costUsd: number; detail: string;
}

interface ToolCallEntry {
  seq: number;
  tool: string;
  input: Record<string, unknown>;
}

const SESSION_LOG_DIR = join(homedir(), "claude-ui-designs", "logs");

class SessionLogger {
  readonly sessionId: string;
  readonly ticketId:  string;
  readonly provider:  string;
  readonly model:     string;
  readonly startTs:   number;
  readonly logFile:   string;
  readonly jsonFile:  string;

  private steps:            LogStep[]       = [];
  private stepStart         = 0;
  private toolCalls:        ToolCallEntry[] = [];
  private thinkingLines:    string[]        = [];
  private systemPrompt      = "";
  private userMessage       = "";
  private mcpTransport:     "http" | "stdio" | "none" = "none";
  private capturesAvailable = false;
  private captureLabel      = "";
  private isRefinement      = false;

  constructor(ticketId: string, provider: string, model: string) {
    this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.ticketId  = ticketId;
    this.provider  = provider;
    this.model     = model;
    this.startTs   = Date.now();
    mkdirSync(SESSION_LOG_DIR, { recursive: true });
    const base     = `${ticketId}-${this.sessionId}`;
    this.logFile   = join(SESSION_LOG_DIR, `${base}.log.md`);
    this.jsonFile  = join(SESSION_LOG_DIR, `${base}.log.json`);
  }

  /** Call once after prompts are built, before spawning the CLI. */
  setRequestContext(opts: {
    systemPrompt:      string;
    userMessage:       string;
    mcpTransport:      "http" | "stdio" | "none";
    capturesAvailable: boolean;
    captureLabel:      string;
    isRefinement:      boolean;
  }) {
    this.systemPrompt      = opts.systemPrompt;
    this.userMessage       = opts.userMessage;
    this.mcpTransport      = opts.mcpTransport;
    this.capturesAvailable = opts.capturesAvailable;
    this.captureLabel      = opts.captureLabel;
    this.isRefinement      = opts.isRefinement;
  }

  /** Record an MCP tool call seen in the CLI stream. */
  recordToolCall(tool: string, input: Record<string, unknown>) {
    this.toolCalls.push({ seq: this.toolCalls.length + 1, tool, input });
  }

  /** Record a thinking snippet seen in the CLI stream. */
  recordThinking(text: string) {
    this.thinkingLines.push(text);
  }

  beginStep() { this.stepStart = Date.now(); }

  record(step: string, opts: { inputTokens?: number; outputTokens?: number; costUsd?: number; detail?: string } = {}) {
    const durationMs   = this.stepStart ? Date.now() - this.stepStart : 0;
    const inputTokens  = opts.inputTokens  ?? 0;
    const outputTokens = opts.outputTokens ?? 0;
    const costUsd      = opts.costUsd ?? tokenCost(this.model, inputTokens, outputTokens);
    this.steps.push({ step, startTs: this.stepStart || Date.now(), durationMs, inputTokens, outputTokens, costUsd, detail: opts.detail ?? "" });
    this.stepStart = 0;
  }

  finish(opts: {
    responseText?:  string;
    htmlSizeBytes?: number;
    htmlExtracted?: boolean;
    exitCode?:      number | null;
    stderr?:        string;
    error?:         string;
  } = {}): { logFile: string; logData: string } {
    const totalMs   = Date.now() - this.startTs;
    const totalIn   = this.steps.reduce((s, r) => s + r.inputTokens,  0);
    const totalOut  = this.steps.reduce((s, r) => s + r.outputTokens, 0);
    const totalCost = this.steps.reduce((s, r) => s + r.costUsd,      0);
    const pricing   = TOKEN_PRICING[this.model]
      ? `$${TOKEN_PRICING[this.model][0]}/M in · $${TOKEN_PRICING[this.model][1]}/M out`
      : "pricing unknown — conservative fallback $1/$5 per M";

    // ── Markdown log (human-readable, existing format + enhancements) ──────────

    const rows = this.steps.map((r, i) => {
      const inT  = r.inputTokens  ? r.inputTokens.toLocaleString()  : "—";
      const outT = r.outputTokens ? r.outputTokens.toLocaleString() : "—";
      const cost = r.costUsd > 0  ? `$${r.costUsd.toFixed(6)}`      : "—";
      return `| ${i + 1} | ${r.step}${r.detail ? ` · ${r.detail}` : ""} | ${r.durationMs}ms | ${inT} | ${outT} | ${cost} |`;
    }).join("\n");

    const toolCallSection = this.toolCalls.length
      ? `\n## MCP Tool Calls (${this.toolCalls.length})\n\n` +
        this.toolCalls.map((t) =>
          `### ${t.seq}. \`${t.tool}\`\n\`\`\`json\n${JSON.stringify(t.input, null, 2)}\n\`\`\``
        ).join("\n\n")
      : "";

    const errorSection = opts.error
      ? `\n## Error\n\n\`\`\`\n${opts.error}\n\`\`\`\n`
      : "";

    const stderrSection = opts.stderr?.trim()
      ? `\n## Claude CLI stderr\n\n\`\`\`\n${opts.stderr.slice(0, 2000)}\n\`\`\`\n`
      : "";

    const logData = `# Session Log: ${this.ticketId}

**Session ID:** ${this.sessionId}
**Provider:** ${this.provider}
**Model:** ${this.model} (${pricing})
**Started:** ${new Date(this.startTs).toISOString()}
**Type:** ${this.isRefinement ? "Refinement" : "Initial generation"}
**MCP transport:** ${this.mcpTransport}
**Captures available:** ${this.capturesAvailable}${this.captureLabel ? ` (label: ${this.captureLabel})` : ""}
**Log file:** ${this.logFile}
**JSON log:** ${this.jsonFile}

## Orchestration & Enrichment Steps

| # | Step | Duration | Input Tokens | Output Tokens | Cost (USD) |
|---|------|----------|-------------|--------------|------------|
${rows}

## Consolidated Totals

| Metric | Value |
|--------|-------|
| Total Input Tokens | ${totalIn.toLocaleString()} |
| Total Output Tokens | ${totalOut.toLocaleString()} |
| Total Tokens | ${(totalIn + totalOut).toLocaleString()} |
| **Total Cost** | **$${totalCost.toFixed(6)}** |
| Total Duration | ${totalMs}ms |
| Exit code | ${opts.exitCode ?? 0} |
| HTML extracted | ${opts.htmlExtracted ? `yes (${((opts.htmlSizeBytes ?? 0) / 1024).toFixed(1)} KB)` : "no"} |
| MCP tool calls | ${this.toolCalls.length} |
${toolCallSection}${errorSection}${stderrSection}`;

    writeFileSync(this.logFile, logData, "utf8");

    // ── JSON log (machine-readable, for debugging / scripted analysis) ─────────

    const MAX_PROMPT_CHARS = 300_000; // ~75k tokens — cap to avoid huge files
    const jsonPayload = {
      sessionId:         this.sessionId,
      ticketId:          this.ticketId,
      timestamp:         new Date(this.startTs).toISOString(),
      model:             this.model,
      provider:          this.provider,
      isRefinement:      this.isRefinement,
      mcpTransport:      this.mcpTransport,
      capturesAvailable: this.capturesAvailable,
      captureLabel:      this.captureLabel,
      prompts: {
        systemChars:          this.systemPrompt.length,
        systemTokensEst:      charsToTokens(this.systemPrompt.length),
        userChars:            this.userMessage.length,
        userTokensEst:        charsToTokens(this.userMessage.length),
        systemPrompt:         this.systemPrompt.slice(0, MAX_PROMPT_CHARS),
        systemPromptTruncated: this.systemPrompt.length > MAX_PROMPT_CHARS,
        userMessage:          this.userMessage.slice(0, 50_000),
        userMessageTruncated: this.userMessage.length > 50_000,
      },
      toolCalls:      this.toolCalls,
      thinkingLines:  this.thinkingLines,
      response: {
        text:         (opts.responseText ?? "").slice(0, 50_000),
        textTruncated: (opts.responseText?.length ?? 0) > 50_000,
        htmlExtracted: opts.htmlExtracted ?? false,
        htmlSizeBytes: opts.htmlSizeBytes ?? 0,
      },
      usage: {
        inputTokens:    totalIn,
        outputTokens:   totalOut,
        totalTokens:    totalIn + totalOut,
        costUsd:        totalCost,
        totalDurationMs: totalMs,
      },
      steps:    this.steps,
      exitCode: opts.exitCode ?? 0,
      stderr:   (opts.stderr ?? "").slice(0, 5_000),
      error:    opts.error ?? null,
    };

    writeFileSync(this.jsonFile, JSON.stringify(jsonPayload, null, 2), "utf8");

    return { logFile: this.logFile, logData };
  }
}

interface UserAttachedFile {
  name: string;
  type: string;
  content: string;
  contentType: "text" | "html" | "image" | "binary";
}

interface ChatRequest {
  jiraTicketId: string;
  jiraData: JiraTicket;
  additionalPmContext?: string;
  enableVisualSkill: boolean;
  model?: string;
  provider?: string;
  attachedFiles?: UserAttachedFile[];
  isRefinement?: boolean;
  currentHtml?: string;
  userRole?: "external" | "internal";
}




// ── HTML marker extraction ────────────────────────────────────────────────────

const HTML_MARKER_START = "RAW_HTML_COMPONENT_START";
const HTML_MARKER_END   = "RAW_HTML_COMPONENT_END";

const EFFORT_MARKER = "### 📊 Engineering Effort Estimation Summary";

function stripEffortEstimation(text: string): string {
  const mi = text.indexOf(EFFORT_MARKER);
  return mi >= 0 ? text.slice(0, mi).trim() : text;
}

function extractHtmlFromMarkers(text: string): { displayText: string; html: string | undefined } {
  const si = text.indexOf(HTML_MARKER_START);
  const ei = text.indexOf(HTML_MARKER_END);
  if (si === -1 || ei === -1 || ei <= si) return { displayText: text, html: undefined };
  const html        = text.slice(si + HTML_MARKER_START.length, ei).trim();
  const displayText = (text.slice(0, si) + text.slice(ei + HTML_MARKER_END.length)).trim();
  return { displayText, html };
}

// ── System prompt ─────────────────────────────────────────────────────────────

/**
 * Builds the system prompt. All three context strings are pre-fetched via the
 * MCP bridge (InMemoryTransport) and passed in — no direct file reads here.
 *
 * archContext  → context.md  (architecture, tech stack, conventions, data flow)
 * designContext → design.md   (color system, Quasar component rules, patterns)
 * sitemapContext → site-map.md (navigation, routes, feature flags)
 */
function buildSystemPrompt(
  enableVisualSkill: boolean,
  archContext    = "",
  designContext  = "",
  sitemapContext = "",
  hasMcpCodeTools = false,
  componentLibraryContext = "",
  templateSurveyContext = "",
  mockupGrounding: MockupGrounding | null = null,
  userRole: "external" | "internal" = "internal",
): string {
  const isExternal = userRole === "external";
  const base = isExternal
    ? `You are a senior product design assistant for GreyOrange's Manager Dashboard warehouse system. Analyse Jira tickets and produce product-focused requirement analyses and UI mockups. Keep responses concise and actionable for product managers.

IMPORTANT — EXTERNAL PM MODE:
- Focus on user experience, workflows, and product requirements only.
- Do NOT include engineering effort estimates, story points, file paths, or code change details.
- Do NOT mention Vue components, GraphQL resolvers, or internal architecture unless directly relevant to UX.

IMPORTANT — WEB API MODE:
- You are running as a subprocess of a Next.js API route, NOT an interactive CLI session.
- The Jira ticket data is already provided below — do NOT call any Atlassian MCP tools.
- Do NOT read or follow any CLAUDE.md files in the project directory.
- Do NOT ask the user to run /mcp or authenticate with any service.
- The Read tool is ONLY for product screenshot images in the src/mcp-context/ directory.
- Use mcp__md__* tools sparingly — only when needed for accurate UI mockups.`
    : `You are a senior product engineering assistant for GreyOrange's Manager Dashboard warehouse system (Vue 2 + Quasar 1.20.1 frontend, Apollo GraphQL BFF). Analyse Jira tickets and produce structured requirement analyses with effort estimations. Keep responses concise and actionable.

IMPORTANT — WEB API MODE:
- You are running as a subprocess of a Next.js API route, NOT an interactive CLI session.
- The Jira ticket data is already provided below — do NOT call any Atlassian MCP tools.
- Do NOT read or follow any CLAUDE.md files in the project directory.
- Do NOT ask the user to run /mcp or authenticate with any service.
- The Read tool is ONLY for product screenshot images in the src/mcp-context/ directory.
- Use mcp__md__* tools to read the manager-dashboard codebase only.`;

  const hasSomeContext = archContext || designContext || sitemapContext;
  if (!hasSomeContext) return base;

  const sections: string[] = [base];

  if (archContext) {
    sections.push(
      "=== SYSTEM ARCHITECTURE & CONVENTIONS (from context.md via MCP) ===",
      archContext,
      "=== END ARCHITECTURE ==="
    );
  }

  if (designContext) {
    sections.push(
      "=== DESIGN LANGUAGE & QUASAR RULES (from design.md via MCP) ===",
      designContext,
      "=== END DESIGN LANGUAGE ==="
    );
  }

  if (sitemapContext) {
    sections.push(
      "=== NAVIGATION SITEMAP (from site-map.md via MCP) ===",
      sitemapContext,
      "=== END SITEMAP ==="
    );
  }

  if (hasMcpCodeTools) {
    sections.push(
      "=== LIVE CODEBASE TOOLS (manager-dashboard MCP server) ===",
      "",
      `REPO LOCATION: ${MD_REPO_ROOT}/`,
      "  mdui/src/   → Vue 2 + Quasar frontend (pages/, components/, graphql/, store/, router/)",
      "  mdbff/src/  → Apollo GraphQL BFF (resolvers/, typeDefs/, models/)",
      "",
      "IMPORTANT — DO NOT use the Read tool on the repo path. Use mcp__md__* tools instead.",
      "The Read tool is ONLY for product screenshot images in the current working directory.",
      `If MCP tools are unavailable, you may fall back to Read('${MD_REPO_ROOT}/mdui/src/...').`,
      "",
      "─── TOOL CATALOGUE ───────────────────────────────────────────────────────",
      "",
  "  CAPTURE-GROUNDED VISUAL TOOLS (require `npm run crawl` to populate):",
      "  • survey-page-templates — Full catalog of all crawled routes by archetype.",
      "      ALREADY IN SYSTEM PROMPT when captures exist — do NOT call again.",
      "  • get-page-template    — Stripped DOM template for 1–6 routes in one call.",
      "      routes=[primary, ...grafts] — prefer array form. CSS auto-injected server-side.",
      "  • list-captured-pages  — List all crawled pages (route, title, detected components).",
      "",
      "  PRIMARY CODE TOOL — call this when captures are unavailable or for exact field names:",
      "  • find-related-context — Takes keywords from the ticket → scores every .vue file by",
      "      filename + content match → returns top-N with API surface + source code.",
      "      ONE call replaces 3–5 individual lookups.",
      "",
      "  FILESYSTEM (fast, always available):",
      "  • list-routes          — Full Vue Router route tree (exact hash paths + page components)",
      "  • find-components      — Search .vue filenames by name fragment or domain",
      "  • read-source-file     — Full source of any file (Vue SFC, GraphQL, store, resolver)",
      "  • list-graphql         — List GraphQL query/mutation/subscription files by domain",
      "  • find-usages          — Files that import a component or query constant",
      "  • list-store-modules   — Vuex store module structure for a domain",
      "  • list-resolvers       — BFF GraphQL resolver files by domain",
      "",
      "  AST / GRAPH (structured — needs index; 'Index not ready' = still building):",
      "  • get-vue-component    — Props, data keys, computed, methods, apollo queries, mixins",
      "  • search-code-symbols  — Fuzzy name search: functions, components, resolvers",
      "  • get-file-structure   — All symbols in a file + import/importedBy graph edges",
      "  • find-callers         — Call graph: which functions call a given function",
      "  • get-resolver-info    — BFF resolver: operation type, params, async flag",
      "  • rebuild-code-index   — Force full re-index (use if index is stale or missing)",
      "",
      "─── REQUIRED WORKFLOW ────────────────────────────────────────────────────",
      "",
      "PATH A — Visual grounding (when PAGE TEMPLATE SURVEY is in the system prompt):",
      "  STEP A1: Pick the best route from the survey (already embedded above).",
      "  STEP A2: Call get-page-template(routes=[primary, ...grafts]) — ONE call, max 3 routes.",
      "  STEP A3: Call find-related-context with ticket keywords to get real field names/columns.",
      "  STEP A4: Graft ticket-specific columns, statuses, and actions onto the real template HTML.",
      "",
      "PATH B — Code grounding (when no captures or survey is missing):",
      "  STEP B1: Call find-related-context with keywords from the ticket (MANDATORY first call).",
      "  STEP B2: Study returned components for column definitions, filter classes, Apollo queries.",
      "  STEP B3: Read truncated files with read-source-file if source was cut off.",
      "  STEP B4: Confirm GraphQL field names: list-graphql(domain) → read-source-file on the query.",
      "",
      "STEP FINAL — Generate mockup using ALL context together:",
      "  (A) Captured template HTML (PATH A) → real layout, real Quasar classes, real nav structure",
      "  (B) find-related-context result     → real columns, status strings, field names",
      "  (C) COMPONENT LIBRARY + design.md   → exact CSS classes and HTML snippets",
      "  Never invent columns/data when (B) returned them.",
      "  Never invent CSS/colors when (C) defines them.",
      "  Captured Quasar CSS is AUTO-INJECTED — preserve q-table/q-btn/q-dialog class names.",
      "",
      "FALLBACK (if MCP unavailable):",
      `  Use Read('${MD_REPO_ROOT}/mdui/src/pages/<domain>/...') to find the page component.`,
      "  Then proceed with the same pattern.",
      "",
      "=== END CODEBASE TOOLS ==="
    );
  }

  if (enableVisualSkill && componentLibraryContext) {
    sections.push(
      "=== COMPONENT LIBRARY (component-library.md) ===",
      componentLibraryContext,
      "=== END COMPONENT LIBRARY ===",
      "",
      "MANDATORY COMPONENT LIBRARY RULES:",
      "0. PRECEDENCE: The BASE CSS BLOCK is the single source of truth for every pixel value, color, font, border, and class. Where design.md and the component library disagree on ANY value, the component library WINS. design.md is for structure/behavior context only — never copy CSS numbers or hex colors from it.",
      "1. COPY the Section 1 BASE CSS BLOCK verbatim into your <style>. No modifications, no omissions, no re-derived values.",
      "2. For each UI section, find the matching SNIPPET: <slug> and use that HTML as-is.",
      "3. Only write NEW CSS for ticket-specific column widths and data layout. Reuse the library classes for everything else.",
      "4. NEVER invent or re-derive component styles, colors, or status-chip backgrounds — use the library classes.",
      "5. Sort indicators MUST use the CSS triangle pattern from the BASE CSS BLOCK — never Unicode ▲▼.",
      "6. Status chips: pick the chip-* class whose bucket matches the status string. Never set a chip background inline."
    );
  }

  if (enableVisualSkill) {
    sections.push(LEAN_MOCKUP_RUN);
  }

  if (enableVisualSkill && templateSurveyContext) {
    sections.push(
      "=== PAGE TEMPLATE SURVEY (pre-fetched — do NOT call survey-page-templates) ===",
      templateSurveyContext,
      "Survey complete. Proceed: get-page-template(routes=[...]) in one call.",
      "=== END PAGE TEMPLATE SURVEY ==="
    );
  }

  if (enableVisualSkill && mockupGrounding?.available && mockupGrounding.promptBlock) {
    sections.push(mockupGrounding.promptBlock);
  }

  if (enableVisualSkill) {
    sections.push(
      "VISUAL MOCKUP OUTPUT — REQUIRED:",
      "Generate a complete, pixel-perfect, standalone HTML mockup that looks exactly like the real Manager Dashboard product.",
      "Derive every visual rule from the design language context above. Do NOT invent colors, spacing, or components.",
      "",
      "WRAP the full HTML in these exact markers — do not omit them:",
      "RAW_HTML_COMPONENT_START",
      "<!DOCTYPE html>",
      "...complete HTML...",
      "RAW_HTML_COMPONENT_END",
      "",
      "MOCKUP RULES:",
      "- ALL visual values (colors, fonts, heights, borders, radius, chip backgrounds, table/header/body text) come from the COMPONENT LIBRARY BASE CSS BLOCK above. Copy it verbatim and use its classes. Do NOT copy CSS numbers or hex values from design.md or invent your own.",
      "- Font: Source Sans Pro — self-hosted (use Google Fonts CDN fallback in standalone HTML). Body 14px.",
      "- Page structure top-to-bottom: white 56px top bar (logo + 'Manager Dashboard') → navy #101a5c 44px primary nav → optional white 38px sub-tabs → navy #101a5c 40px section banner → white filter bar → data table → pagination row.",
      "- Sort indicators = CSS triangles from the library, NEVER Unicode arrows or Material Icons.",
      "- Status chips: use the chip-* class whose bucket matches the status string. Never set chip background inline.",
      "- No Vue, no Quasar, no JS frameworks — pure HTML + CSS + minimal vanilla JS only.",
      "- Implement EVERY status, state-transition, field-visibility, and column from the Jira ticket.",
      "- CRITICAL: If find-related-context returned real column definitions, use THOSE exact columns — not invented ones.",
      "- If product screenshots are provided, match the exact visual patterns you observe in them."
    );
  }

  // This section MUST be last — the UI parser splits on this exact heading.
  if (!isExternal) {
    sections.push(
      "OUTPUT FORMAT — REQUIRED:",
      "After your analysis, append engineering effort estimation using this EXACT heading (it is machine-parsed, do not change it):",
      "",
      "### 📊 Engineering Effort Estimation Summary [TICKET_ID]",
      "Replace TICKET_ID with the actual ticket number. Then include:",
      "- **T-Shirt Size:** [S / M / L / XL based on complexity]",
      "- **Estimated Story Points:** [2 / 3 / 5 / 8 / 13] Points",
      "- **Breakdown Analysis:**",
      "  * [Affected layer or component]: [X] Days — [specific reason from ticket]",
      "  * (add as many lines as needed)",
      "- **Architecture Risk Factor:** [Low / Medium / High] — [one-sentence reason]",
      "",
      "Make the estimation SPECIFIC to this ticket — not generic. Derive sizing from actual scope described in the ticket."
    );
  } else {
    sections.push(
      "OUTPUT FORMAT — REQUIRED:",
      "Provide a clear product analysis followed by the HTML mockup markers.",
      "Do NOT include any engineering effort estimation section."
    );
  }

  return sections.join("\n\n");
}

// ── Rich Jira context type ────────────────────────────────────────────────────

interface JiraTicket {
  id: string;
  summary: string;
  description: string;
  metadata?: {
    status: string; priority: string; assignee: string;
    reporter: string; issueType: string; labels: string[]; storyPoints?: number;
  };
  comments?:     Array<{ author: string; body: string; created: string }>;
  subtasks?:     Array<{ id: string; summary: string; status: string; priority?: string }>;
  linkedIssues?: Array<{ id: string; summary: string; type: string; status: string }>;
  attachments?:  Array<{ filename: string; mimeType: string; size: number; content?: string }>;
  linkedUrls?:   Array<{ url: string; type: string; tool?: string; title?: string; content: string }>;
}

// Extracts MCP search keywords from raw ticket text.
// Returns a deduplicated list: domain terms first, then feature fragments.
function inferDomain(text: string): { keywords: string[] } {
  const lower = text.toLowerCase();

  const DOMAINS = ["outbound", "inbound", "inventory", "audit", "system", "analytics",
                   "resources", "shift", "notification", "process", "exception"];
  const FEATURES = ["listing", "order", "exception", "filter", "detail", "kpi",
                    "dashboard", "report", "summary", "tag", "change", "suborder",
                    "zone", "task", "alert", "scanner", "hardware", "status"];

  const hits: string[] = [];
  for (const d of DOMAINS)  { if (lower.includes(d))  hits.push(d); }
  for (const f of FEATURES) { if (lower.includes(f) && !hits.includes(f)) hits.push(f); }

  // Always include at least 2 keywords; fall back to first two words of the summary
  if (hits.length < 2) {
    text.split(/\s+/).slice(0, 4).forEach((w) => {
      const clean = w.replace(/[^a-z]/gi, "").toLowerCase();
      if (clean.length > 3 && !hits.includes(clean)) hits.push(clean);
    });
  }

  return { keywords: hits.slice(0, 6) };
}

function buildUserMessage(
  ticketId: string,
  jiraData: JiraTicket,
  additionalPmContext: string | undefined,
  attachedFiles?: UserAttachedFile[]
): string {
  const parts: string[] = [
    `Analyse ticket ${ticketId}: "${jiraData.summary}"`,
  ];

  if (jiraData.metadata) {
    const m = jiraData.metadata;
    const meta = [
      `Status: ${m.status}`, `Priority: ${m.priority}`, `Type: ${m.issueType}`,
      m.assignee !== "Unassigned" ? `Assignee: ${m.assignee}` : null,
      m.storyPoints ? `Existing estimate: ${m.storyPoints} SP` : null,
      m.labels.length ? `Labels: ${m.labels.join(", ")}` : null,
    ].filter(Boolean).join(" · ");
    parts.push(`\nMetadata: ${meta}`);
  }

  if (jiraData.description) {
    parts.push(`\n\nDescription:\n${jiraData.description.slice(0, 800)}${jiraData.description.length > 800 ? "\n[truncated]" : ""}`);
  }

  if (jiraData.subtasks?.length) {
    parts.push(`\n\nSubtasks (${jiraData.subtasks.length}):`);
    jiraData.subtasks.forEach((s) =>
      parts.push(`  • ${s.id} [${s.status}${s.priority ? ` · ${s.priority}` : ""}]: ${s.summary}`)
    );
  }

  if (jiraData.linkedIssues?.length) {
    parts.push(`\n\nLinked Issues:`);
    jiraData.linkedIssues.forEach((l) =>
      parts.push(`  • ${l.type} ${l.id} [${l.status}]: ${l.summary}`)
    );
  }

  if (jiraData.comments?.length) {
    parts.push(`\n\nComments (${jiraData.comments.length} total — most recent first):`);
    [...jiraData.comments].reverse().slice(0, 5).forEach((c) =>
      parts.push(`  [${c.created} · ${c.author}]: ${c.body.slice(0, 300)}${c.body.length > 300 ? "…" : ""}`)
    );
  }

  const textAttachments = jiraData.attachments?.filter((a) => a.content) ?? [];
  const otherAttachments = jiraData.attachments?.filter((a) => !a.content) ?? [];

  if (textAttachments.length) {
    parts.push(`\n\nAttachment Content:`);
    textAttachments.forEach((a) => {
      parts.push(`\n--- ${a.filename} ---\n${a.content?.slice(0, 1500)}${(a.content?.length ?? 0) > 1500 ? "\n[truncated]" : ""}`);
    });
  }

  if (otherAttachments.length) {
    parts.push(`\n\nOther Attachments (no text content): ${otherAttachments.map((a) => a.filename).join(", ")}`);
  }

  // ── Linked URLs (scraped from description + comments) ──────────────────────
  const fetchedUrls = jiraData.linkedUrls?.filter((u) => u.type !== "skip" && u.content) ?? [];
  if (fetchedUrls.length) {
    parts.push(`\n\nReferenced URLs (${fetchedUrls.length} links found in ticket — content fetched):`);
    fetchedUrls.forEach((lu) => {
      const header = lu.tool
        ? `[${lu.tool}] ${lu.url}`
        : lu.title
        ? `${lu.title} — ${lu.url} [${lu.type}]`
        : `${lu.url} [${lu.type}]`;
      parts.push(`\n--- ${header} ---\n${lu.content.slice(0, 2000)}${lu.content.length > 2000 ? "\n[truncated]" : ""}`);
    });
  }

  if (additionalPmContext) parts.push(`\n\nPM Notes: ${additionalPmContext}`);

  // ── User-attached files ────────────────────────────────────────────────────
  const textFiles   = attachedFiles?.filter((f) => f.contentType === "text")   ?? [];
  const htmlFiles   = attachedFiles?.filter((f) => f.contentType === "html")   ?? [];
  const imageFiles  = attachedFiles?.filter((f) => f.contentType === "image")  ?? [];
  const binaryFiles = attachedFiles?.filter((f) => f.contentType === "binary") ?? [];

  if (textFiles.length || htmlFiles.length) {
    const all = [...textFiles, ...htmlFiles];
    parts.push(`\n\n--- USER-ATTACHED FILES (${all.length}) ---`);
    all.forEach((f) => {
      const label = f.contentType === "html"
        ? `[${f.name} · HTML — full markup preserved for AI analysis]`
        : `[${f.name} · ${f.type}]`;
      parts.push(`\n${label}\n${f.content.slice(0, 12_000)}${f.content.length > 12_000 ? "\n[truncated]" : ""}`);
    });
    parts.push(`\n--- END ATTACHED FILES ---`);
  }
  if (imageFiles.length)  parts.push(`\n\nAttached images (not readable): ${imageFiles.map((f) => f.name).join(", ")}`);
  if (binaryFiles.length) parts.push(`\n\nOther attached files: ${binaryFiles.map((f) => f.name).join(", ")}`);

  return parts.join("");
}

// ── Refinement prompt helpers ─────────────────────────────────────────────────

function buildRefinementSystemPrompt(designContext = "", componentLibraryContext = ""): string {
  const base = `You are a UI refinement assistant for GreyOrange's Manager Dashboard. You will receive an existing HTML mockup and a refinement request. Return the COMPLETE updated HTML file — never return partial snippets.

IMPORTANT — WEB API MODE:
- You are running as a subprocess of a Next.js API route, NOT an interactive CLI session.
- This is a pure HTML-editing task. Do NOT call any tools. Do NOT read or follow any CLAUDE.md files.
- Do NOT call Atlassian, MCP, codebase, or filesystem tools. Do NOT ask the user to run /mcp or authenticate.
- The full HTML to edit is provided in the user message. Edit it directly and return it — nothing else is needed.
- Your FIRST and ONLY action is to output the complete updated HTML wrapped in the required markers.`;

  const parts: string[] = [base];
  if (designContext) {
    parts.push(
      "=== DESIGN LANGUAGE RULES (from design.md) ===",
      designContext,
      "=== END DESIGN LANGUAGE ==="
    );
  }
  if (componentLibraryContext) {
    parts.push(
      "=== COMPONENT LIBRARY (component-library.md) ===",
      componentLibraryContext,
      "=== END COMPONENT LIBRARY ===",
      "",
      "MANDATORY COMPONENT LIBRARY RULES:",
      "0. PRECEDENCE: The BASE CSS BLOCK is authoritative. Where the current HTML or design.md disagrees with the library on any value, conform the HTML to the library.",
      "1. The BASE CSS BLOCK must be present verbatim in <style>. If missing or altered, replace it with the verbatim block.",
      "2. Correct any deviation from BASE CSS BLOCK values (wrong heights, colors, border-radius, chip backgrounds, header/body text colors).",
      "3. Replace any Unicode sort indicators (▲▼) with the CSS triangle pattern from the BASE CSS BLOCK.",
      "4. Status chips must use the chip-* class whose bucket matches the status — never solid Quasar tokens or inline backgrounds.",
      "5. Apply ONLY the change in the refinement request; preserve all other existing markup and data verbatim."
    );
  }
  parts.push(
    "REQUIRED OUTPUT: Wrap the complete HTML in these exact markers (do not omit):",
    "RAW_HTML_COMPONENT_START",
    "<!DOCTYPE html>...complete updated HTML...",
    "RAW_HTML_COMPONENT_END",
    "Preserve everything not mentioned in the refinement request. Return the full document."
  );
  return parts.join("\n\n");
}

function buildRefinementUserMessage(
  currentHtml: string,
  request?: string,
  attachedFiles?: UserAttachedFile[],
): string {
  const parts: string[] = [
    "Current HTML mockup to refine:",
    "",
    "RAW_HTML_COMPONENT_START",
    currentHtml,
    "RAW_HTML_COMPONENT_END",
    "",
    `Refinement request: ${request || "Improve the mockup quality and visual fidelity."}`,
  ];

  if (attachedFiles?.length) {
    const textFiles  = attachedFiles.filter((f) => f.contentType === "text" || f.contentType === "html");
    const imageFiles = attachedFiles.filter((f) => f.contentType === "image");

    if (textFiles.length) {
      parts.push("", `--- ATTACHED FILES (${textFiles.length}) ---`);
      textFiles.forEach((f) => {
        const label = f.contentType === "html" ? `[${f.name} · HTML]` : `[${f.name}]`;
        parts.push(`\n${label}\n${f.content.slice(0, 12_000)}${f.content.length > 12_000 ? "\n[truncated]" : ""}`);
      });
      parts.push("--- END ATTACHED FILES ---");
    }

    if (imageFiles.length) {
      // Browser reads images as placeholder strings — actual pixels aren't available in this flow.
      // Acknowledge them so Claude knows visual context was intended.
      parts.push(
        "",
        `Attached reference image(s): ${imageFiles.map((f) => f.name).join(", ")}`,
        "Note: image content is not readable in this mode. Apply the refinement request using standard Manager Dashboard design patterns.",
      );
    }
  }

  parts.push("", "Return the complete updated HTML wrapped in RAW_HTML_COMPONENT_START / RAW_HTML_COMPONENT_END.");
  return parts.join("\n");
}

// ── Provider: Claude Code (local CLI subprocess) ──────────────────────────────
// Spawns `claude --print --output-format stream-json` as a child process.
// ── MCP server health check ───────────────────────────────────────────────────

/** Returns true when the persistent HTTP MCP server responds to /health. */
function isMcpServerReady(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpRequest(MCP_HEALTH_URL, { method: "GET", timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}

// The system prompt is written to a temp file to avoid argument-length limits.
// Output is newline-delimited JSON; we extract text from assistant messages.

function streamClaudeCode(
  model: string,
  ticketId: string,
  jiraData: JiraTicket,
  additionalPmContext: string | undefined,
  enableVisualSkill: boolean,
  archContext: string,
  designContext: string,
  sitemapContext: string,
  attachedFiles?: UserAttachedFile[],
  isRefinement = false,
  currentHtml?: string,
  componentLibraryContext = "",
  templateSurveyContext = "",
  mockupGrounding: MockupGrounding | null = null,
  userRole: "external" | "internal" = "internal",
): Response {
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      const logger  = new SessionLogger(ticketId, "claude-code", model);
      const tmpFile = join(tmpdir(), `claude-sysprompt-${Date.now()}.txt`);
      const mcpConfigFile = join(tmpdir(), `md-mcp-config-${Date.now()}.json`);
      const designOutputDir = join(homedir(), "claude-ui-designs");

      try {
        send({ thinking: "Starting Claude Code local session…" });

        mkdirSync(designOutputDir, { recursive: true });

        // ── Step 1: build prompts ────────────────────────────────────────
        logger.beginStep();
        let systemPrompt: string;
        let userMessage:  string;

        if (isRefinement && currentHtml) {
          // Strip injected CSS before sending to Claude — it gets re-injected after
          const htmlForRefinement = stripInjectedCaptureCss(currentHtml);
          systemPrompt = buildRefinementSystemPrompt(designContext, componentLibraryContext);
          userMessage  = buildRefinementUserMessage(htmlForRefinement, additionalPmContext, attachedFiles);
        } else {
          // Initial generation: full context + visual skill instructions + MCP code tools
          systemPrompt = buildSystemPrompt(enableVisualSkill, archContext, designContext, sitemapContext, true, componentLibraryContext, templateSurveyContext, mockupGrounding, userRole);
          userMessage  = buildUserMessage(ticketId, jiraData, additionalPmContext, attachedFiles);

          const ticketText = jiraData.summary + " " + (jiraData.description ?? "");
          const domain = inferDomain(ticketText);
          const routeHints = formatRouteHints(ticketText);

          // Prepend first-action directive — highest-priority signal in the human turn.
          const hasCaptures = mockupGrounding?.available ?? false;
          userMessage = [
            hasCaptures
              ? `FIRST ACTION: Call mcp__md__get-page-template with routes suggested by the PAGE TEMPLATE SURVEY in the system prompt.`
              : `FIRST ACTION REQUIRED: Call mcp__md__find-related-context NOW with keywords from this ticket.`,
            hasCaptures && routeHints ? routeHints : `Suggested keywords: ${domain.keywords.join(", ")}`,
            `Do NOT use the Read tool on ${MD_REPO_ROOT}. Use MCP tools only.`,
            ``,
            userMessage,
          ].join("\n");

          if (enableVisualSkill) {
            const screenshots = listProductScreenshots();
            const screenshotNote = screenshots.length
              ? `\n\nProduct screenshots for reference (read these with the Read tool to match the actual UI):\n${screenshots.map((f) => screenshotPath(f)).join("\n")}`
              : "";
            userMessage += `${screenshotNote}\n\nOUTPUT: Include the complete HTML mockup inline in your response, wrapped in these exact markers:\nRAW_HTML_COMPONENT_START\n<!DOCTYPE html>...full HTML...\nRAW_HTML_COMPONENT_END`;
          }
        }

        const sysT  = charsToTokens(systemPrompt.length);
        const userT = charsToTokens(userMessage.length);
        logger.record("Prompt construction", { inputTokens: sysT + userT, detail: `sys ~${sysT} tok · user ~${userT} tok (estimated)` });

        writeFileSync(tmpFile, systemPrompt, "utf8");

        // ── Write MCP config pointing to the persistent HTTP server ──────
        // Falls back to spawning the stdio server if the HTTP server isn't running.
        const mcpServerReady = !isRefinement && await checkMcpServerReady();

        // Snapshot prompts + context into the logger for the JSON debug log.
        logger.setRequestContext({
          systemPrompt,
          userMessage,
          mcpTransport:      isRefinement ? "none" : mcpServerReady ? "http" : "stdio",
          capturesAvailable: mockupGrounding?.available ?? false,
          captureLabel:      mockupGrounding?.label     ?? "",
          isRefinement:      isRefinement ?? false,
        });

        const mcpConfig = mcpServerReady
          ? { mcpServers: { md: { type: "http", url: MCP_SERVER_URL } } }
          : {
              mcpServers: {
                md: {
                  command: "npx",
                  args: ["tsx", join(process.cwd(), "src/md-mcp-server.ts")],
                  env: { MD_REPO_ROOT },
                },
              },
            };
        writeFileSync(mcpConfigFile, JSON.stringify(mcpConfig), "utf8");

        if (!isRefinement) {
          send({ thinking: mcpServerReady ? "MCP server ready (HTTP)" : "MCP server: starting stdio fallback…" });
        }

        // ── Step 2: model inference ──────────────────────────────────────
        logger.beginStep();
        const thinkingStart = Date.now();
        send({ thinking: `Analysing ticket with model ${model}…` });

        // Refinement is a pure HTML-edit task — no codebase tools, no MCP server.
        // Initial generation needs the manager-dashboard MCP code tools.
        const allowedTools = isRefinement
          ? "Read"
          : ["Write", "Read", ...MD_MCP_TOOLS].join(",");

        const spawnArgs = [
          "--print",
          "--output-format", "stream-json",
          "--verbose",
          // "--model", "claude-haiku-4-5",
          "--model", model,
          "--system-prompt-file", tmpFile,
          // MCP code server is only useful for initial generation.
          ...(isRefinement ? [] : ["--mcp-config", mcpConfigFile]),
          // "--max-budget-usd", "2",
          "--allowedTools", allowedTools,
        ];

        const proc = spawn("claude", spawnArgs, { stdio: ["pipe", "pipe", "pipe"] });

        proc.stdin.write(userMessage, "utf8");
        proc.stdin.end();

        let buf = "";
        let allText = "";
        const savedFiles: string[] = [];
        let inferenceInputTokens  = 0;
        let inferenceOutputTokens = 0;
        let inferenceCostUsd      = 0;

        proc.stdout.on("data", (chunk: Buffer) => {
          buf += chunk.toString("utf8");
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg: Record<string, unknown> = JSON.parse(line);

              if (msg.type === "result") {
                const usage = msg.usage as Record<string, number> | undefined;
                if (usage) {
                  inferenceInputTokens  = usage.input_tokens  ?? 0;
                  inferenceOutputTokens = usage.output_tokens ?? 0;
                }
                if (typeof msg.cost_usd === "number") inferenceCostUsd = msg.cost_usd;
              }

              if (msg.type === "assistant") {
                const content = (msg.message as Record<string, unknown>)?.content as Array<{
                  type: string;
                  text?: string;
                  thinking?: string;
                  name?: string;
                  input?: Record<string, unknown>;
                }> | undefined;

                if (content?.length) {
                  const thinkBlocks   = content.filter((b) => b.type === "thinking" && b.thinking);
                  const toolUseBlocks = content.filter((b) => b.type === "tool_use");
                  const textBlocks    = content.filter((b) => b.type === "text" && b.text);

                  for (const b of thinkBlocks) {
                    if (b.thinking) {
                      const snippet = b.thinking.slice(0, 120).replace(/\n/g, " ");
                      logger.recordThinking(snippet);
                      send({ thinking: `Thinking: ${snippet}${b.thinking.length > 120 ? "…" : ""}` });
                    }
                  }

                  for (const b of toolUseBlocks) {
                    // Log every tool call for debugging
                    logger.recordToolCall(b.name ?? "unknown", b.input ?? {});

                    if (b.name === "Write") {
                      const filePath = b.input?.file_path as string | undefined;
                      if (filePath) {
                        savedFiles.push(filePath);
                        send({ thinking: `Writing file: ${filePath}` });
                      }
                    } else if (b.name?.startsWith("mcp__")) {
                      // Surface MCP tool calls to the UI as thinking messages
                      const toolShort = b.name.replace("mcp__md__", "");
                      const inputSummary = Object.entries(b.input ?? {})
                        .map(([k, v]) => `${k}=${Array.isArray(v) ? `[${(v as string[]).slice(0, 3).join(",")}]` : String(v).slice(0, 60)}`)
                        .join(", ");
                      send({ thinking: `Tool: ${toolShort}(${inputSummary})` });
                    }
                  }

                  // Accumulate all text — we extract HTML from markers at the end
                  for (const block of textBlocks) {
                    if (block.text) allText += block.text;
                  }
                }
              }
            } catch { /* skip malformed lines */ }
          }
        });

        let stderrBuf = "";
        proc.stderr.on("data", (chunk: Buffer) => { stderrBuf += chunk.toString(); });

        const exitCode = await new Promise<number | null>((resolve, reject) => {
          proc.on("close", resolve);
          proc.on("error", reject);
        });

        // ── Fallback: calculate cost from tokens if not provided ────────────
        if (inferenceCostUsd === 0 && (inferenceInputTokens || inferenceOutputTokens)) {
          inferenceCostUsd = tokenCost(model, inferenceInputTokens, inferenceOutputTokens);
        }

        logger.record("Model inference (claude-code CLI)", {
          inputTokens:  inferenceInputTokens,
          outputTokens: inferenceOutputTokens,
          costUsd:      inferenceCostUsd > 0 ? inferenceCostUsd : undefined,
          detail:       `exit ${exitCode ?? 0}`,
        });

        send({ thinkingDone: true, elapsed: (Date.now() - thinkingStart) / 1000 });

        if (exitCode !== 0 && exitCode !== null) {
          send({ error: `Claude Code exited with code ${exitCode}. ${stderrBuf.slice(0, 400)}` });
        } else {
          // ── Step 3: emit accumulated text and extract inline HTML ─────
          let htmlSizeBytes = 0;
          let htmlExtracted = false;
          if (allText) {
            const textForDisplay = userRole === "external" ? stripEffortEstimation(allText) : allText;
            const { displayText, html } = extractHtmlFromMarkers(textForDisplay);
            if (displayText) send({ delta: displayText });
            if (html) {
              htmlExtracted = true;
              let finalHtml = html;
              if (mockupGrounding?.available && mockupGrounding.cssText) {
                finalHtml = injectGroundingIntoHtml(finalHtml, mockupGrounding.cssText);
                send({ thinking: `✓ Injected captured Quasar CSS bundle (${mockupGrounding.cssBundleId}) into mockup.` });
                logger.record("Injected captured Quasar CSS into mockup", { detail: mockupGrounding.cssBundleId });
              }
              htmlSizeBytes = Buffer.byteLength(finalHtml, "utf8");
              logger.record("HTML mockup extracted from response", { detail: `${(htmlSizeBytes / 1024).toFixed(1)} KB` });
              send({ html: finalHtml });
            }
          }

          // ── Step 4: write session log ──────────────────────────────────
          const { logFile, logData } = logger.finish({
            responseText:  allText,
            htmlExtracted,
            htmlSizeBytes,
            exitCode:      exitCode,
            stderr:        stderrBuf,
          });
          send({
            done: true, provider: "claude-code", model,
            savedFiles: savedFiles.length ? savedFiles : undefined,
            logFile, logData,
            inputTokens:  inferenceInputTokens,
            outputTokens: inferenceOutputTokens,
            costUsd:      inferenceCostUsd,
          });
        }

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        logger.finish({ error: errMsg });
        send({ error: `Claude Code error: ${errMsg}` });
      } finally {
        controller.close();
        try { unlinkSync(tmpFile); } catch { /* best-effort cleanup */ }
        try { unlinkSync(mcpConfigFile); } catch { /* best-effort cleanup */ }
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const body: ChatRequest = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });

  const {
    jiraTicketId, jiraData, additionalPmContext, enableVisualSkill,
    model, attachedFiles, isRefinement, currentHtml, userRole = "internal",
  } = body;

  let archContext = "", designContext = "", sitemapContext = "", componentLibraryContext = "";
  try {
    const ctx = await getCachedContext();
    if (isRefinement) {
      // Refinements are pure HTML edits — the HTML already embeds all styles.
      // Skip design.md entirely (~54 KB / ~13 k tokens saved).
      // Pass only the BASE CSS BLOCK from the component library (section 1, ~15 KB)
      // so Claude knows the authoritative CSS values; skip section 2 HTML snippets
      // (~17 KB) which are only useful when generating new HTML from scratch.
      componentLibraryContext = extractBaseCssBlock(ctx.componentLibrary);
    } else {
      archContext              = ctx.architecture;
      designContext            = ctx.design;
      sitemapContext           = ctx.sitemap;
      componentLibraryContext  = ctx.componentLibrary;
    }
  } catch { /* proceed without context if files are missing */ }

  // ── Pre-fetch capture grounding + template survey (sync filesystem reads) ──
  let mockupGrounding: MockupGrounding | null = null;
  let templateSurveyContext = "";
  if (enableVisualSkill && !isRefinement) {
    try {
      const grounding = buildMockupGrounding();
      if (grounding.available) mockupGrounding = grounding;
    } catch { /* no captures yet — gracefully skip */ }

    try {
      const label = resolveCaptureLabel();
      if (label) templateSurveyContext = surveyPageTemplates(label);
    } catch { /* no templates yet — Claude will call survey-page-templates via MCP */ }
  }

  const activeModel = model ?? "claude-haiku-4-5-20251001";
  return streamClaudeCode(
    activeModel, jiraTicketId, jiraData, additionalPmContext,
    enableVisualSkill, archContext, designContext, sitemapContext,
    attachedFiles, isRefinement, currentHtml, componentLibraryContext,
    templateSurveyContext, mockupGrounding, userRole,
  );
}
