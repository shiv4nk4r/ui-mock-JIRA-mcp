import { NextResponse } from "next/server";
import { spawn } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
import { tmpdir, homedir } from "os";
import { join } from "path";
import {
  fetchContextResources,
  listProductScreenshots,
  screenshotPath,
} from "@/mcp-client";

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
  sitemapContext = ""
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
      "MOCKUP RULES (derive all values from design.md above):",
      "- Colors: ONLY the exact tokens — primary #101a5c, secondary #FE8400, positive #66bb6a, negative #ED3324, info #2982cc, warning #f9b115",
      "- Font: Source Sans Pro via Google Fonts CDN. Body 13px.",
      "- Top bar: white bg, 52px sticky, GreyOrange G-mark SVG (orange) + 'GreyOrange' / 'Manager Dashboard' wordmarks",
      "- Primary nav: #101a5c bg, 42px, orange 2px bottom-border on active tab",
      "- Sub-tabs: white bg, 38px, orange underline on active",
      "- Section banner: #101a5c bg, white text, colored dot + label + count per stat",
      "- Filter bar: '≡ Filter' with text label (not icon-only)",
      "- Table rows: 40px height, sort indicators = CSS triangles (▲▼), NOT Material Icons",
      "- Action buttons: 26×26px, 3px border-radius, outline style",
      "- Modals: #101a5c header, white body, backdrop rgba(16,26,92,0.38), radio options as bordered rows",
      "- Pagination: < 1 2 3 … N > with ellipsis",
      "- No Vue, no Quasar, no JS frameworks — pure HTML + CSS + minimal vanilla JS only",
      "- Implement EVERY status chip, state-transition rule, and field-visibility rule from the Jira ticket",
      "- If product screenshots are provided, match the exact visual patterns you observe in them"
    );
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

function buildRefinementSystemPrompt(designContext = ""): string {
  const base = `You are a UI refinement assistant for GreyOrange's Manager Dashboard. You will receive an existing HTML mockup and a refinement request. Return the COMPLETE updated HTML file — never return partial snippets.`;

  const parts: string[] = [base];
  if (designContext) {
    parts.push(
      "=== DESIGN LANGUAGE RULES (from design.md) ===",
      designContext,
      "=== END DESIGN LANGUAGE ==="
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
    "Return the complete updated HTML wrapped in RAW_HTML_COMPONENT_START / RAW_HTML_COMPONENT_END.",
  ].join("\n");
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
  attachedFiles?: UserAttachedFile[],
  isRefinement = false,
  currentHtml?: string,
): Response {
  const encoder = new TextEncoder();

  const body = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      const logger = new SessionLogger(ticketId, "claude-code", model);
      const tmpFile = join(tmpdir(), `claude-sysprompt-${Date.now()}.txt`);
      const designOutputDir = join(homedir(), "claude-ui-designs");

      try {
        send({ thinking: "Starting Claude Code local session…" });

        mkdirSync(designOutputDir, { recursive: true });

        // ── Step 1: build prompts ────────────────────────────────────────
        logger.beginStep();
        let systemPrompt: string;
        let userMessage:  string;

        if (isRefinement && currentHtml) {
          // Refinement mode: shorter system prompt, current HTML in user message
          systemPrompt = buildRefinementSystemPrompt(designContext);
          userMessage  = buildRefinementUserMessage(currentHtml, additionalPmContext);
        } else {
          // Initial generation: full context + visual skill instructions
          systemPrompt = buildSystemPrompt(enableVisualSkill, archContext, designContext, sitemapContext);
          userMessage  = buildUserMessage(ticketId, jiraData, additionalPmContext, attachedFiles);

          if (enableVisualSkill) {
            const screenshots = await listProductScreenshots();
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

        // ── Step 2: model inference ──────────────────────────────────────
        logger.beginStep();
        const thinkingStart = Date.now();
        send({ thinking: `Analysing ticket with model ${model}…` });

        const spawnArgs = [
          "--print",
          "--output-format", "stream-json",
          "--verbose",
          "--model", "claude-haiku-4-5",
          // "--model", model,
          "--system-prompt-file", tmpFile,
          "--max-budget-usd", "2",
          "--allowedTools", "Write,Read",
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
                  const toolUseBlocks = content.filter((b) => b.type === "tool_use" && b.name === "Write");
                  const textBlocks    = content.filter((b) => b.type === "text" && b.text);

                  for (const b of thinkBlocks) {
                    if (b.thinking) {
                      const snippet = b.thinking.slice(0, 120).replace(/\n/g, " ");
                      send({ thinking: `Thinking: ${snippet}${b.thinking.length > 120 ? "…" : ""}` });
                    }
                  }

                  for (const b of toolUseBlocks) {
                    const filePath = b.input?.file_path as string | undefined;
                    if (filePath) {
                      savedFiles.push(filePath);
                      send({ thinking: `Writing file: ${filePath}` });
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
          if (allText) {
            const { displayText, html } = extractHtmlFromMarkers(allText);
            if (displayText) send({ delta: displayText });
            if (html) {
              logger.record("HTML mockup extracted from response");
              send({ html });
            }
          }

          // ── Step 4: write session log ──────────────────────────────────
          const { logFile, logData } = logger.finish();
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
  try {
    const ctx = await fetchContextResources();
    if (isRefinement) {
      // Refinements only need design rules — skips arch + sitemap (saves ~15k tokens)
      designContext = ctx.design;
    } else {
      archContext    = ctx.architecture;
      designContext  = ctx.design;
      sitemapContext = ctx.sitemap;
    }
  } catch { /* proceed without context if files are missing */ }

  const activeModel = model ?? "claude-haiku-4-5-20251001";
  return streamClaudeCode(
    activeModel, jiraTicketId, jiraData, additionalPmContext,
    enableVisualSkill, archContext, designContext, sitemapContext,
    attachedFiles, isRefinement, currentHtml,
  );
}
