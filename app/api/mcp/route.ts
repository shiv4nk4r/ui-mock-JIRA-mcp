import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// ── Context loading ───────────────────────────────────────────────────────────

const CONTEXT_DIR = path.join(process.cwd(), "src", "mcp-context");

function loadContext(filename: string): string {
  return fs.readFileSync(path.join(CONTEXT_DIR, filename), "utf-8");
}

/**
 * Extracts a markdown section by its exact heading, reading until the next ## heading.
 */
function extractSection(content: string, heading: string): string {
  const startIdx = content.indexOf(heading);
  if (startIdx === -1) return `⚠ Section "${heading}" not found.`;
  const afterStart = content.slice(startIdx + heading.length);
  const nextIdx = afterStart.search(/\n## /);
  return nextIdx === -1
    ? content.slice(startIdx)
    : content.slice(startIdx, startIdx + heading.length + nextIdx);
}

// ── Section index maps ────────────────────────────────────────────────────────

const ARCH_SECTIONS: Record<string, string> = {
  "overview":       "## 1. Monorepo Overview",
  "stack":          "## 2. Technology Stack",
  "architecture":   "## 3. Architecture",
  "data-flow":      "## 4. Data Flow & Request Lifecycle",
  "auth":           "## 5. Authentication & Session Management",
  "frontend":       "## 6. Frontend (mdui/)",
  "backend":        "## 7. Backend BFF (mdbff/)",
  "realtime":       "## 8. Real-Time Subscriptions",
  "services":       "## 9. External Services & Integrations",
  "colors":         "## 10. Color System & Design Tokens",
  "conventions":    "## 11. Coding Standards & Conventions",
  "state":          "## 12. State Management",
  "routing":        "## 13. Routing Structure",
  "i18n":           "## 14. Internationalization",
  "deployment":     "## 15. Deployment & Infrastructure",
  "env-vars":       "## 16. Environment Variables Reference",
};

const DESIGN_SECTIONS: Record<string, string> = {
  "brand":          "## 1. Brand Identity",
  "colors":         "## 2. Color System",
  "typography":     "## 3. Typography",
  "layout":         "## 4. Layout & Page Structure",
  "topbar":         "## 5. Top Bar",
  "primary-nav":    "## 6. Primary Navigation Tab Bar",
  "sub-nav":        "## 7. Sub-Tab Bar",
  "section-banner": "## 8. Section Banner",
  "buttons":        "## 9. Buttons",
  "inputs":         "## 10. Form Inputs",
  "tables":         "## 11. Data Tables",
  "filter-bar":     "## 12. Filter Bar",
  "summary-kpi":    "## 13. Summary / KPI Section",
  "chips-badges":   "## 14. Status Chips & Badges",
  "charts":         "## 15. Charts",
  "modals":         "## 16. Modals / Dialogs",
  "drawers":        "## 17. Drawers / Side Panels",
  "alerts":         "## 18. Alerts & Notifications",
  "empty-states":   "## 21. Empty States",
  "icons":          "## 22. Icons",
  "patterns":       "## 24. Patterns — What Agents MUST Follow",
  "anti-patterns":  "## 25. Anti-Patterns — What Agents MUST NEVER Do",
  "quick-ref":      "## 26. Quick Reference Card for Agents",
  "components-ref": "## 27. Quasar Component Reference — Full Lookup Table",
};

// ── Sitemap section index ─────────────────────────────────────────────────────

const SITEMAP_SECTIONS: Record<string, string> = {
  "global-ui":       "## Global Persistent UI",
  "nav-tree":        "## Full Navigation Tree",
  "analytics":       "### 1. ANALYTICS",
  "outbound":        "### 2. OUTBOUND",
  "inbound":         "### 3. INBOUND",
  "transport":       "### 4. TRANSPORT",
  "audit":           "### 5. AUDIT",
  "exceptions":      "### 6. PROCESS EXCEPTIONS",
  "inventory":       "### 7. INVENTORY",
  "system":          "### 8. SYSTEM",
  "resources-users": "### 9. RESOURCES / USERS",
  "shift-planning":  "### 10. SHIFT PLANNING",
  "reports":         "### 11. REPORTS",
  "notification":    "### 12. NOTIFICATION",
  "feature-flags":   "## Feature Flags Summary",
  "quick-reference": "## Full Sitemap at a Glance",
  "i18n-labels":     "## i18n Key → Display Label Mapping",
};

// ── Per-element token quick answers ───────────────────────────────────────────

const DESIGN_TOKENS: Record<string, string> = {
  "button-primary":    "q-btn color='secondary' text-color='white' unelevated → bg #FE8400, 36px, 4px radius",
  "button-secondary":  "q-btn outline color='dark' unelevated → white bg, #d4d3d3 border",
  "button-danger":     "q-btn color='negative' text-color='white' unelevated → bg #ED3324",
  "button-icon":       "q-btn icon='...' outline square dense size='sm' → 32×32px",
  "chip-success":      "q-chip dense color='positive' text-color='white' → #66bb6a",
  "chip-info":         "q-chip dense color='info' text-color='white' → #2982cc",
  "chip-warning":      "q-chip dense color='warning' text-color='white' → #f9b115",
  "chip-error":        "q-chip dense color='negative' text-color='white' → #ED3324",
  "chip-cancelled":    "q-chip dense color='dark' text-color='white' → #636f83",
  "input-text":        "q-input outlined dense → 36px, #d4d3d3 border, #2982cc focus, 4px radius",
  "input-search":      "q-input outlined dense + #prepend slot with q-icon name='search'",
  "table":             "q-table flat bordered dense separator='horizontal' → white bg, #F5F5F5 header",
  "modal-header":      "q-card-section class='bg-primary text-white row items-center q-pa-md' + close q-btn",
  "modal-footer":      "q-card-actions align='right' → CANCEL (outline dark) + PROCEED (secondary)",
  "toast-success":     "this.$q.notify({ message, color: 'positive', position: 'top-right', timeout: 3000 })",
  "toast-error":       "this.$q.notify({ message, color: 'negative', position: 'top-right', timeout: 4000 })",
  "chart-colors":      "Series: #101a5c → #66bb6a → #FE8400 → #2982cc → #f9b115 → #ED3324",
  "empty-state":       "div.flex.flex-center.q-pa-xl.text-grey.text-italic — text only, no icons",
  "page-layout":       "q-layout view='hHh Lpr lfr' → q-header → q-page-container → q-page",
  "nav-primary":       "q-tabs class='bg-primary text-white' indicator-color='secondary' dense mobile-arrows",
  "section-banner":    "div full-width 40px bg-primary text-white — 'Title | Stat: Value | Stat: Value'",
  "progress-bar":      "q-linear-progress color='secondary' track-color='grey-3' style='height:3px'",
  "filter-bar":        "div.row.items-center.q-gutter-sm → q-btn(menu)+q-input(search)+q-select×N+q-space+q-btn-dropdown×2+q-btn(sync)",
};

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "poc-pm-visual-orchestrator",
  version: "2.0.0",
});

