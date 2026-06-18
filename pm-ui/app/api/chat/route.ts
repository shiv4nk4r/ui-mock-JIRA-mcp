import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";
import {
  fetchContextResources,
  fetchBrandIconCatalog,
  fetchComponentCatalog,
  fetchCapturedPageCatalog,
  fetchRenderedComponentCatalog,
  validateUiReferences,
  listProductScreenshots,
  screenshotPath,
  claudeMcpConfigArg,
  claudeMcpAllowedToolsPattern,
  checkMcpServerHealth,
  getMcpServerUrl,
} from "@/mcp-client";
import type { UiReferenceValidation } from "@/mcp-client";
import { WORKSPACE_ROOT } from "@/paths";
import { buildMockupGrounding, injectGroundingIntoHtml, prepareInitialMockupHtml, wrapBaseTemplate, type MockupGrounding } from "@/capture-grounding";

export const dynamic = "force-dynamic";

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

const SESSION_LOG_DIR = join(homedir(), "claude-ui-designs", "logs");

class SessionLogger {
  readonly sessionId: string;
  readonly ticketId:  string;
  readonly provider:  string;
  readonly model:     string;
  readonly startTs:   number;
  readonly logFile:   string;

  private steps: LogStep[] = [];
  private stepStart = 0;

  constructor(ticketId: string, provider: string, model: string) {
    this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.ticketId  = ticketId;
    this.provider  = provider;
    this.model     = model;
    this.startTs   = Date.now();
    mkdirSync(SESSION_LOG_DIR, { recursive: true });
    this.logFile   = join(SESSION_LOG_DIR, `${ticketId}-${this.sessionId}.log.md`);
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

  finish(): { logFile: string; logData: string } {
    const totalMs   = Date.now() - this.startTs;
    const totalIn   = this.steps.reduce((s, r) => s + r.inputTokens,  0);
    const totalOut  = this.steps.reduce((s, r) => s + r.outputTokens, 0);
    const totalCost = this.steps.reduce((s, r) => s + r.costUsd,      0);
    const pricing   = TOKEN_PRICING[this.model]
      ? `$${TOKEN_PRICING[this.model][0]}/M in · $${TOKEN_PRICING[this.model][1]}/M out`
      : "pricing unknown — conservative fallback $1/$5 per M";

    const rows = this.steps.map((r, i) => {
      const inT  = r.inputTokens  ? r.inputTokens.toLocaleString()  : "—";
      const outT = r.outputTokens ? r.outputTokens.toLocaleString() : "—";
      const cost = r.costUsd > 0  ? `$${r.costUsd.toFixed(6)}`      : "—";
      return `| ${i + 1} | ${r.step}${r.detail ? ` · ${r.detail}` : ""} | ${r.durationMs}ms | ${inT} | ${outT} | ${cost} |`;
    }).join("\n");

    const logData = `# Session Log: ${this.ticketId}

**Session ID:** ${this.sessionId}
**Provider:** ${this.provider}
**Model:** ${this.model} (${pricing})
**Started:** ${new Date(this.startTs).toISOString()}
**Log file:** ${this.logFile}

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
`;

    writeFileSync(this.logFile, logData, "utf8");
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
}




// ── HTML marker extraction ────────────────────────────────────────────────────

const HTML_MARKER_START = "RAW_HTML_COMPONENT_START";
const HTML_MARKER_END   = "RAW_HTML_COMPONENT_END";

const MANIFEST_MARKER_START = "REUSE_MANIFEST_START";
const MANIFEST_MARKER_END   = "REUSE_MANIFEST_END";

export interface ReuseManifest {
  reusedComponents: string[];
  reusedIcons: string[];
  newComponents: Array<{ name: string; reason: string }>;
  newIcons: Array<{ name: string; reason: string }>;
}

const EMPTY_MANIFEST: ReuseManifest = {
  reusedComponents: [],
  reusedIcons: [],
  newComponents: [],
  newIcons: [],
};

function extractHtmlFromMarkers(text: string): { displayText: string; html: string | undefined } {
  const si = text.indexOf(HTML_MARKER_START);
  const ei = text.indexOf(HTML_MARKER_END);
  if (si === -1 || ei === -1 || ei <= si) return { displayText: text, html: undefined };
  const html        = text.slice(si + HTML_MARKER_START.length, ei).trim();
  const displayText = (text.slice(0, si) + text.slice(ei + HTML_MARKER_END.length)).trim();
  return { displayText, html };
}

/** Pull the reuse manifest JSON block out of the model output (tolerant). */
function extractManifest(text: string): { manifest: ReuseManifest | null; displayText: string } {
  const si = text.indexOf(MANIFEST_MARKER_START);
  const ei = text.indexOf(MANIFEST_MARKER_END);
  if (si === -1 || ei === -1 || ei <= si) return { manifest: null, displayText: text };
  const raw = text.slice(si + MANIFEST_MARKER_START.length, ei).trim();
  const displayText = (text.slice(0, si) + text.slice(ei + MANIFEST_MARKER_END.length)).trim();
  try {
    const parsed = JSON.parse(raw) as Partial<ReuseManifest>;
    return {
      manifest: {
        reusedComponents: parsed.reusedComponents ?? [],
        reusedIcons: parsed.reusedIcons ?? [],
        newComponents: parsed.newComponents ?? [],
        newIcons: parsed.newIcons ?? [],
      },
      displayText,
    };
  } catch {
    return { manifest: null, displayText };
  }
}

const MANIFEST_CONTRACT = [
  "REUSE MANIFEST — REQUIRED. Before the HTML, emit a manifest listing every existing asset you reused and any genuinely new ones:",
  MANIFEST_MARKER_START,
  JSON.stringify(
    {
      reusedComponents: ["mdui/src/components/<path>.vue"],
      reusedIcons: ["/icons/<path>.png"],
      newComponents: [{ name: "NewThing", reason: "no existing component covers X" }],
      newIcons: [{ name: "new-icon", reason: "no existing asset for Y" }],
    },
    null,
    2
  ),
  MANIFEST_MARKER_END,
  "Rules: reusedComponents/reusedIcons MUST exist in the codebase (you verified them via list-reusable-components / get-component-source / list-brand-icons). Anything you could not find an existing match for goes under newComponents/newIcons with a one-line reason. Do NOT silently invent — declare it.",
].join("\n");

const CAPTURE_TABLE_RULES = [
  "- Tables: MUST use captured q-table structure (class=\"q-table\", q-td, q-th, q-checkbox, …). DO NOT hand-write table CSS.",
  "- Modals: use captured q-dialog structure when building dialogs.",
  "- Quasar CSS is auto-injected — do NOT add <style> rules for .q-table / .q-td / .q-btn.",
].join("\n");

const HAND_WRITTEN_TABLE_RULES = [
  "- Table rows: 40px height, sort indicators = CSS triangles (▲▼), NOT Material Icons",
  "- Action buttons: 26×26px, 3px border-radius, outline style — use /icons/ assets via get-brand-icon",
].join("\n");

function visualWorkflowInstruction(grounding: MockupGrounding | null): string {
  const hasTemplate = Boolean(grounding?.templateHtml?.trim());
  if (hasTemplate) {
    return [
      "WORKFLOW (required, in order):",
      "1) Edit the COMPLETE BASE TEMPLATE above — it is a full captured page with real layout, nav, sub-tabs, filter bar, table rows, and sample data.",
      "2) Preserve all placement and Quasar classes; only change visible text/labels/cell values for the Jira ticket.",
      "3) list-brand-icons + get-brand-icon for every icon (data-uri <img> in action columns).",
      "DO NOT rebuild the page from scratch. DO NOT hand-write table CSS.",
    ].join(" ");
  }
  if (grounding?.available) {
    return [
      "WORKFLOW (required, in order):",
      "1) Use captured Quasar class names from the grounding block.",
      "2) list-brand-icons + get-brand-icon for every icon.",
      "3) list-reusable-components + get-component-source for additional markup.",
      "DO NOT hand-write table CSS. DO NOT use plain <table> with custom styles.",
    ].join(" ");
  }
  return [
    "WORKFLOW (required, in order):",
    "1) list-captured-pages + get-captured-page OR list-rendered-components + get-rendered-component.",
    "2) list-reusable-components + get-component-source for markup/CSS.",
    "3) list-brand-icons + get-brand-icon for every icon.",
    "DO NOT invent components, classes, or icons.",
  ].join(" ");
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
  brandIconsContext = "",
  componentCatalogContext = "",
  renderedCaptureContext = "",
  mockupGrounding: MockupGrounding | null = null
): string {
  const base = `You are a senior product engineering assistant for GreyOrange's Manager Dashboard warehouse system (Vue 2 + Quasar 1.20.1 frontend, Apollo GraphQL BFF). Analyse Jira tickets and produce structured requirement analyses with effort estimations. Keep responses concise and actionable.`;

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

  if (enableVisualSkill) {
    const hasTemplate = Boolean(mockupGrounding?.templateHtml?.trim());
    const hasGrounding = Boolean(mockupGrounding?.available);

    sections.push(
      "VISUAL MOCKUP OUTPUT — REQUIRED:",
      hasTemplate
        ? "Edit the captured Manager Dashboard page template provided in the USER message (BASE_TEMPLATE_START/END). Return the complete updated HTML document."
        : "Generate a complete, pixel-perfect, standalone HTML mockup that looks exactly like the real Manager Dashboard product.",
      hasTemplate
        ? "Captured Quasar CSS is AUTO-INJECTED server-side — preserve all structure/classes from the base template; only change visible content for the Jira ticket."
        : hasGrounding
          ? "Captured Quasar CSS from the live app is AUTO-INJECTED server-side — use real q-table/q-dialog class names from the grounding block below."
          : "Derive every visual rule from the design language context above. Do NOT invent colors, spacing, or components.",
      "",
      ...(hasTemplate
        ? [
            "TEMPLATE EDIT POLICY — MANDATORY:",
            "- The BASE_TEMPLATE is a real captured page DOM — keep layout, nav, sub-tabs, filter bar, and table markup intact.",
            "- Only change visible TEXT: cell values, headers, labels, status chips, stat counts, button labels.",
            "- Add modals only if the ticket requires them (use q-dialog reference in grounding block).",
            "- DO NOT hand-write table CSS or replace q-table with plain <table>.",
            CAPTURE_TABLE_RULES,
            "",
          ]
        : hasGrounding
          ? [
              "RENDERED CAPTURE POLICY — MANDATORY:",
              "- Real rendered q-table / q-dialog HTML is provided below. Copy structure and classes VERBATIM.",
              "- Only change cell TEXT and labels to match the Jira ticket scenario.",
              "- DO NOT hand-write table CSS, row heights, or sort-indicator styles.",
              "- DO NOT replace q-table with a plain <table> and custom CSS.",
              CAPTURE_TABLE_RULES,
              "",
            ]
          : [
              "RENDERED CAPTURE POLICY — HIGHEST FIDELITY:",
              "- Call list-captured-pages, then get-captured-page(route) or get-rendered-component(id).",
              "- Reuse rendered HTML structure/classes. CSS bundle URL is for reference — server injects CSS when captures exist.",
              "",
            ]),
      "COMPONENT REUSE POLICY — for parts NOT covered by captures:",
      "- Call list-reusable-components(keywords) then get-component-source(name) for additional markup.",
      "- Only create new structures when no capture AND no existing component fits — declare in manifest.",
      "- NEVER hallucinate components, props, classes, or icons.",
      "",
      "ICON POLICY — STRICT:",
      "- Use ONLY official icons from mdui/public/ via list-brand-icons and get-brand-icon.",
      "- Mockups run in iframe srcDoc — use get-brand-icon data-uri <img> tags (relative /icons/ paths break).",
      "",
      "WRAP the full HTML in these exact markers — do not omit them:",
      "RAW_HTML_COMPONENT_START",
      "<!DOCTYPE html>",
      "...complete HTML...",
      "RAW_HTML_COMPONENT_END",
      "",
      "MOCKUP RULES:",
      "- Colors: primary #101a5c, secondary #FE8400, positive #66bb6a, negative #ED3324, info #2982cc, warning #f9b115",
      "- Font: Source Sans Pro (Google Fonts). Body 13px.",
      "- Top bar: white bg, 52px sticky — get-brand-icon for logos from /logos/",
      "- Primary nav: #101a5c bg, 42px, orange 2px bottom-border on active tab",
      "- Sub-tabs: white bg, 38px, orange underline on active",
      "- Section banner: #101a5c bg, white text, colored dot + label + count per stat",
      "- Filter bar: '≡ Filter' with text label (not icon-only)",
      ...(hasTemplate || hasGrounding ? [CAPTURE_TABLE_RULES] : [HAND_WRITTEN_TABLE_RULES]),
      "- Modals: #101a5c header, white body, backdrop rgba(16,26,92,0.38)",
      "- Pagination: < 1 2 3 … N > with ellipsis",
      "- Pure HTML + minimal vanilla JS only — use Quasar class names from captures",
      "- Implement EVERY status chip and field-visibility rule from the Jira ticket"
    );

    if (hasGrounding && mockupGrounding?.promptBlock) {
      sections.push(mockupGrounding.promptBlock);
    }

    if (componentCatalogContext) {
      sections.push(
        "=== EXISTING REUSABLE COMPONENTS (mdui components/ + pages/ via MCP) ===",
        componentCatalogContext,
        "Call get-component-source on any of these to obtain the real markup + CSS to reuse.",
        "=== END EXISTING COMPONENTS ==="
      );
    }

    if (renderedCaptureContext) {
      sections.push(
        "=== REAL RENDERED CAPTURES (live-app DOM + CSS via MCP crawler) ===",
        renderedCaptureContext,
        "Call get-captured-page(route) / get-rendered-component(id) for the real rendered HTML + CSS bundle URL.",
        "=== END RENDERED CAPTURES ==="
      );
    }

    if (brandIconsContext) {
      sections.push(
        "=== OFFICIAL BRAND ICONS CATALOG (mdui/public/ via MCP) ===",
        brandIconsContext,
        "=== END BRAND ICONS ==="
      );
    }

    sections.push(MANIFEST_CONTRACT);
  }

  // This section MUST be last — the UI parser splits on this exact heading.
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

function buildRefinementSystemPrompt(
  designContext = "",
  brandIconsContext = "",
  componentCatalogContext = "",
  mockupGrounding: MockupGrounding | null = null
): string {
  const hasGrounding = Boolean(mockupGrounding?.available);
  const base = `You are a UI refinement assistant for GreyOrange's Manager Dashboard. You will receive an existing HTML mockup and a refinement request. Return the COMPLETE updated HTML file — never return partial snippets.

${mockupGrounding?.templateHtml ? "Captured page template grounding is active — preserve structure from the grounding block. DO NOT hand-write table CSS." : hasGrounding ? "Captured Quasar CSS is AUTO-INJECTED — keep q-table/q-dialog class names from the grounding block. DO NOT hand-write table CSS." : "Reuse existing Vue components via list-reusable-components + get-component-source."}
ICON POLICY: Use ONLY official icons via list-brand-icons and get-brand-icon (data-uri img tags).`;

  const parts: string[] = [base];
  if (designContext) {
    parts.push(
      "=== DESIGN LANGUAGE RULES (from design.md) ===",
      designContext,
      "=== END DESIGN LANGUAGE ==="
    );
  }
  if (hasGrounding && mockupGrounding?.promptBlock) {
    parts.push(mockupGrounding.promptBlock);
  }
  if (mockupGrounding?.analysisSummary && !mockupGrounding.promptBlock) {
    parts.push(mockupGrounding.analysisSummary);
  }
  if (componentCatalogContext) {
    parts.push(
      "=== EXISTING REUSABLE COMPONENTS (via MCP) ===",
      componentCatalogContext,
      "=== END EXISTING COMPONENTS ==="
    );
  }
  if (brandIconsContext) {
    parts.push(
      "=== OFFICIAL BRAND ICONS (mdui/public/) ===",
      brandIconsContext,
      "=== END BRAND ICONS ==="
    );
  }
  parts.push(MANIFEST_CONTRACT);
  parts.push(
    "REQUIRED OUTPUT: Wrap the complete HTML in these exact markers (do not omit):",
    "RAW_HTML_COMPONENT_START",
    "<!DOCTYPE html>...complete updated HTML...",
    "RAW_HTML_COMPONENT_END",
    "Preserve everything not mentioned in the refinement request. Return the full document."
  );
  return parts.join("\n\n");
}

function buildRefinementUserMessage(currentHtml: string, request?: string): string {
  return [
    "Current HTML mockup to refine:",
    "",
    "RAW_HTML_COMPONENT_START",
    currentHtml,
    "RAW_HTML_COMPONENT_END",
    "",
    `Refinement request: ${request || "Improve the mockup quality and visual fidelity."}`,
    "",
    "Return the complete updated HTML wrapped in RAW_HTML_COMPONENT_START / RAW_HTML_COMPONENT_END plus an updated REUSE_MANIFEST_START / REUSE_MANIFEST_END.",
  ].join("\n");
}

/** Correction message after verification finds hallucinated references. */
function buildCorrectionUserMessage(
  currentHtml: string,
  validation: UiReferenceValidation,
  hasGrounding = false,
  hasTemplate = false,
): string {
  const lines: string[] = [
    "Your previous mockup referenced components/icons that DO NOT exist in the codebase.",
    "Fix EVERY one of them: either swap in a real existing asset, or move it under newComponents/newIcons in the manifest with a one-line reason.",
    "",
  ];

  if (hasGrounding) {
    lines.push(
      hasTemplate
        ? "CAPTURED PAGE TEMPLATE grounding is active — preserve q-table/q-dialog class structure from the system prompt and existing mockup."
        : "RENDERED CAPTURE GROUNDING is active — keep q-table/q-dialog class structure from the system prompt.",
      "DO NOT hand-write table CSS; Quasar styles are auto-injected server-side.",
      "",
    );
  }

  if (validation.unknownComponents.length) {
    lines.push("Unknown components (call list-reusable-components / get-component-source to find the real one):");
    for (const c of validation.unknownComponents) {
      lines.push(
        `  - ${c.ref}${c.suggestions?.length ? ` → try: ${c.suggestions.join(", ")}` : " → no close match; likely needs newComponents"}`,
      );
    }
    lines.push("");
  }

  if (validation.unknownIcons.length) {
    lines.push("Unknown icons (call list-brand-icons / get-brand-icon for valid paths):");
    for (const c of validation.unknownIcons) {
      lines.push(
        `  - ${c.ref}${c.suggestions?.length ? ` → try: ${c.suggestions.join(", ")}` : " → no close match; likely needs newIcons"}`,
      );
    }
    lines.push("");
  }

  lines.push(
    "Current mockup to correct:",
    "RAW_HTML_COMPONENT_START",
    currentHtml,
    "RAW_HTML_COMPONENT_END",
    "",
    "Return the COMPLETE corrected HTML wrapped in RAW_HTML_COMPONENT_START / RAW_HTML_COMPONENT_END and an updated REUSE_MANIFEST_START / REUSE_MANIFEST_END. Every reusedComponents/reusedIcons entry MUST exist in the codebase.",
  );

  return lines.join("\n");
}

// ── Provider: Claude Code (local CLI subprocess) ──────────────────────────────
// Spawns `claude --print --output-format stream-json` as a child process.
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
  brandIconsContext: string,
  componentCatalogContext: string,
  renderedCaptureContext: string,
  mockupGrounding: MockupGrounding | null,
  attachedFiles?: UserAttachedFile[],
  isRefinement = false,
  currentHtml?: string,
): Response {
  const encoder = new TextEncoder();
  const MAX_VERIFY_RETRIES = 2;

  const body = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      const logger = new SessionLogger(ticketId, "claude-code", model);
      const tmpFile = join(tmpdir(), `claude-sysprompt-${Date.now()}.txt`);
      const designOutputDir = join(homedir(), "claude-ui-designs");

      try {
        send({ thinking: "Starting Claude Code local session…" });

        const mcpHealthy = await checkMcpServerHealth();
        if (!mcpHealthy) {
          send({
            error:
              `pm-mcp is not reachable at ${getMcpServerUrl()}. ` +
              "Start both services with: npm run dev",
          });
          return;
        }

        mkdirSync(designOutputDir, { recursive: true });

        // ── Step 1: build prompts ────────────────────────────────────────
        logger.beginStep();
        let systemPrompt: string;
        let userMessage:  string;

        if (isRefinement && currentHtml) {
          systemPrompt = buildRefinementSystemPrompt(
            designContext,
            brandIconsContext,
            componentCatalogContext,
            mockupGrounding
          );
          userMessage  = buildRefinementUserMessage(currentHtml, additionalPmContext);
        } else {
          systemPrompt = buildSystemPrompt(
            enableVisualSkill,
            archContext,
            designContext,
            sitemapContext,
            brandIconsContext,
            componentCatalogContext,
            renderedCaptureContext,
            mockupGrounding
          );
          userMessage  = buildUserMessage(ticketId, jiraData, additionalPmContext, attachedFiles);

          if (enableVisualSkill) {
            const screenshots = await listProductScreenshots();
            const screenshotNote = screenshots.length
              ? `\n\nProduct screenshots for reference (read these with the Read tool to match the actual UI):\n${screenshots.map((f) => screenshotPath(f)).join("\n")}`
              : "";
            const wf = visualWorkflowInstruction(mockupGrounding);

            if (mockupGrounding?.templateHtml) {
              send({
                thinking:
                  `✓ Closest captured template: ${mockupGrounding.route} ` +
                  `(${mockupGrounding.templateSlug}, ${mockupGrounding.templateSource}, score ${mockupGrounding.matchScore})`,
              });
              const preview = prepareInitialMockupHtml(mockupGrounding);
              if (preview) send({ html: preview, templateBase: true });
              userMessage = `${wrapBaseTemplate(mockupGrounding)}\n\n---\n\n${userMessage}`;
            }

            userMessage += `${screenshotNote}\n\n${wf}\n\nOUTPUT: First emit the reuse manifest (REUSE_MANIFEST_START/END), then the complete HTML mockup wrapped in:\nRAW_HTML_COMPONENT_START\n<!DOCTYPE html>...full HTML...\nRAW_HTML_COMPONENT_END`;
          }
        }

        const sysT  = charsToTokens(systemPrompt.length);
        const userT = charsToTokens(userMessage.length);
        logger.record("Prompt construction", { inputTokens: sysT + userT, detail: `sys ~${sysT} tok · user ~${userT} tok (estimated)` });

        // ── Step 2: model inference (with verify + retry loop) ───────────
        const overallStart = Date.now();
        const savedFiles: string[] = [];
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalCostUsd = 0;

        // One Claude pass: writes system prompt, spawns, collects text + usage.
        async function runClaudeOnce(
          sysPrompt: string,
          userMsg: string,
          label: string,
        ): Promise<{ allText: string; exitCode: number | null; stderr: string }> {
          writeFileSync(tmpFile, sysPrompt, "utf8");
          send({ thinking: label });

          const spawnArgs = [
            "--print",
            "--output-format", "stream-json",
            "--verbose",
            "--model", "claude-haiku-4-5",
            "--system-prompt-file", tmpFile,
            "--max-budget-usd", "2",
            "--mcp-config", claudeMcpConfigArg(),
            "--strict-mcp-config",
            "--permission-mode", "bypassPermissions",
            "--allowedTools", `Write,Read,${claudeMcpAllowedToolsPattern()}`,
          ];

          const proc = spawn("claude", spawnArgs, {
            stdio: ["pipe", "pipe", "pipe"],
            cwd: WORKSPACE_ROOT,
          });
          proc.stdin.write(userMsg, "utf8");
          proc.stdin.end();

          let buf = "";
          let allText = "";
          let inTok = 0;
          let outTok = 0;
          let cost = 0;

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
                    inTok = usage.input_tokens ?? 0;
                    outTok = usage.output_tokens ?? 0;
                  }
                  if (typeof msg.cost_usd === "number") cost = msg.cost_usd;
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
                    for (const b of content) {
                      if (b.type === "thinking" && b.thinking) {
                        const snippet = b.thinking.slice(0, 120).replace(/\n/g, " ");
                        send({ thinking: `Thinking: ${snippet}${b.thinking.length > 120 ? "…" : ""}` });
                      } else if (b.type === "tool_use") {
                        if (b.name === "Write") {
                          const filePath = b.input?.file_path as string | undefined;
                          if (filePath) {
                            savedFiles.push(filePath);
                            send({ thinking: `Writing file: ${filePath}` });
                          }
                        } else if (b.name?.startsWith("mcp__")) {
                          send({ thinking: `MCP: ${b.name.replace(/^mcp__[^_]+__/, "")}` });
                        }
                      } else if (b.type === "text" && b.text) {
                        allText += b.text;
                      }
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

          if (cost === 0 && (inTok || outTok)) cost = tokenCost(model, inTok, outTok);
          totalInputTokens += inTok;
          totalOutputTokens += outTok;
          totalCostUsd += cost;
          logger.record(`Model inference — ${label}`, {
            inputTokens: inTok,
            outputTokens: outTok,
            costUsd: cost > 0 ? cost : undefined,
            detail: `exit ${exitCode ?? 0}`,
          });

          return { allText, exitCode, stderr: stderrBuf };
        }

        let finalText = "";
        let finalHtml: string | undefined;
        let manifest: ReuseManifest = EMPTY_MANIFEST;
        let lastValidation: UiReferenceValidation | null = null;

        for (let attempt = 0; attempt <= MAX_VERIFY_RETRIES; attempt++) {
          logger.beginStep();
          const label =
            attempt === 0
              ? `Analysing ticket with model ${model}…`
              : `Fixing hallucinated reference(s) — retry ${attempt}/${MAX_VERIFY_RETRIES}…`;

          const { allText, exitCode, stderr } = await runClaudeOnce(systemPrompt, userMessage, label);
          if (exitCode !== 0 && exitCode !== null) {
            send({ error: `Claude Code exited with code ${exitCode}. ${stderr.slice(0, 400)}` });
            return;
          }

          finalText = allText;
          const parsedManifest = extractManifest(allText).manifest;
          manifest = parsedManifest ?? EMPTY_MANIFEST;
          const { html } = extractHtmlFromMarkers(allText);
          if (html) finalHtml = html;

          // Verification loop only applies to mockup generation.
          if (!enableVisualSkill) break;

          const validation = await validateUiReferences({
            components: manifest.reusedComponents,
            icons: manifest.reusedIcons,
          });
          lastValidation = validation;

          if (validation.valid) {
            send({ thinking: "✓ All reused components & icons verified against the codebase." });
            break;
          }

          const unknownCount =
            validation.unknownComponents.length + validation.unknownIcons.length;

          if (attempt === MAX_VERIFY_RETRIES) {
            send({
              thinking: `⚠ ${unknownCount} reference(s) still unverified after ${MAX_VERIFY_RETRIES} retries — showing best effort.`,
            });
            break;
          }

          send({ thinking: `✗ ${unknownCount} hallucinated reference(s) detected — regenerating.` });
          systemPrompt = buildRefinementSystemPrompt(
            designContext,
            brandIconsContext,
            componentCatalogContext,
            mockupGrounding
          );
          userMessage = buildCorrectionUserMessage(
            finalHtml ?? "",
            validation,
            Boolean(mockupGrounding?.available),
            Boolean(mockupGrounding?.templateHtml?.trim()),
          );
        }

        send({ thinkingDone: true, elapsed: (Date.now() - overallStart) / 1000 });

        // Strip manifest + html markers; remaining text = analysis + effort estimation.
        const withoutManifest = extractManifest(finalText).displayText;
        const { displayText } = extractHtmlFromMarkers(withoutManifest);
        if (displayText) send({ delta: displayText });
        if (finalHtml) {
          if (mockupGrounding?.available && mockupGrounding.cssText) {
            finalHtml = injectGroundingIntoHtml(finalHtml, mockupGrounding.cssText);
            logger.record("Injected captured Quasar CSS into mockup");
            send({ thinking: "✓ Injected captured Quasar CSS bundle into mockup HTML." });
          }
          logger.record("HTML mockup extracted from response");
          send({ html: finalHtml });
        }
        send({ manifest, validation: lastValidation ?? undefined });

        const { logFile, logData } = logger.finish();
        send({
          done: true, provider: "claude-code", model,
          savedFiles: savedFiles.length ? savedFiles : undefined,
          logFile, logData,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          costUsd: totalCostUsd,
        });

      } catch (err) {
        send({ error: `Claude Code error: ${err instanceof Error ? err.message : String(err)}` });
      } finally {
        controller.close();
        try { unlinkSync(tmpFile); } catch { /* best-effort cleanup */ }
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
    model, attachedFiles, isRefinement, currentHtml,
  } = body;

  let archContext = "", designContext = "", sitemapContext = "";
  let brandIconsContext = "", componentCatalogContext = "", renderedCaptureContext = "";
  let mockupGrounding: MockupGrounding | null = null;
  let mcpContextError = "";
  try {
    const ctx = await fetchContextResources();
    if (isRefinement) {
      designContext = ctx.design;
    } else {
      archContext    = ctx.architecture;
      designContext  = ctx.design;
      sitemapContext = ctx.sitemap;
    }
  } catch (e) {
    mcpContextError = (e as Error).message;
    console.warn("[chat] MCP context pre-fetch failed:", mcpContextError);
  }

  if (enableVisualSkill) {
    const ticketText = [
      jiraData?.summary ?? "",
      jiraData?.description?.slice(0, 500) ?? "",
      additionalPmContext ?? "",
    ].join(" ");

    const [icons, components, capturedPages, renderedComponents, grounding] = await Promise.all([
      fetchBrandIconCatalog(),
      fetchComponentCatalog(jiraData?.summary),
      fetchCapturedPageCatalog(),
      fetchRenderedComponentCatalog(jiraData?.summary),
      buildMockupGrounding(ticketText),
    ]);
    brandIconsContext = icons;
    componentCatalogContext = components;
    mockupGrounding = grounding.available ? grounding : null;
    renderedCaptureContext = [capturedPages, renderedComponents]
      .filter((s) => s && !/^No (captured|rendered)/.test(s.trim()))
      .join("\n\n");
  }

  if (mcpContextError && !isRefinement) {
    return NextResponse.json(
      {
        error:
          `pm-mcp context unavailable (${mcpContextError}). ` +
          "Start the MCP server with: npm run dev",
      },
      { status: 503 }
    );
  }

  const activeModel = model ?? "claude-haiku-4-5-20251001";
  return streamClaudeCode(
    activeModel, jiraTicketId, jiraData, additionalPmContext,
    enableVisualSkill, archContext, designContext, sitemapContext, brandIconsContext,
    componentCatalogContext, renderedCaptureContext, mockupGrounding, attachedFiles, isRefinement, currentHtml,
  );
}
