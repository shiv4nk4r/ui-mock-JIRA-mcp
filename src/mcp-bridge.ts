/**
 * MCP Bridge — InMemoryTransport-based MCP client for the chat pipeline.
 *
 * How the context actually flows to AI providers today vs. how it should:
 *
 * ❌ BEFORE (this file didn't exist):
 *   Chat route → fs.readFileSync() → raw strings → injected into system prompt
 *   MCP server (/api/mcp) was a completely separate endpoint for Claude Desktop / Cursor IDE only.
 *
 * ✅ AFTER (this bridge):
 *   Chat route → MCP Client (InMemoryTransport) → MCP Server → resources & tools
 *   The MCP protocol is respected. The chat route is now a proper MCP client.
 *   For Gemini: MCP tools are mapped to Gemini FunctionDeclarations so Gemini
 *   can call them dynamically in an agentic loop (no pre-baked prompt injection needed).
 *
 * InMemoryTransport means no HTTP round-trips — both client and server live in the
 * same Node.js process, communicating through an in-memory message queue.
 */

import { Client }            from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { McpServer }         from "@modelcontextprotocol/sdk/server/mcp.js";
import { z }                 from "zod";
import fs                    from "fs";
import path                  from "path";

import { codeGraph }                                      from "./parser/graph-store";
import { buildIndex, defaultConfig, tryLoadCache,
         defaultCachePath }                               from "./parser/indexer";
import type { NodeKind }                                  from "./parser/types";

// ── Context file loader ───────────────────────────────────────────────────────

const CONTEXT_DIR = path.join(process.cwd(), "src", "mcp-context");

function loadCtx(filename: string): string {
  return fs.readFileSync(path.join(CONTEXT_DIR, filename), "utf-8");
}

export function listProductScreenshots(): string[] {
  try {
    return fs
      .readdirSync(CONTEXT_DIR)
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .sort();
  } catch {
    return [];
  }
}

export function screenshotPath(filename: string): string {
  return path.join(CONTEXT_DIR, filename);
}