// ── Resources ─────────────────────────────────────────────────────────────────

server.registerResource(
  "architecture-context",
  "resource://docs/architecture",
  {
    mimeType: "text/markdown",
    description:
      "Full Manager Dashboard system architecture: monorepo, tech stack, data flow, auth, frontend/BFF layers, services, conventions, routing, deployment",
  },
  async () => ({
    contents: [{ uri: "resource://docs/architecture", mimeType: "text/markdown", text: loadContext("context.md") }],
  })
);

server.registerResource(
  "sitemap-context",
  "resource://docs/sitemap",
  {
    mimeType: "text/markdown",
    description:
      "Global navigation sitemap: all 11 L1 tabs (Analytics→Notification), sub-tabs, hash routes (/#/route), feature flags, i18n key→label mapping, linked external apps",
  },
  async () => ({
    contents: [{ uri: "resource://docs/sitemap", mimeType: "text/markdown", text: loadContext("site-map.md") }],
  })
);

server.registerResource(
  "design-language",
  "resource://docs/design",
  {
    mimeType: "text/markdown",
    description:
      "Strict Quasar Vue 2 design language: color palette, typography, layout shell, all component rules (buttons, tables, modals, charts, chips, icons), page patterns, anti-patterns",
  },
  async () => ({
    contents: [{ uri: "resource://docs/design", mimeType: "text/markdown", text: loadContext("design.md") }],
  })
);

