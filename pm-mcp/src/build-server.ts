/**
 * MCP server factory — session-scoped code graph + bundled context resources.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import type { NodeKind } from "./parser/types";
import type { SessionContext } from "./session-manager";
import type { RepoManager } from "./repo-manager";
import type { SessionManager } from "./session-manager";
import { registerFilesystemTools } from "./filesystem-tools";
import {
  findBrandAssets,
  formatAssetCatalog,
  readBrandAssetForEmbed,
  resolveBrandAsset,
  scanBrandAssets,
} from "./brand-assets";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTEXT_DIR = path.join(__dirname, "context");

export interface McpServerDeps {
  repoManager: RepoManager;
  sessionManager: SessionManager;
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

export function buildMcpServer(ctx: SessionContext, deps: McpServerDeps): McpServer {
  const { repoManager, sessionManager } = deps;
  const activeRepoRoot = () => repoManager.getRepoRoot();
  const { graph } = ctx;

  const server = new McpServer({ name: "pm-context-server", version: "2.1.0" });

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
    "get-repo-status",
    "Returns the active git branch, commit SHA, index status, and last sync time for this session.",
    async () => {
      const repoState = repoManager.getCurrentState();
      return {
        content: [
          {
            type: "text",
            text: [
              "## Repository Status",
              `- **Session branch:** ${ctx.branch}`,
              `- **Session commit:** ${ctx.commit}`,
              `- **Checkout path:** ${activeRepoRoot()}`,
              `- **Main clone:** ${repoManager.getMainRepoPath()}`,
              `- **Worktrees dir:** ${repoManager.getWorktreesDir()}`,
              `- **Index ready:** ${ctx.indexReady}`,
              `- **Index status:** ${ctx.indexStatus}`,
              repoState
                ? `- **Repo HEAD:** ${repoState.branch} @ ${repoState.commit.slice(0, 7)}`
                : "",
              repoState ? `- **Last synced:** ${repoState.lastSyncedAt}` : "",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    }
  );

  server.tool(
    "switch-branch",
    {
      branch: z.string().describe("Branch name to checkout (e.g. develop, feature/GM-123)"),
      forcePull: z
        .boolean()
        .optional()
        .default(true)
        .describe("Pull latest from origin after checkout"),
    },
    async ({ branch, forcePull }) => {
      try {
        await sessionManager.switchBranch(ctx, branch, forcePull);
        return {
          content: [
            {
              type: "text",
              text: [
                `✓ Switched session to branch **${ctx.branch}** @ ${ctx.commit.slice(0, 7)}`,
                ctx.indexReady
                  ? `Index ready: ${ctx.indexStatus}`
                  : `Index status: ${ctx.indexStatus}`,
              ].join("\n"),
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to switch branch: ${(e as Error).message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "list-branches",
    "Lists remote branches available on origin.",
    async () => {
      try {
        const branches = await repoManager.listBranches();
        return {
          content: [
            {
              type: "text",
              text: branches.length
                ? `Remote branches (${branches.length}):\n${branches.map((b) => `  • ${b}`).join("\n")}`
                : "No remote branches found.",
            },
          ],
        };
      } catch (e) {
        return {
          content: [{ type: "text", text: `Error listing branches: ${(e as Error).message}` }],
        };
      }
    }
  );

  server.tool(
    "list-product-screenshots",
    "Lists reference screenshot PNGs bundled in pm-mcp context (not repo icons). For UI icons/logos use list-brand-icons instead.",
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
              ? `Available product screenshots (context docs only):\n${lines}\n\nFor official UI icons/logos in mockups, call list-brand-icons.`
              : "No product screenshots in context directory. Use list-brand-icons for repo icons.",
          },
        ],
      };
    }
  );

  server.tool(
    "list-brand-icons",
    "List official Manager Dashboard icons and logos from mdui/public/ in the active repo checkout. REQUIRED before using icons in HTML mockups — do not invent or hallucinate brand icons.",
    {
      query: z
        .string()
        .optional()
        .describe("Optional filter, e.g. inventory, audit, listing, logos, gxo"),
      category: z
        .enum(["icons", "logos", "asset", "all"])
        .optional()
        .default("all")
        .describe("Restrict to icons/, logos/, or other public root assets"),
    },
    async ({ query, category }) => {
      const repoRoot = activeRepoRoot();
      const all = scanBrandAssets(repoRoot);
      if (all.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No brand assets found under ${path.join(repoRoot, "mdui/public")}. Ensure the repo checkout is ready (get-repo-status).`,
            },
          ],
        };
      }

      let filtered =
        category === "all" ? all : all.filter((a) => a.category === category);
      if (query) filtered = findBrandAssets(filtered, query, 100);

      if (filtered.length === 0) {
        const suggestions = query ? findBrandAssets(all, query, 8) : all.slice(0, 8);
        return {
          content: [
            {
              type: "text",
              text: [
                `No brand assets matched query "${query ?? ""}" (category: ${category}).`,
                suggestions.length ? `Try:\n${suggestions.map((s) => s.appPath).join("\n")}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `Branch: ${ctx.branch} · Repo: ${repoRoot}`,
              "",
              formatAssetCatalog(filtered),
            ].join("\n"),
          },
        ],
      };
    }
  );

  server.tool(
    "get-brand-icon",
    "Fetch an official icon or logo from mdui/public/ for embedding in HTML mockups. Returns data-uri img tag + SVG source when applicable. NEVER hand-draw icons if this tool can supply the asset.",
    {
      name: z
        .string()
        .describe(
          "App path or keyword, e.g. /icons/inventory/audit.png, icons/listing/fav-filter.png, logos/gxo.png, audit"
        ),
    },
    async ({ name }) => {
      const repoRoot = activeRepoRoot();
      const assets = scanBrandAssets(repoRoot);
      const asset = resolveBrandAsset(assets, name);

      if (!asset) {
        const suggestions = findBrandAssets(assets, name, 8);
        return {
          content: [
            {
              type: "text",
              text: [
                `No brand icon found for "${name}".`,
                suggestions.length
                  ? `Did you mean:\n${suggestions.map((s) => `  ${s.appPath}`).join("\n")}\n\nCall list-brand-icons to browse all assets.`
                  : "Call list-brand-icons to browse available assets.",
              ].join("\n"),
            },
          ],
        };
      }

      const embed = readBrandAssetForEmbed(asset.absolutePath, asset.appPath);
      const textParts = [
        `Official asset: ${asset.appPath}`,
        `Category: ${asset.category}`,
        `File: ${path.relative(repoRoot, asset.absolutePath)}`,
        "",
        "Use this in standalone HTML mockups (iframe srcDoc — relative /icons/ paths will NOT work):",
        embed.embeddingHtml,
      ];

      if (embed.rawSvg) {
        textParts.push("", "Raw SVG (may inline instead of img):", embed.rawSvg.slice(0, 12_000));
      }

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [{ type: "text", text: textParts.join("\n") }];

      if (embed.base64 && !embed.rawSvg && embed.mimeType.startsWith("image/")) {
        content.push({
          type: "image",
          data: embed.base64,
          mimeType: embed.mimeType,
        });
      }

      return { content };
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
      const doc = loadCtx("context.md");
      return {
        content: [
          {
            type: "text",
            text: [
              `## Layer Impact Analysis — ${ticketSummary}`,
              `**Description excerpt:** ${ticketDescription.slice(0, 400)}`,
              "",
              extractSection(doc, "## 3. Architecture"),
              "",
              extractSection(doc, "## 6. Frontend (mdui/)"),
              "",
              extractSection(doc, "## 7. Backend BFF (mdbff/)"),
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

  void sessionManager.ensureIndexed(ctx);

  server.tool(
    "rebuild-code-index",
    "Re-index the mdui/ and mdbff/ source trees for this session's active branch.",
    async () => {
      try {
        const status = await sessionManager.rebuildIndex(ctx);
        return {
          content: [{ type: "text", text: `✓ ${status}` }],
        };
      } catch (e) {
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
      if (!ctx.indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${ctx.indexStatus}` }] };
      }
      const results = graph.searchByName(query, limit, kind as NodeKind | undefined);
      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `No symbols found matching "${query}".` }],
        };
      }
      const lines = results.map((n) => {
        const relFile = path.relative(activeRepoRoot(), n.filePath);
        return `[${n.kind}] ${n.scopePath} (${relFile}:${n.loc.start.line})`;
      });
      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} symbol(s) on **${ctx.branch}**:\n${lines.join("\n")}`,
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
      if (!ctx.indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${ctx.indexStatus}` }] };
      }
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(activeRepoRoot(), filePath);
      const struct = graph.getFileStructure(absPath);
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
              `FILE: ${path.relative(activeRepoRoot(), struct.file.filePath)} (branch: ${ctx.branch})`,
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
      if (!ctx.indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${ctx.indexStatus}` }] };
      }
      const targets = exact
        ? graph.getNodesByName(functionName)
        : graph
            .searchByName(functionName, 10)
            .filter((n) => n.kind === "function" || n.kind === "method");

      if (targets.length === 0) {
        return {
          content: [{ type: "text", text: `No function found named "${functionName}".` }],
        };
      }

      const sections: string[] = [];
      for (const target of targets) {
        const callers = graph.getCallers(target.id);
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
    "Get the API surface of a Vue SFC component (props, methods, computed). Use read_text_file on the path for full source.",
    { name: z.string().describe("Component name or partial file path (e.g. Listing, outbound/listing)") },
    async ({ name }) => {
      if (!ctx.indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${ctx.indexStatus}` }] };
      }

      const q = name.toLowerCase();
      const byName = graph
        .searchByName(name, 30)
        .filter((n) => n.kind === "vue-component" || n.filePath.endsWith(".vue"));
      const byPath = graph
        .getNodesByKind("vue-component")
        .filter((n) => n.filePath.toLowerCase().includes(q));

      const seen = new Set<string>();
      const candidates = [...byName, ...byPath].filter((n) => {
        if (seen.has(n.id)) return false;
        seen.add(n.id);
        return true;
      });

      candidates.sort((a, b) => {
        const aExact = a.name.toLowerCase() === q ? 0 : 1;
        const bExact = b.name.toLowerCase() === q ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        return a.filePath.localeCompare(b.filePath);
      });

      if (candidates.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: [
                `No Vue component found matching "${name}".`,
                `Active checkout: ${activeRepoRoot()} (branch: ${ctx.branch})`,
                "Try search_files with pattern **/*Listing*.vue or rebuild-code-index.",
              ].join("\n"),
            },
          ],
        };
      }

      const formatComponent = (cmp: (typeof candidates)[0]) => {
        const m = cmp.metadata as Record<string, unknown>;
        const rel = path.relative(activeRepoRoot(), cmp.filePath);
        return [
          `COMPONENT: ${cmp.name}`,
          `  file: ${rel}`,
          `  path: ${cmp.filePath}`,
          m.props ? `  props: ${(m.props as string[]).join(", ")}` : null,
          m.methods ? `  methods: ${(m.methods as string[]).join(", ")}` : null,
          m.computed ? `  computed: ${(m.computed as string[]).join(", ")}` : null,
          m.dataKeys ? `  data: ${(m.dataKeys as string[]).join(", ")}` : null,
          m.mixins ? `  mixins: ${(m.mixins as string[]).join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n");
      };

      const shown = candidates.slice(0, 10);
      const suffix =
        candidates.length > shown.length
          ? `\n\n… and ${candidates.length - shown.length} more. Refine your query.`
          : "";

      return {
        content: [
          {
            type: "text",
            text: `${shown.map(formatComponent).join("\n\n")}${suffix}`,
          },
        ],
      };
    }
  );

  server.tool(
    "get-resolver-info",
    "Look up GraphQL resolver functions in the BFF.",
    { name: z.string().describe("Resolver field name or partial match") },
    async ({ name }) => {
      if (!ctx.indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${ctx.indexStatus}` }] };
      }
      const resolvers = graph
        .searchByName(name, 30, "graphql-resolver")
        .filter((n) => n.filePath.includes("mdbff"));

      if (resolvers.length === 0) {
        return {
          content: [{ type: "text", text: `No BFF resolver found matching "${name}".` }],
        };
      }

      const lines = resolvers.map((r) => {
        const op = r.metadata.graphqlOperation ?? "?";
        return `[${op}] ${r.name} — ${path.relative(activeRepoRoot(), r.filePath)}:${r.loc.start.line}`;
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

  registerFilesystemTools(server);

  return server;
}