function extractSection(content: string, heading: string): string {
  const startIdx = content.indexOf(heading);
  if (startIdx === -1) return `⚠ Section "${heading}" not found.`;
  const afterStart = content.slice(startIdx + heading.length);
  const nextIdx    = afterStart.search(/\n## /);
  return nextIdx === -1
    ? content.slice(startIdx)
    : content.slice(startIdx, startIdx + heading.length + nextIdx);
}

// ── Section indexes (kept in sync with the HTTP MCP route) ───────────────────

const ARCH_SECTIONS = {
  "overview":    "## 1. Monorepo Overview",
  "stack":       "## 2. Technology Stack",
  "architecture":"## 3. Architecture",
  "data-flow":   "## 4. Data Flow & Request Lifecycle",
  "auth":        "## 5. Authentication & Session Management",
  "frontend":    "## 6. Frontend (mdui/)",
  "backend":     "## 7. Backend BFF (mdbff/)",
  "services":    "## 9. External Services & Integrations",
  "conventions": "## 11. Coding Standards & Conventions",
  "state":       "## 12. State Management",
  "routing":     "## 13. Routing Structure",
  "deployment":  "## 15. Deployment & Infrastructure",
} as const;

const DESIGN_SECTIONS = {
  "colors":        "## 2. Color System",
  "typography":    "## 3. Typography",
  "layout":        "## 4. Layout & Page Structure",
  "buttons":       "## 9. Buttons",
  "inputs":        "## 10. Form Inputs",
  "tables":        "## 11. Data Tables",
  "chips-badges":  "## 14. Status Chips & Badges",
  "charts":        "## 15. Charts",
  "modals":        "## 16. Modals / Dialogs",
  "patterns":      "## 24. Patterns — What Agents MUST Follow",
  "anti-patterns": "## 25. Anti-Patterns — What Agents MUST NEVER Do",
  "quick-ref":     "## 26. Quick Reference Card for Agents",
} as const;

const SITEMAP_SECTIONS = {
  "global-ui":      "## Global Persistent UI",
  "outbound":       "### 2. OUTBOUND",
  "inventory":      "### 7. INVENTORY",
  "shift-planning": "### 10. SHIFT PLANNING",
  "feature-flags":  "## Feature Flags Summary",
  "quick-reference":"## Full Sitemap at a Glance",
} as const;

// ── Code graph index state ────────────────────────────────────────────────────
// The graph is a module-level singleton (codeGraph) built once per process.
// `indexReady` tracks whether the initial scan has completed so tools can
// report a helpful "run rebuild-code-index first" message before it finishes.

let indexReady  = false;
let indexStatus = "Not yet indexed. Call rebuild-code-index first.";

/**
 * On first call: try to load the on-disk cache (instant).
 * If cache is missing or older than 24 h, kick off a background live index
 * and save the result back to the cache file.
 * Fire-and-forget — callers check `indexReady` / `indexStatus`.
 */
function ensureIndexed(repoRoot: string): void {
  if (indexReady) return;

  const cachePath = defaultCachePath(repoRoot);

  // Fast path — load from cache file
  const cacheResult = tryLoadCache(codeGraph, cachePath);
  if (cacheResult.loaded && cacheResult.meta) {
    const ageSec  = Math.round((cacheResult.ageMs ?? 0) / 1000);
    const stats   = codeGraph.stats();
    indexReady    = true;
    indexStatus   = `Loaded from cache (${ageSec}s old) | ${stats.totalNodes} nodes | ${stats.totalEdges} edges`;
    return;
  }

  // Slow path — full live index, then save to cache
  indexStatus = "Building index (first run or cache expired)…";
  buildIndex(codeGraph, defaultConfig(repoRoot))
    .then((r) => {
      indexReady  = true;
      indexStatus = `Indexed ${r.filesIndexed} files | ${r.totalNodes} nodes | ${r.totalEdges} edges | ${r.durationMs}ms | saved to cache`;
    })
    .catch((e) => {
      indexStatus = `Index error: ${(e as Error).message}`;
    });
}

// Derive repo root from this file's location (poc-mcp is one level above src/)
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

// ── MCP Server factory ────────────────────────────────────────────────────────
// Creates a fresh server instance each call to avoid shared-state issues
// between the HTTP route (SSE transport) and the chat bridge (InMemoryTransport).

function buildServer(): McpServer {
  const server = new McpServer({ name: "pm-context-bridge", version: "2.0.0" });

  // ── Resources ──────────────────────────────────────────────────────────────
  server.registerResource(
    "architecture-context",
    "resource://docs/architecture",
    { mimeType: "text/markdown", description: "Full system architecture, tech stack, data flow, conventions" },
    async () => ({ contents: [{ uri: "resource://docs/architecture", mimeType: "text/markdown", text: loadCtx("context.md") }] })
  );

  server.registerResource(
    "design-language",
    "resource://docs/design",
    { mimeType: "text/markdown", description: "Quasar Vue 2 design language: colors, components, patterns" },
    async () => ({ contents: [{ uri: "resource://docs/design", mimeType: "text/markdown", text: loadCtx("design.md") }] })
  );

  server.registerResource(
    "sitemap-context",
    "resource://docs/sitemap",
    { mimeType: "text/markdown", description: "Navigation sitemap: L1 tabs, sub-tabs, routes, feature flags" },
    async () => ({ contents: [{ uri: "resource://docs/sitemap", mimeType: "text/markdown", text: loadCtx("site-map.md") }] })
  );

  server.registerResource(
    "component-library",
    "resource://docs/component-library",
    { mimeType: "text/markdown", description: "Pre-built HTML+CSS snippets for Manager Dashboard. Copy BASE CSS BLOCK verbatim — do not re-derive." },
    async () => ({ contents: [{ uri: "resource://docs/component-library", mimeType: "text/markdown", text: loadCtx("component-library.md") }] })
  );

  // ── Tools ──────────────────────────────────────────────────────────────────

  server.tool(
    "list-product-screenshots",
    "Lists all product screenshot PNG files in the context directory. Read them with the Read tool to match the actual Manager Dashboard UI when generating mockups.",
    async () => {
      const files = listProductScreenshots();
      const lines = files.map((f) => `${path.join(CONTEXT_DIR, f)}`).join("\n");
      return {
        content: [{ type: "text", text: files.length
          ? `Available product screenshots (read these with the Read tool to match the actual UI):\n${lines}`
          : "No product screenshots found in context directory."
        }],
      };
    }
  );

  server.tool(
    "query-architecture",
    {
      section:  z.enum(Object.keys(ARCH_SECTIONS) as [string, ...string[]]).describe(`Architecture section. Options: ${Object.keys(ARCH_SECTIONS).join(", ")}`),
      question: z.string().optional().describe("Specific question about the section"),
    },
    async ({ section, question }) => {
      const content = extractSection(loadCtx("context.md"), ARCH_SECTIONS[section as keyof typeof ARCH_SECTIONS]);
      return { content: [{ type: "text", text: content }, ...(question ? [{ type: "text" as const, text: `\n**Question:** ${question}` }] : [])] };
    }
  );

  server.tool(
    "query-design-language",
    {
      section:   z.enum(Object.keys(DESIGN_SECTIONS) as [string, ...string[]]).describe(`Design section. Options: ${Object.keys(DESIGN_SECTIONS).join(", ")}`),
      component: z.string().optional().describe("Specific Quasar component to find"),
    },
    async ({ section, component }) => {
      const content = extractSection(loadCtx("design.md"), DESIGN_SECTIONS[section as keyof typeof DESIGN_SECTIONS]);
      return { content: [{ type: "text", text: content }, ...(component ? [{ type: "text" as const, text: `\n**Looking up:** ${component}` }] : [])] };
    }
  );

  server.tool(
    "query-sitemap",
    {
      section: z.enum(Object.keys(SITEMAP_SECTIONS) as [string, ...string[]]).describe(`Sitemap section. Options: ${Object.keys(SITEMAP_SECTIONS).join(", ")}`),
    },
    async ({ section }) => {
      const content = extractSection(loadCtx("site-map.md"), SITEMAP_SECTIONS[section as keyof typeof SITEMAP_SECTIONS]);
      return { content: [{ type: "text", text: content }] };
    }
  );

  // ── Code-graph tools ────────────────────────────────────────────────────────

  // Kick off background indexing as soon as a server instance is created
  ensureIndexed(REPO_ROOT);

  /**
   * rebuild-code-index
   * Forces a full re-scan of mdui/ and mdbff/ and rebuilds the graph.
   * Useful after large code changes.
   */
  server.tool(
    "rebuild-code-index",
    "Re-index the mdui/ and mdbff/ source trees. Returns stats on completion. Takes ~15–30s for the full codebase.",
    async () => {
      indexReady  = false;
      indexStatus = "Rebuilding…";
      try {
        const r    = await buildIndex(codeGraph, defaultConfig(REPO_ROOT));
        indexReady  = true;
        const cachePath = defaultCachePath(REPO_ROOT);
        indexStatus = `Indexed ${r.filesIndexed} files | ${r.totalNodes} nodes | ${r.totalEdges} edges | ${r.durationMs}ms | cache: ${cachePath}`;
        const stats = codeGraph.stats();
        return {
          content: [{
            type:  "text",
            text:  [
              `✓ Index complete in ${r.durationMs}ms`,
              `  Files indexed : ${r.filesIndexed}`,
              `  Files errored : ${r.filesErrored}`,
              `  Total nodes   : ${r.totalNodes}`,
              `  Total edges   : ${r.totalEdges}`,
              `  Cache saved   : ${cachePath}`,
              "",
              "Kind breakdown:",
              ...Object.entries(stats)
                .filter(([k]) => !["totalNodes","totalEdges","indexedFiles"].includes(k))
                .map(([k, v]) => `  ${k.padEnd(22)} ${v}`),
              ...(r.errors.length
                ? ["", `Sample errors (${r.errors.length} total):`,
                   ...r.errors.slice(0, 5).map(e => `  ${path.basename(e.file)}: ${e.error.slice(0,80)}`)]
                : []),
            ].join("\n"),
          }],
        };
      } catch (e) {
        indexStatus = `Index error: ${(e as Error).message}`;
        return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }] };
      }
    }
  );

  /**
   * search-code-symbols
   * Fuzzy name search across all indexed nodes.
   */
  server.tool(
    "search-code-symbols",
    {
      query:  z.string().describe("Name fragment to search for (case-insensitive). Searches functions, classes, methods, Vue components, GraphQL resolvers."),
      kind:   z.enum(["function","class","method","variable","vue-component","graphql-type","graphql-operation","graphql-resolver","file"])
               .optional()
               .describe("Filter by node kind"),
      limit:  z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
    },
    async ({ query, kind, limit: rawLimit }) => {
      const limit = rawLimit ?? 20;
      if (!indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      }
      const results = codeGraph.searchByName(query, limit, kind as NodeKind | undefined);
      if (results.length === 0) {
        return { content: [{ type: "text", text: `No symbols found matching "${query}"${kind ? ` (kind: ${kind})` : ""}.` }] };
      }
      const lines = results.map((n) => {
        const meta: string[] = [];
        if (n.metadata.isExported) meta.push("exported");
        if (n.metadata.isAsync)    meta.push("async");
        if (n.metadata.params?.length) meta.push(`params: ${(n.metadata.params as string[]).join(", ")}`);
        const relFile = path.relative(REPO_ROOT, n.filePath);
        return [
          `[${n.kind}] ${n.scopePath}`,
          `  file  : ${relFile}`,
          `  loc   : line ${n.loc.start.line}–${n.loc.end.line}`,
          ...(meta.length ? [`  meta  : ${meta.join(" | ")}`] : []),
        ].join("\n");
      });
      return {
        content: [{
          type: "text",
          text: `Found ${results.length} symbol(s) matching "${query}":\n\n${lines.join("\n\n")}`,
        }],
      };
    }
  );

  /**
   * get-file-structure
   * Returns all symbols in a file + its import/export edges.
   */
  server.tool(
    "get-file-structure",
    "List all symbols (functions, classes, methods, Vue components, resolvers) defined in a source file, plus its import and reverse-import edges.",
    {
      filePath: z.string().describe("Relative path from repo root, e.g. mdui/src/pages/outbound/v2/listing/Listing.vue"),
    },
    async ({ filePath }) => {
      if (!indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      }
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(REPO_ROOT, filePath);
      const struct  = codeGraph.getFileStructure(absPath);
      if (!struct) {
        return { content: [{ type: "text", text: `File not found in index: ${filePath}\nTry rebuild-code-index if you recently added this file.` }] };
      }

      const importLines = struct.imports.map((e) => {
        const target = codeGraph.getNode(e.toId);
        const rel    = target ? path.relative(REPO_ROOT, target.filePath) : e.toId;
        return `  → ${rel}${e.label ? ` (${e.label})` : ""}`;
      });
      const importedByLines = struct.importedBy.map((e) => {
        const src = codeGraph.getNode(e.fromId);
        const rel = src ? path.relative(REPO_ROOT, src.filePath) : e.fromId;
        return `  ← ${rel}`;
      });
      const symbolLines = struct.children.map((n) => {
        const meta: string[] = [];
        if (n.metadata.isExported) meta.push("exported");
        if (n.metadata.isAsync)    meta.push("async");
        if (n.metadata.isStatic)   meta.push("static");
        return `  [${n.kind.padEnd(18)}] ${n.scopePath.padEnd(40)} line ${n.loc.start.line}` +
               (meta.length ? `  { ${meta.join(" | ")} }` : "");
      });

      const lines = [
        `FILE: ${path.relative(REPO_ROOT, struct.file.filePath)}`,
        "",
        `SYMBOLS (${struct.children.length}):`,
        ...symbolLines,
        "",
        `IMPORTS (${importLines.length}):`,
        ...(importLines.length ? importLines : ["  (none)"]),
        "",
        `IMPORTED BY (${importedByLines.length}):`,
        ...(importedByLines.length ? importedByLines : ["  (none)"]),
      ];
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  /**
   * find-callers
   * Reverse call-edge lookup — who calls a given function or method.
   */
  server.tool(
    "find-callers",
    "Find all functions/methods that call a given function by name. Useful for impact analysis and tracing data flow.",
    {
      functionName: z.string().describe("Exact or partial name of the function/method to look up"),
      exact:        z.boolean().optional().default(false).describe("true = exact match only"),
    },
    async ({ functionName, exact }) => {
      if (!indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      }
      const targets = exact
        ? codeGraph.getNodesByName(functionName)
        : codeGraph.searchByName(functionName, 10, undefined).filter(
            (n) => n.kind === "function" || n.kind === "method" || n.kind === "graphql-resolver"
          );

      if (targets.length === 0) {
        return { content: [{ type: "text", text: `No function/method found named "${functionName}".` }] };
      }

      const sections: string[] = [];
      for (const target of targets) {
        const callers = codeGraph.getCallers(target.id);
        const relFile = path.relative(REPO_ROOT, target.filePath);
        sections.push(
          `TARGET: [${target.kind}] ${target.scopePath}  (${relFile}:${target.loc.start.line})`,
          callers.length === 0
            ? "  No callers found in indexed codebase."
            : `  Called by ${callers.length} location(s):`,
          ...callers.map((c) => {
            const cf = path.relative(REPO_ROOT, c.filePath);
            return `    • [${c.kind}] ${c.scopePath}  (${cf}:${c.loc.start.line})`;
          }),
        );
      }
      return { content: [{ type: "text", text: sections.join("\n") }] };
    }
  );

  /**
   * get-vue-component
   * Returns the full API surface of a Vue component: props, data, computed, methods,
   * mixins, apollo queries, used sub-components, and import edges.
   */
  server.tool(
    "get-vue-component",
    "Get the full API surface of a Vue SFC component: props, data, computed, methods, apollo queries, mixins, and sub-components it uses.",
    {
      name: z.string().describe("Component name (e.g. 'Listing', 'OrderSummary') or partial path"),
    },
    async ({ name }) => {
      if (!indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      }

      const candidates = codeGraph
        .searchByName(name, 20)
        .filter((n) => n.kind === "vue-component" || (n.kind === "file" && n.filePath.endsWith(".vue")));

      if (candidates.length === 0) {
        return { content: [{ type: "text", text: `No Vue component found matching "${name}".` }] };
      }

      const lines: string[] = [];
      for (const cmp of candidates.slice(0, 5)) {
        const relFile = path.relative(REPO_ROOT, cmp.filePath);
        const m       = cmp.metadata;
        const section = (label: string, items: unknown) => {
          const arr = Array.isArray(items) ? items as string[] : [];
          return arr.length ? `  ${label}: ${arr.join(", ")}` : null;
        };
        lines.push(
          `COMPONENT: ${cmp.name}`,
          `  file     : ${relFile}`,
          `  loc      : line ${cmp.loc.start.line}–${cmp.loc.end.line}`,
          ...[
            section("props",        m.props),
            section("data keys",    m.dataKeys),
            section("computed",     m.computed),
            section("methods",      m.methods),
            section("mixins",       m.mixins),
            section("apollo",       m.apolloQueries),
            section("components",   m.components),
            section("emits",        m.emits),
          ].filter(Boolean) as string[],
          "",
        );
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  /**
   * get-resolver-info
   * Returns all GraphQL resolver nodes in a BFF resolver file, with the
   * GraphQL operation type they serve (Query/Mutation/Subscription/type).
   */
  server.tool(
    "get-resolver-info",
    "Look up GraphQL resolver functions in the BFF (mdbff). Returns the operation type (Query/Mutation/Subscription), resolver name, and file location.",
    {
      name: z.string().describe("Resolver field name or partial match (e.g. 'outboundOrderList', 'inventory')"),
    },
    async ({ name }) => {
      if (!indexReady) {
        return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      }

      const resolvers = codeGraph
        .searchByName(name, 30, "graphql-resolver")
        .filter((n) => n.filePath.includes("mdbff"));

      if (resolvers.length === 0) {
        return { content: [{ type: "text", text: `No BFF resolver found matching "${name}".` }] };
      }

      const lines = resolvers.map((r) => {
        const relFile = path.relative(REPO_ROOT, r.filePath);
        const op      = r.metadata.graphqlOperation ?? "?";
        const params  = (r.metadata.params as string[] | undefined)?.join(", ") ?? "";
        return [
          `[${op}] ${r.name}`,
          `  file   : ${relFile}:${r.loc.start.line}`,
          `  params : ${params || "(none)"}`,
          `  async  : ${r.metadata.isAsync ? "yes" : "no"}`,
        ].join("\n");
      });

      return {
        content: [{
          type: "text",
          text: `Found ${resolvers.length} resolver(s) matching "${name}":\n\n${lines.join("\n\n")}`,
        }],
      };
    }
  );

  return server;
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface McpClientHandle {
  client: Client;
  close: () => Promise<void>;
}

/**
 * Creates a connected MCP client via InMemoryTransport.
 *
 * No network involved — both client and server communicate through an in-memory
 * message queue in the same process. This is the canonical way to use MCP
 * context in a server-side function without exposing an HTTP endpoint.
 *
 * Always call close() when done to release resources.
 */
export async function createMcpClient(): Promise<McpClientHandle> {
  const server = buildServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);

  const client = new Client(
    { name: "chat-bridge", version: "1.0.0" },
    { capabilities: {} }
  );
  await client.connect(clientTransport);

  return { client, close: () => client.close() };
}

export interface FetchedContext {
  architecture: string;
  design: string;
  sitemap: string;
  componentLibrary: string;
}

/**
 * Fetches all three context resources via MCP (architecture, design, sitemap).
 *
 * Use this for providers that need context injected into a system prompt
 * (Claude, OpenAI). Gemini uses createMcpClient() directly so it can also
 * call tools via function-calling in an agentic loop.
 */
export async function fetchContextResources(): Promise<FetchedContext> {
  const { client, close } = await createMcpClient();
  try {
    const [archRes, designRes, sitemapRes, compLibRes] = await Promise.all([
      client.readResource({ uri: "resource://docs/architecture" }),
      client.readResource({ uri: "resource://docs/design" }),
      client.readResource({ uri: "resource://docs/sitemap" }),
      client.readResource({ uri: "resource://docs/component-library" }),
    ]);
    const txt = (r: { contents: unknown[] }) =>
      ((r.contents[0] as Record<string, unknown>)?.text as string) ?? "";
    return {
      architecture:    txt(archRes),
      design:          txt(designRes),
      sitemap:         txt(sitemapRes),
      componentLibrary: txt(compLibRes),
    };
  } finally {
    await close();
  }
}

// ── Gemini tool schema conversion ─────────────────────────────────────────────

type GeminiSchema = Record<string, unknown>;

/**
 * Converts an MCP tool's JSON Schema (generated by Zod) into the schema object
 * expected by Gemini's FunctionDeclaration.parameters field.
 *
 * Gemini uses SchemaType enum strings ("STRING", "OBJECT", etc.) instead of
 * lowercase JSON Schema type names.
 */
export function mcpSchemaToGemini(jsonSchema: Record<string, unknown>): GeminiSchema {
  const TYPE_MAP: Record<string, string> = {
    string:  "STRING",
    number:  "NUMBER",
    integer: "INTEGER",
    boolean: "BOOLEAN",
    array:   "ARRAY",
    object:  "OBJECT",
  };

  const result: GeminiSchema = {
    type: TYPE_MAP[(jsonSchema.type as string) ?? "string"] ?? "STRING",
  };

  if (jsonSchema.description) result.description = jsonSchema.description;
  if (jsonSchema.enum)        result.enum = jsonSchema.enum;

  if (jsonSchema.properties && typeof jsonSchema.properties === "object") {
    result.properties = Object.fromEntries(
      Object.entries(jsonSchema.properties as Record<string, unknown>).map(
        ([k, v]) => [k, mcpSchemaToGemini(v as Record<string, unknown>)]
      )
    );
  }

  if (jsonSchema.required) result.required = jsonSchema.required;
  if (jsonSchema.items)    result.items = mcpSchemaToGemini(jsonSchema.items as Record<string, unknown>);

  return result;
}

/**
 * Lists all MCP tools and converts them to Gemini FunctionDeclaration objects.
 * Pass the result directly to Gemini's tools: [{ functionDeclarations }] field.
 */
export async function listMcpToolsAsGeminiDeclarations(
  client: Client
): Promise<GeminiSchema[]> {
  const { tools } = await client.listTools();
  return tools.map((tool) => ({
    name:        tool.name,
    description: tool.description ?? "",
    parameters:  mcpSchemaToGemini(tool.inputSchema as Record<string, unknown>),
  }));
}