// ── Tool 1: Architecture section lookup ───────────────────────────────────────

server.tool(
  "query-architecture",
  {
    section: z
      .enum(Object.keys(ARCH_SECTIONS) as [string, ...string[]])
      .describe(`Architecture section. Options: ${Object.keys(ARCH_SECTIONS).join(", ")}`),
    question: z.string().optional().describe("Optional specific question to highlight"),
  },
  async ({ section, question }) => {
    const content = extractSection(loadContext("context.md"), ARCH_SECTIONS[section]);
    return {
      content: [
        { type: "text", text: content },
        ...(question ? [{ type: "text" as const, text: `\n---\n**Question:** ${question}` }] : []),
      ],
    };
  }
);

// ── Tool 2: Design language section lookup ────────────────────────────────────

server.tool(
  "query-design-language",
  {
    section: z
      .enum(Object.keys(DESIGN_SECTIONS) as [string, ...string[]])
      .describe(`Design section. Options: ${Object.keys(DESIGN_SECTIONS).join(", ")}`),
    component: z.string().optional().describe("Specific Quasar component to find within the section"),
  },
  async ({ section, component }) => {
    const content = extractSection(loadContext("design.md"), DESIGN_SECTIONS[section]);
    return {
      content: [
        { type: "text", text: content },
        ...(component ? [{ type: "text" as const, text: `\n---\n**Looking up:** ${component}` }] : []),
      ],
    };
  }
);

// ── Tool 3: Design token quick lookup ─────────────────────────────────────────

server.tool(
  "get-design-token",
  {
    element: z
      .enum(Object.keys(DESIGN_TOKENS) as [string, ...string[]])
      .describe(`UI element. Options: ${Object.keys(DESIGN_TOKENS).join(", ")}`),
  },
  async ({ element }) => {
    const colorSection = extractSection(loadContext("design.md"), "## 2. Color System");
    return {
      content: [
        {
          type: "text",
          text: [`## Design Token — ${element}`, "", `**Rule:** ${DESIGN_TOKENS[element]}`, "", "### Color Palette Reference", colorSection].join("\n"),
        },
      ],
    };
  }
);

// ── Tool 4: Sitemap section lookup ────────────────────────────────────────────

server.tool(
  "query-sitemap",
  {
    section: z
      .enum(Object.keys(SITEMAP_SECTIONS) as [string, ...string[]])
      .describe(`Sitemap section. Options: ${Object.keys(SITEMAP_SECTIONS).join(", ")}`),
    question: z.string().optional().describe("Specific question about routes, sub-tabs, or feature flags"),
  },
  async ({ section, question }) => {
    const content = extractSection(loadContext("site-map.md"), SITEMAP_SECTIONS[section]);
    return {
      content: [
        { type: "text", text: content },
        ...(question ? [{ type: "text" as const, text: `\n---\n**Question:** ${question}` }] : []),
      ],
    };
  }
);

// ── Tool 5: Identify affected system layers ───────────────────────────────────

