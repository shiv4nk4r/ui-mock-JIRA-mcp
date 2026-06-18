/**
 * MCP server factory — resources, context tools, and code-graph tools.
 * Shared by the standalone HTTP server (pm-mcp) and consumed over Streamable HTTP.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { codeGraph } from "./parser/graph-store";
import {
  buildIndex,
  defaultConfig,
  tryLoadCache,
  defaultCachePath,
} from "./parser/indexer";
import type { NodeKind } from "./parser/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT_DIR = path.join(__dirname, "context");

function resolveRepoRoot(): string {
  if (process.env.REPO_ROOT) {
    return path.resolve(process.env.REPO_ROOT);
  }
  // pm-mcp/src → pm-mcp → poc-mcp → manager-dashboard
  return path.resolve(__dirname, "../../..");
}

function loadCtx(filename: string): string {
  return fs.readFileSync(path.join(CONTEXT_DIR, filename), "utf-8");
}

function extractSection(content: string, heading: string): string {
  const startIdx = content.indexOf(heading);
  if (startIdx === -1) return `⚠ Section "${heading}" not found.`;
  const afterStart = content.slice(startIdx + heading.length);
  const nextIdx = afterStart.search(/\n## /);
  return nextIdx === -1
    ? content.slice(startIdx)
    : content.slice(startIdx, startIdx + heading.length + nextIdx);
}

const ARCH_SECTIONS = {
  overview: "## 1. Monorepo Overview",
  stack: "## 2. Technology Stack",
  architecture: "## 3. Architecture",
  "data-flow": "## 4. Data Flow & Request Lifecycle",
  auth: "## 5. Authentication & Session Management",
  frontend: "## 6. Frontend (mdui/)",
  backend: "## 7. Backend BFF (mdbff/)",
  realtime: "## 8. Real-Time Subscriptions",
  services: "## 9. External Services & Integrations",
  conventions: "## 11. Coding Standards & Conventions",
  state: "## 12. State Management",
  routing: "## 13. Routing Structure",
  deployment: "## 15. Deployment & Infrastructure",
} as const;

const DESIGN_SECTIONS = {
  brand: "## 1. Brand Identity",
  colors: "## 2. Color System",
  typography: "## 3. Typography",
  layout: "## 4. Layout & Page Structure",
  buttons: "## 9. Buttons",
  inputs: "## 10. Form Inputs",
  tables: "## 11. Data Tables",
  "chips-badges": "## 14. Status Chips & Badges",
  charts: "## 15. Charts",
  modals: "## 16. Modals / Dialogs",
  patterns: "## 24. Patterns — What Agents MUST Follow",
  "anti-patterns": "## 25. Anti-Patterns — What Agents MUST NEVER Do",
  "quick-ref": "## 26. Quick Reference Card for Agents",
  "components-ref": "## 27. Quasar Component Reference — Full Lookup Table",
} as const;

const SITEMAP_SECTIONS = {
  "global-ui": "## Global Persistent UI",
  outbound: "### 2. OUTBOUND",
  inventory: "### 7. INVENTORY",
  "shift-planning": "### 10. SHIFT PLANNING",
  "feature-flags": "## Feature Flags Summary",
  "quick-reference": "## Full Sitemap at a Glance",
} as const;

const DESIGN_TOKENS: Record<string, string> = {
  "button-primary":
    "q-btn color='secondary' text-color='white' unelevated → bg #FE8400, 36px, 4px radius",
  "button-secondary":
    "q-btn outline color='dark' unelevated → white bg, #d4d3d3 border",
  "button-danger":
    "q-btn color='negative' text-color='white' unelevated → bg #ED3324",
  "chip-success": "q-chip dense color='positive' text-color='white' → #66bb6a",
  "chip-info": "q-chip dense color='info' text-color='white' → #2982cc",
  table:
    "q-table flat bordered dense separator='horizontal' → white bg, #F5F5F5 header",
  "modal-header":
    "q-card-section class='bg-primary text-white row items-center q-pa-md' + close q-btn",
};

let indexReady = false;
let indexStatus = "Not yet indexed. Call rebuild-code-index first.";
let repoRoot = resolveRepoRoot();

function ensureIndexed(): void {
  if (indexReady) return;

  const cachePath = defaultCachePath(repoRoot);
  const cacheResult = tryLoadCache(codeGraph, cachePath);
  if (cacheResult.loaded && cacheResult.meta) {
    const ageSec = Math.round((cacheResult.ageMs ?? 0) / 1000);
    const stats = codeGraph.stats();
    indexReady = true;
    indexStatus = `Loaded from cache (${ageSec}s old) | ${stats.totalNodes} nodes | ${stats.totalEdges} edges`;
    return;
  }

  indexStatus = "Building index (first run or cache expired)…";
  buildIndex(codeGraph, defaultConfig(repoRoot))
    .then((r) => {
      indexReady = true;
      indexStatus = `Indexed ${r.filesIndexed} files | ${r.totalNodes} nodes | ${r.totalEdges} edges | ${r.durationMs}ms | saved to cache`;
    })
    .catch((e) => {
      indexStatus = `Index error: ${(e as Error).message}`;
    });
}

export function buildMcpServer(): McpServer {
  repoRoot = resolveRepoRoot();
  const server = new McpServer({ name: "pm-context-server", version: "2.0.0" });

  server.registerResource(
    "architecture-context",
    "resource://docs/architecture",
    {
      mimeType: "text/markdown",
      description: "Full system architecture, tech stack, data flow, conventions",
    },
    async () => ({
      contents: [
        {
          uri: "resource://docs/architecture",
          mimeType: "text/markdown",
          text: loadCtx("context.md"),
        },
      ],
    })
  );

  server.registerResource(
    "design-language",
    "resource://docs/design",
    {
      mimeType: "text/markdown",
      description: "Quasar Vue 2 design language: colors, components, patterns",
    },
    async () => ({
      contents: [
        {
          uri: "resource://docs/design",
          mimeType: "text/markdown",
          text: loadCtx("design.md"),
        },
      ],
    })
  );

  server.registerResource(
    "sitemap-context",
    "resource://docs/sitemap",
    {
      mimeType: "text/markdown",
      description: "Navigation sitemap: L1 tabs, sub-tabs, routes, feature flags",
    },
    async () => ({
      contents: [
        {
          uri: "resource://docs/sitemap",
          mimeType: "text/markdown",
          text: loadCtx("site-map.md"),
        },
      ],
    })
  );

  server.tool(
    "list-product-screenshots",
    "Lists all product screenshot PNG files in the context directory.",
    async () => {
      const files = fs
        .readdirSync(CONTEXT_DIR)
        .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
        .sort();
      const lines = files.map((f) => path.join(CONTEXT_DIR, f)).join("\n");
      return {
        content: [
          {
            type: "text",
            text: files.length
              ? `Available product screenshots:\n${lines}`
              : "No product screenshots found in context directory.",
          },
        ],
      };
    }
  );

  server.tool(
    "query-architecture",
    {
      section: z
        .enum(Object.keys(ARCH_SECTIONS) as [string, ...string[]])
        .describe(`Architecture section. Options: ${Object.keys(ARCH_SECTIONS).join(", ")}`),
      question: z.string().optional().describe("Specific question about the section"),
    },
    async ({ section, question }) => {
      const content = extractSection(
        loadCtx("context.md"),
        ARCH_SECTIONS[section as keyof typeof ARCH_SECTIONS]
      );
      return {
        content: [
          { type: "text", text: content },
          ...(question ? [{ type: "text" as const, text: `\n**Question:** ${question}` }] : []),
        ],
      };
    }
  );

  server.tool(
    "query-design-language",
    {
      section: z
        .enum(Object.keys(DESIGN_SECTIONS) as [string, ...string[]])
        .describe(`Design section. Options: ${Object.keys(DESIGN_SECTIONS).join(", ")}`),
      component: z.string().optional().describe("Specific Quasar component to find"),
    },
    async ({ section, component }) => {
      const content = extractSection(
        loadCtx("design.md"),
        DESIGN_SECTIONS[section as keyof typeof DESIGN_SECTIONS]
      );
      return {
        content: [
          { type: "text", text: content },
          ...(component
            ? [{ type: "text" as const, text: `\n**Looking up:** ${component}` }]
            : []),
        ],
      };
    }
  );

  server.tool(
    "get-design-token",
    {
      element: z
        .enum(Object.keys(DESIGN_TOKENS) as [string, ...string[]])
        .describe(`UI element. Options: ${Object.keys(DESIGN_TOKENS).join(", ")}`),
    },
    async ({ element }) => {
      const colorSection = extractSection(loadCtx("design.md"), "## 2. Color System");
      return {
        content: [
          {
            type: "text",
            text: [
              `## Design Token — ${element}`,
              "",
              `**Rule:** ${DESIGN_TOKENS[element]}`,
              "",
              "### Color Palette Reference",
              colorSection,
            ].join("\n"),
          },
        ],
      };
    }
  );

  server.tool(
    "query-sitemap",
    {
      section: z
        .enum(Object.keys(SITEMAP_SECTIONS) as [string, ...string[]])
        .describe(`Sitemap section. Options: ${Object.keys(SITEMAP_SECTIONS).join(", ")}`),
    },
    async ({ section }) => {
      const content = extractSection(
        loadCtx("site-map.md"),
        SITEMAP_SECTIONS[section as keyof typeof SITEMAP_SECTIONS]
      );
      return { content: [{ type: "text", text: content }] };
    }
  );

  server.tool(
    "identify-affected-layers",
    {
      ticketSummary: z.string().describe("Jira ticket summary"),
      ticketDescription: z.string().describe("Jira ticket description"),
    },
    async ({ ticketSummary, ticketDescription }) => {
      const ctx = loadCtx("context.md");
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
              extractSection(ctx, "## 6. Frontend (mdui/)"),
              "",
              extractSection(ctx, "## 7. Backend BFF (mdbff/)"),
            ].join("\n"),
          },
        ],
      };
    }
  );

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
            "unit-tests",
          ])
        )
        .describe("System layers this ticket touches"),
    },
    async ({ ticketSummary, ticketDescription, affectedLayers }) => {
      const estimates: Record<string, { days: number; note: string }> = {
        "ui-component": { days: 2.0, note: "Vue SFC + Quasar components" },
        "ui-vuex-store": { days: 0.5, note: "Vuex actions + mutations" },
        "bff-schema": { days: 0.5, note: "GraphQL type + input type" },
        "bff-resolver": { days: 1.0, note: "Thin resolver + auth middleware" },
        "bff-datasource": { days: 1.5, note: "DataSource class + HTTP client" },
        "unit-tests": { days: 1.0, note: "Jest unit tests" },
      };

      const totalDays = affectedLayers.reduce((sum, l) => sum + estimates[l].days, 0);
      const sp = totalDays <= 2 ? 3 : totalDays <= 4 ? 5 : totalDays <= 6 ? 8 : 13;
      const size = totalDays <= 2 ? "S" : totalDays <= 4 ? "M" : totalDays <= 7 ? "L" : "XL";

      return {
        content: [
          {
            type: "text",
            text: [
              `### Engineering Effort Estimation — ${ticketSummary}`,
              `**Description:** ${ticketDescription.slice(0, 300)}`,
              "",
              ...affectedLayers.map(
                (l) => `- **${l}**: ~${estimates[l].days}d — ${estimates[l].note}`
              ),
              "",
              `| T-Shirt | Story Points | Duration |`,
              `|---|---|---|`,
              `| ${size} | ~${sp} SP | ${totalDays.toFixed(1)} days |`,
            ].join("\n"),
          },
        ],
      };
    }
  );

  ensureIndexed();

  server.tool(
    "rebuild-code-index",
    "Re-index the mdui/ and mdbff/ source trees.",
    async () => {
      indexReady = false;
      indexStatus = "Rebuilding…";
      try {
        const r = await buildIndex(codeGraph, defaultConfig(repoRoot));
        indexReady = true;
        indexStatus = `Indexed ${r.filesIndexed} files | ${r.totalNodes} nodes | ${r.totalEdges} edges`;
        return {
          content: [
            {
              type: "text",
              text: `✓ Index complete in ${r.durationMs}ms — ${r.totalNodes} nodes, ${r.totalEdges} edges`,
            },
          ],
        };
      } catch (e) {
        indexStatus = `Index error: ${(e as Error).message}`;
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
      }
    }
  );

  server.tool(
    "search-code-symbols",
    {
      query: z.string().describe("Name fragment to search for"),
      kind: z
        .enum([
          "function",
          "class",
          "method",
          "variable",
          "vue-component",
          "graphql-resolver",
          "file",
        ])
        .optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ query, kind, limit: rawLimit }) => {
      const limit = rawLimit ?? 20;
      if (!indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      }
      const results = codeGraph.searchByName(query, limit, kind as NodeKind | undefined);
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `No symbols found matching "${query}".` }],
        };
      }
      const lines = results.map((n) => {
        const relFile = path.relative(repoRoot, n.filePath);
        return `[${n.kind}] ${n.scopePath} (${relFile}:${n.loc.start.line})`;
      });
      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} symbol(s):\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get-file-structure",
    "List all symbols in a source file plus import edges.",
    {
      filePath: z.string().describe("Relative path from repo root, e.g. mdui/src/pages/..."),
    },
    async ({ filePath }) => {
      if (!indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      }
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
      const struct = codeGraph.getFileStructure(absPath);
      if (!struct) {
        return {
          content: [{ type: "text", text: `File not found in index: ${filePath}` }],
        };
      }
      const symbolLines = struct.children.map(
        (n) => `  [${n.kind}] ${n.scopePath} line ${n.loc.start.line}`
      );
      return {
        content: [
          {
            type: "text",
            text: [
              `FILE: ${path.relative(repoRoot, struct.file.filePath)}`,
              "",
              `SYMBOLS (${struct.children.length}):`,
              ...symbolLines,
            ].join("\n"),
          },
        ],
      };
    }
  );

  server.tool(
    "find-callers",
    "Find all functions/methods that call a given function by name.",
    {
      functionName: z.string(),
      exact: z.boolean().optional().default(false),
    },
    async ({ functionName, exact }) => {
      if (!indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      }
      const targets = exact
        ? codeGraph.getNodesByName(functionName)
        : codeGraph
            .searchByName(functionName, 10)
            .filter((n) => n.kind === "function" || n.kind === "method");

      if (targets.length === 0) {
        return {
          content: [{ type: "text", text: `No function found named "${functionName}".` }],
        };
      }

      const sections: string[] = [];
      for (const target of targets) {
        const callers = codeGraph.getCallers(target.id);
        sections.push(
          `TARGET: ${target.scopePath}`,
          callers.length
            ? callers.map((c) => `  • ${c.scopePath}`).join("\n")
            : "  No callers found."
        );
      }
      return { content: [{ type: "text", text: sections.join("\n\n") }] };
    }
  );

  server.tool(
    "get-vue-component",
    "Get the API surface of a Vue SFC component.",
    { name: z.string().describe("Component name or partial path") },
    async ({ name }) => {
      if (!indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      }
      const candidates = codeGraph
        .searchByName(name, 20)
        .filter((n) => n.kind === "vue-component" || n.filePath.endsWith(".vue"));

      if (candidates.length === 0) {
        return {
          content: [{ type: "text", text: `No Vue component found matching "${name}".` }],
        };
      }

      const lines = candidates.slice(0, 5).map((cmp) => {
        const m = cmp.metadata;
        return [
          `COMPONENT: ${cmp.name}`,
          `  file: ${path.relative(repoRoot, cmp.filePath)}`,
          m.props ? `  props: ${(m.props as string[]).join(", ")}` : null,
          m.methods ? `  methods: ${(m.methods as string[]).join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      });

      return { content: [{ type: "text", text: lines.join("\n\n") }] };
    }
  );

  server.tool(
    "get-resolver-info",
    "Look up GraphQL resolver functions in the BFF.",
    { name: z.string().describe("Resolver field name or partial match") },
    async ({ name }) => {
      if (!indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      }
      const resolvers = codeGraph
        .searchByName(name, 30, "graphql-resolver")
        .filter((n) => n.filePath.includes("mdbff"));

      if (resolvers.length === 0) {
        return {
          content: [{ type: "text", text: `No BFF resolver found matching "${name}".` }],
        };
      }

      const lines = resolvers.map((r) => {
        const op = r.metadata.graphqlOperation ?? "?";
        return `[${op}] ${r.name} — ${path.relative(repoRoot, r.filePath)}:${r.loc.start.line}`;
      });

      return {
        content: [
          {
            type: "text",
            text: `Found ${resolvers.length} resolver(s):\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  return server;
}