server.tool(
  "identify-affected-layers",
  {
    ticketSummary: z.string().describe("Jira ticket summary"),
    ticketDescription: z.string().describe("Jira ticket description (first 600 chars sufficient)"),
  },
  async ({ ticketSummary, ticketDescription }) => {
    const ctx = loadContext("context.md");
    return {
      content: [
        {
          type: "text",
          text: [
            `## Layer Impact Analysis — ${ticketSummary}`,
            `**Description excerpt:** ${ticketDescription.slice(0, 400)}`,
            "",
            extractSection(ctx, "## 3. Architecture"),
            "",
            extractSection(ctx, "## 4. Data Flow & Request Lifecycle"),
            "",
            extractSection(ctx, "## 6. Frontend (mdui/)"),
            "",
            extractSection(ctx, "## 7. Backend BFF (mdbff/)"),
            "",
            extractSection(ctx, "## 9. External Services & Integrations"),
            "",
            extractSection(ctx, "## 12. State Management"),
            "",
            "---",
            "Determine:",
            "1. **Layers affected** — UI only / BFF only / UI+BFF / needs upstream service change",
            "2. **Datasource to reuse** — which `src/apis/*.mjs` file applies",
            "3. **GraphQL changes needed** — new Query/Mutation/Subscription? New input type?",
            "4. **Vuex module** — which store module to update",
            "5. **Risks** — N+1 without DataLoader? Missing auth middleware? ES injection risk?",
          ].join("\n"),
        },
      ],
    };
  }
);

// ── Tool 6: Generate component mockup (with design + sitemap nav context) ──────

server.tool(
  "generate-component-mockup",
  {
    pmPrompt: z.string().describe("What UI feature or screen the PM wants to visualise"),
    pattern: z
      .enum(["listing-page", "dashboard", "form-page", "modal", "detail-drawer", "status-card", "filter-bar"])
      .describe("Quasar page pattern to apply"),
    ticketId: z.string().optional().describe("Jira ticket ID for reference"),
  },
  async ({ pmPrompt, pattern, ticketId }) => {
    const design = loadContext("design.md");
    const sitemap = loadContext("site-map.md");

    const patternSectionMap: Record<string, string> = {
      "listing-page":  "## 11. Data Tables",
      "dashboard":     "## 13. Summary / KPI Section",
      "form-page":     "## 10. Form Inputs",
      "modal":         "## 16. Modals / Dialogs",
      "detail-drawer": "## 17. Drawers / Side Panels",
      "status-card":   "## 20. Hardware / Status Dashboard Sections",
      "filter-bar":    "## 12. Filter Bar",
    };

    const navStructure  = extractSection(sitemap, "## Global Persistent UI");
    const sitemapGlance = extractSection(sitemap, "## Full Sitemap at a Glance");
    const featureFlags  = extractSection(sitemap, "## Feature Flags Summary");

    return {
      content: [
        {
          type: "text",
          text: [
            `## Component Mockup Context`,
            ticketId ? `**Ticket:** ${ticketId}` : "",
            `**Directive:** ${pmPrompt}`,
            `**Pattern:** ${pattern}`,
            "",
            "### Real Navigation Structure (use exact routes and labels)",
            navStructure,
            "",
            "### Full Sitemap — Route Reference",
            sitemapGlance,
            "",
            "### Feature Flags (conditionally shown tabs/sections)",
            featureFlags,
            "",
            "### Pattern-Specific Design Rules",
            extractSection(design, patternSectionMap[pattern]),
            "",
            "### Page Patterns (MUST follow)",
            extractSection(design, "## 24. Patterns — What Agents MUST Follow"),
            "",
            "### Anti-Patterns (NEVER do these)",
            extractSection(design, "## 25. Anti-Patterns — What Agents MUST NEVER Do"),
            "",
            "### Quick Reference",
            extractSection(design, "## 26. Quick Reference Card for Agents"),
            "",
            "### Quasar Component Lookup",
            extractSection(design, "## 27. Quasar Component Reference — Full Lookup Table"),
          ]
            .filter(Boolean)
            .join("\n"),
        },
        {
          type: "text",
          text: [
            `Generate a production-quality Quasar Vue 2 SFC for: "${pmPrompt}". Pattern: ${pattern}.`,
            "REQUIREMENTS:",
            "- Use ONLY the color palette and Quasar components defined above",
            "- Navigation must use the EXACT L1 tab labels and hash routes from the sitemap (e.g. /#/outbound/ordersV2)",
            "- Section banner must use the real page title from the sitemap",
            "- Active tab must be highlighted correctly (indicator-color='secondary')",
            "- Feature-flagged tabs should be shown conditionally",
          ].join("\n"),
        },
      ],
    };
  }
);

// ── Tool 6: Engineering effort estimation ─────────────────────────────────────

server.tool(
  "estimate-effort",
  {
    ticketSummary: z.string().describe("Jira ticket summary"),
    ticketDescription: z.string().describe("Jira ticket description"),
    affectedLayers: z
      .array(
        z.enum([
          "ui-component",
          "ui-vuex-store",
          "bff-schema",
          "bff-resolver",
          "bff-datasource",
          "bff-model",
          "realtime-subscription",
          "upstream-service-change",
          "unit-tests",
          "contract-tests",
        ])
      )
      .describe("All system layers this ticket touches"),
  },
  async ({ ticketSummary, ticketDescription, affectedLayers }) => {
    const estimates: Record<string, { days: number; note: string }> = {
      "ui-component":            { days: 2.0, note: "Vue SFC + Quasar components + Apollo query/mutation wiring" },
      "ui-vuex-store":           { days: 0.5, note: "Actions (async) + mutations (state) + getters in domain module" },
      "bff-schema":              { days: 0.5, note: "GraphQL type + input type + schema extension" },
      "bff-resolver":            { days: 1.0, note: "Thin resolver + resolver composition auth middleware" },
      "bff-datasource":          { days: 1.5, note: "API DataSource class + axios HTTP client + error handling" },
      "bff-model":               { days: 1.0, note: "Business logic, data transformation, bodybuilder ES DSL" },
      "realtime-subscription":   { days: 2.0, note: "PubSub + subscription resolver + frontend WebSocket wiring" },
      "upstream-service-change": { days: 0,   note: "⚠ External team dependency — track separately" },
      "unit-tests":              { days: 1.0, note: "Jest unit tests for resolver + component" },
      "contract-tests":          { days: 1.0, note: "Pact consumer-driven contract test for new datasource" },
    };

    const totalDays = affectedLayers.reduce((sum, l) => sum + estimates[l].days, 0);
    const sp = totalDays <= 2 ? 3 : totalDays <= 4 ? 5 : totalDays <= 6 ? 8 : 13;
    const size = totalDays <= 2 ? "S" : totalDays <= 4 ? "M" : totalDays <= 7 ? "L" : "XL";
    const conventions = extractSection(loadContext("context.md"), "## 11. Coding Standards & Conventions");

    return {
      content: [
        {
          type: "text",
          text: [
            `### 📊 Engineering Effort Estimation — ${ticketSummary}`,
            `**Description:** ${ticketDescription.slice(0, 300)}`,
            "",
            "**Layer Breakdown:**",
            ...affectedLayers.map(
              (l) =>
                `- **${l}**: ${estimates[l].days > 0 ? `~${estimates[l].days}d` : "TBD"} — ${estimates[l].note}`
            ),
            "",
            `| T-Shirt | Story Points | Estimated Duration |`,
            `|---|---|---|`,
            `| ${size} | ~${sp} SP | ${totalDays.toFixed(1)}–${(totalDays + 1.5).toFixed(1)} days |`,
            "",
            "**Pre-Implementation Checklist:**",
            "- [ ] GraphQL input types defined — no loose scalar arguments",
            "- [ ] Resolver is thin — delegates to datasource, no inline logic",
            "- [ ] Auth middleware via resolver composition (not inline if-check)",
            "- [ ] DataLoader used if N+1 risk exists",
            "- [ ] Vuex: actions for async, mutations for state only",
            "- [ ] Quasar components used — no raw `<button>`, `<input>`, `<select>`",
            "- [ ] Empty state handled gracefully in UI",
            "- [ ] `this.$q.notify()` for success/error feedback",
            "",
            "### Convention Reference",
            conventions,
          ].join("\n"),
        },
      ],
    };
  }
);

// ── Transport ─────────────────────────────────────────────────────────────────
// Stateless mode: each request gets its own transport instance.
// Correct for Next.js App Router (serverless / edge); no session state is kept.

async function handleMcpRequest(request: Request): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session ID header
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}
