/**
 * Shared MCP tool factory for the manager-dashboard codebase.
 *
 * Exported by both the stdio entry point (md-mcp-server.ts) and the
 * HTTP entry point (mcp-http-server.ts) so tool definitions live in one place.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { homedir } from "os";
import { execFileSync } from "child_process";
import fg from "fast-glob";
import { GraphStore } from "./parser/graph-store.js";
import { buildIndex, tryLoadCache, defaultConfig } from "./parser/indexer.js";
import type { NodeKind } from "./parser/types.js";
import {
  resolveCaptureLabel,
  formatCapturedPages,
  surveyPageTemplates,
  getPageTemplateText,
  getPageTemplatesBatchText,
} from "./capture-catalog.js";
import type { PageArchetype } from "./crawler/capture-store.js";

// ── Repo paths ────────────────────────────────────────────────────────────────

const REPO_ROOT = process.env.MD_REPO_ROOT ?? "/Users/manish.c/workplace/manager-dashboard";
const MDUI      = path.join(REPO_ROOT, "mdui/src");
const MDBFF     = path.join(REPO_ROOT, "mdbff/src");

// Cap individual file reads so Claude's context isn't flooded
const MAX_FILE_CHARS = 12_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function readFileSafe(abs: string): string {
  try {
    const content = fs.readFileSync(abs, "utf-8");
    if (content.length > MAX_FILE_CHARS) {
      return content.slice(0, MAX_FILE_CHARS) + `\n\n... [truncated — ${content.length} total chars]`;
    }
    return content;
  } catch {
    return `[Error: could not read ${abs}]`;
  }
}

function grepFiles(pattern: string, dir: string, exts = ["*.vue", "*.js", "*.mjs"]): string[] {
  try {
    const includeArgs = exts.flatMap((e) => ["--include", e]);
    const output = execFileSync(
      "grep",
      ["-rl", "-F", ...includeArgs, pattern, dir],
      { encoding: "utf-8", maxBuffer: 512 * 1024 }
    ).trim();
    return output ? output.split("\n").filter(Boolean) : [];
  } catch (e: any) {
    const stdout: string = e.stdout ?? "";
    return stdout.trim() ? stdout.trim().split("\n").filter(Boolean) : [];
  }
}

function relPath(abs: string): string {
  return abs.startsWith(REPO_ROOT) ? abs.slice(REPO_ROOT.length + 1) : abs;
}

// ── Shared code graph ─────────────────────────────────────────────────────────
// One GraphStore per process. Both stdio and HTTP modes share this instance.

export const graph      = new GraphStore();
export const CACHE_PATH = path.join(homedir(), ".pm-orchestrator", "manager-dashboard-code-graph.json");
export let   indexReady  = false;
export let   indexStatus = "Not yet indexed — index starts automatically on server start.";

export function ensureIndexed(): void {
  if (indexReady) return;

  const cacheResult = tryLoadCache(graph, CACHE_PATH);
  if (cacheResult.loaded) {
    const ageSec  = Math.round((cacheResult.ageMs ?? 0) / 1000);
    const stats   = graph.stats();
    indexReady    = true;
    indexStatus   = `Loaded from cache (${ageSec}s old) | ${stats.totalNodes} nodes | ${stats.totalEdges} edges`;
    return;
  }

  indexStatus = "Building index (first run or cache expired) — tools available once done…";
  const cfg = { ...defaultConfig(REPO_ROOT), cachePath: CACHE_PATH };
  buildIndex(graph, cfg)
    .then((r) => {
      indexReady  = true;
      indexStatus = `Indexed ${r.filesIndexed} files | ${r.totalNodes} nodes | ${r.totalEdges} edges | ${r.durationMs}ms`;
    })
    .catch((e: Error) => {
      indexStatus = `Index error: ${e.message}`;
    });
}

// ── Tool factory ──────────────────────────────────────────────────────────────
// Call once per McpServer instance. All tools close over the shared graph.

export function createMdMcpServer(): McpServer {
  const server = new McpServer({ name: "md", version: "1.0.0" });

  // ── Tool 1: list-routes ────────────────────────────────────────────────────
  server.tool(
    "list-routes",
    {
      filter: z.string().optional().describe(
        "Optional domain to filter (e.g. 'outbound', 'inbound', 'inventory'). Omit for all routes."
      ),
    },
    async ({ filter }) => {
      const routeFile = path.join(MDUI, "router/routes.js");
      let content = readFileSafe(routeFile);
      if (filter) {
        const lines    = content.split("\n");
        const relevant = lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()));
        content = relevant.length ? relevant.join("\n") : content;
      }
      return {
        content: [{ type: "text", text: `## Vue Router routes (${relPath(routeFile)})\n\n${content}` }],
      };
    }
  );

  // ── Tool 2: find-components ───────────────────────────────────────────────
  server.tool(
    "find-components",
    {
      query: z.string().describe(
        "Name fragment or domain to search for (e.g. 'OrderListing', 'outbound', 'inventory/listing')"
      ),
      type: z
        .enum(["component", "page", "any"])
        .default("any")
        .describe("Restrict search: 'component' → components/, 'page' → pages/, 'any' → both"),
    },
    async ({ query, type }) => {
      const searchDirs: { label: string; dir: string }[] = [];
      if (type !== "page") searchDirs.push({ label: "components", dir: path.join(MDUI, "components") });
      if (type !== "component") searchDirs.push({ label: "pages", dir: path.join(MDUI, "pages") });

      const q = query.toLowerCase().replace(/\//g, path.sep.toLowerCase());
      const matches: string[] = [];

      for (const { dir } of searchDirs) {
        const files = await fg("**/*.vue", { cwd: dir, absolute: true });
        for (const f of files) {
          const rel = relPath(f).toLowerCase();
          if (rel.includes(q) || path.basename(f).toLowerCase().replace(".vue", "").includes(q)) {
            matches.push(relPath(f));
          }
        }
      }

      if (matches.length === 0) {
        return { content: [{ type: "text", text: `No components found matching "${query}".` }] };
      }

      const shown = matches.slice(0, 40);
      const list  = shown.map((f) => `- ${f}`).join("\n");
      const tail  = matches.length > 40 ? `\n... and ${matches.length - 40} more` : "";
      return {
        content: [{ type: "text", text: `## Components matching "${query}" (${matches.length} total)\n\n${list}${tail}` }],
      };
    }
  );

  // ── Tool 3: read-source-file ──────────────────────────────────────────────
  server.tool(
    "read-source-file",
    {
      path: z.string().describe(
        "Repo-relative path (e.g. 'mdui/src/pages/outbound/listing/Listing.vue')"
      ),
    },
    async ({ path: filePath }) => {
      const abs = path.resolve(REPO_ROOT, filePath);
      if (!abs.startsWith(REPO_ROOT)) {
        return { content: [{ type: "text", text: "Error: path must be inside the repo root." }] };
      }
      if (!fs.existsSync(abs)) {
        return { content: [{ type: "text", text: `File not found: ${filePath}` }] };
      }
      const content = readFileSafe(abs);
      return {
        content: [{ type: "text", text: `## ${filePath}\n\n\`\`\`\n${content}\n\`\`\`` }],
      };
    }
  );

  // ── Tool 4: list-graphql ──────────────────────────────────────────────────
  server.tool(
    "list-graphql",
    {
      domain: z.string().describe(
        "Domain name (e.g. 'outbound', 'inbound', 'inventory', 'alert', 'audit'). Use 'all' to list every domain."
      ),
      kind: z
        .enum(["queries", "mutations", "subscriptions", "all"])
        .default("all")
        .describe("Type of GraphQL operation to list"),
    },
    async ({ domain, kind }) => {
      const gqlBase        = path.join(MDUI, "graphql");
      const kindsToCheck   = kind === "all"
        ? (["queries", "mutations", "subscriptions"] as const)
        : [kind];

      const sections: string[] = [];

      for (const k of kindsToCheck) {
        const kDir = path.join(gqlBase, k);
        if (!fs.existsSync(kDir)) continue;

        const entries = fs.readdirSync(kDir);
        const targets = domain === "all" ? entries : entries.filter((e) => e === domain);

        for (const entry of targets) {
          const entryPath = path.join(kDir, entry);
          const isDir = fs.statSync(entryPath).isDirectory();
          if (isDir) {
            const files = fs.readdirSync(entryPath).filter((f) => f.endsWith(".js"));
            sections.push(`\n### ${k}/${entry}/`);
            files.forEach((f) =>
              sections.push(`  - ${f}  →  ${relPath(path.join(entryPath, f))}`)
            );
          } else if (entry.endsWith(".js")) {
            sections.push(`\n### ${k}/`);
            sections.push(`  - ${entry}  →  ${relPath(entryPath)}`);
          }
        }
      }

      if (sections.length === 0) {
        return { content: [{ type: "text", text: `No GraphQL files found for domain "${domain}" kind "${kind}".` }] };
      }

      return {
        content: [{ type: "text", text: `## GraphQL — domain: ${domain}, kind: ${kind}${sections.join("\n")}` }],
      };
    }
  );

  // ── Tool 5: find-usages ───────────────────────────────────────────────────
  server.tool(
    "find-usages",
    {
      symbol: z.string().describe(
        "Exact symbol to search for: component name, GraphQL query constant, Vuex action, etc."
      ),
      scope: z
        .enum(["frontend", "backend", "all"])
        .default("frontend")
        .describe("Where to look: 'frontend' → mdui/src, 'backend' → mdbff/src, 'all' → both"),
    },
    async ({ symbol, scope }) => {
      const dirs: string[] = [];
      if (scope !== "backend") dirs.push(MDUI);
      if (scope !== "frontend") dirs.push(MDBFF);

      const allMatches: string[] = [];
      for (const dir of dirs) {
        const files = grepFiles(symbol, dir);
        allMatches.push(...files.map(relPath));
      }

      const unique = [...new Set(allMatches)];
      if (unique.length === 0) {
        return { content: [{ type: "text", text: `No usages found for "${symbol}".` }] };
      }

      const shown = unique.slice(0, 25);
      const tail  = unique.length > 25 ? `\n... and ${unique.length - 25} more files` : "";
      return {
        content: [{ type: "text", text: `## Usages of "${symbol}" (${unique.length} files)\n\n${shown.map((f) => `- ${f}`).join("\n")}${tail}` }],
      };
    }
  );

  // ── Tool 6: list-store-modules ────────────────────────────────────────────
  server.tool(
    "list-store-modules",
    {
      domain: z.string().optional().describe(
        "Domain to inspect (e.g. 'outbound', 'inbound', 'inventory'). Omit to list all top-level modules."
      ),
    },
    async ({ domain }) => {
      const storeDir = path.join(MDUI, "store/modules");
      if (!fs.existsSync(storeDir)) {
        return { content: [{ type: "text", text: `Store modules directory not found at ${relPath(storeDir)}` }] };
      }

      const entries = fs.readdirSync(storeDir);

      if (!domain) {
        const list = entries.map((e) => {
          const full = path.join(storeDir, e);
          return fs.statSync(full).isDirectory() ? `- ${e}/  (module directory)` : `- ${e}`;
        });
        return { content: [{ type: "text", text: `## Vuex store modules\n\n${list.join("\n")}` }] };
      }

      const target = entries.find((e) => e.toLowerCase().includes(domain.toLowerCase()));
      if (!target) {
        return { content: [{ type: "text", text: `No store module found matching "${domain}".` }] };
      }

      const targetPath = path.join(storeDir, target);
      const isDir = fs.statSync(targetPath).isDirectory();

      if (!isDir) {
        const content = readFileSafe(targetPath);
        return { content: [{ type: "text", text: `## Store module: ${target}\n\n\`\`\`js\n${content}\n\`\`\`` }] };
      }

      const lines: string[] = [`## Store module: ${target}/`];
      function walk(dir: string, indent = "") {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const full = path.join(dir, item);
          if (fs.statSync(full).isDirectory()) {
            lines.push(`${indent}- ${item}/`);
            walk(full, indent + "  ");
          } else {
            lines.push(`${indent}- ${relPath(full)}`);
          }
        }
      }
      walk(targetPath);

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // ── Tool 7: list-resolvers ────────────────────────────────────────────────
  server.tool(
    "list-resolvers",
    {
      domain: z.string().optional().describe(
        "Domain to inspect (e.g. 'outbound', 'order', 'alert', 'inbound'). Omit to list all resolver domains."
      ),
    },
    async ({ domain }) => {
      const resolverDir = path.join(MDBFF, "resolvers");
      if (!fs.existsSync(resolverDir)) {
        return { content: [{ type: "text", text: `Resolver directory not found at ${relPath(resolverDir)}` }] };
      }

      const entries = fs.readdirSync(resolverDir);

      if (!domain) {
        const list = entries.map((e) => {
          const full = path.join(resolverDir, e);
          return fs.statSync(full).isDirectory() ? `- ${e}/` : e.endsWith(".mjs") ? `- ${e}` : "";
        }).filter(Boolean);
        return { content: [{ type: "text", text: `## BFF resolver domains\n\n${list.join("\n")}` }] };
      }

      const matches = entries.filter((e) => e.toLowerCase().includes(domain.toLowerCase()));
      if (matches.length === 0) {
        return { content: [{ type: "text", text: `No resolver domain found matching "${domain}".` }] };
      }

      const sections: string[] = [];
      for (const match of matches) {
        const full  = path.join(resolverDir, match);
        const isDir = fs.statSync(full).isDirectory();
        sections.push(`\n### resolvers/${match}${isDir ? "/" : ""}`);
        if (isDir) {
          const files = fs.readdirSync(full).filter((f) => f.endsWith(".mjs"));
          files.forEach((f) => sections.push(`  - ${f}  →  ${relPath(path.join(full, f))}`));
        }
      }

      return { content: [{ type: "text", text: `## BFF Resolvers — ${domain}${sections.join("\n")}` }] };
    }
  );

  // ── Tool 8: rebuild-code-index ────────────────────────────────────────────
  server.tool(
    "rebuild-code-index",
    {},
    async () => {
      indexReady  = false;
      indexStatus = "Rebuilding…";
      try {
        const cfg = { ...defaultConfig(REPO_ROOT), cachePath: CACHE_PATH };
        const r   = await buildIndex(graph, cfg);
        indexReady  = true;
        indexStatus = `Indexed ${r.filesIndexed} files | ${r.totalNodes} nodes | ${r.totalEdges} edges | ${r.durationMs}ms`;
        const stats = graph.stats();
        return {
          content: [{
            type: "text",
            text: [
              `Index complete in ${r.durationMs}ms`,
              `  Files indexed : ${r.filesIndexed}`,
              `  Files errored : ${r.filesErrored}`,
              `  Total nodes   : ${r.totalNodes}`,
              `  Total edges   : ${r.totalEdges}`,
              `  Cache saved   : ${CACHE_PATH}`,
              "",
              "Kind breakdown:",
              ...Object.entries(stats)
                .filter(([k]) => !["totalNodes", "totalEdges", "indexedFiles"].includes(k))
                .map(([k, v]) => `  ${k.padEnd(22)} ${v}`),
              ...(r.errors.length
                ? [`\nSample errors (${r.errors.length} total):`,
                   ...r.errors.slice(0, 5).map((e) => `  ${path.basename(e.file)}: ${e.error.slice(0, 80)}`)]
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

  // ── Tool 9: search-code-symbols ───────────────────────────────────────────
  server.tool(
    "search-code-symbols",
    {
      query: z.string().describe(
        "Name fragment to search for (case-insensitive). Matches functions, classes, Vue components, GraphQL resolvers, etc."
      ),
      kind: z
        .enum(["function", "class", "method", "variable", "vue-component", "graphql-type", "graphql-operation", "graphql-resolver", "file"])
        .optional()
        .describe("Filter by symbol kind"),
      limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
    },
    async ({ query, kind, limit: rawLimit }) => {
      if (!indexReady) return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      const limit   = rawLimit ?? 20;
      const results = graph.searchByName(query, limit, kind as NodeKind | undefined);
      if (results.length === 0) {
        return { content: [{ type: "text", text: `No symbols found matching "${query}"${kind ? ` (kind: ${kind})` : ""}.` }] };
      }
      const lines = results.map((n) => {
        const meta: string[] = [];
        if (n.metadata.isExported) meta.push("exported");
        if (n.metadata.isAsync)    meta.push("async");
        if (n.metadata.params?.length) meta.push(`params: ${(n.metadata.params as string[]).join(", ")}`);
        return [
          `[${n.kind}] ${n.scopePath}`,
          `  file : ${relPath(n.filePath)}`,
          `  loc  : line ${n.loc.start.line}–${n.loc.end.line}`,
          ...(meta.length ? [`  meta : ${meta.join(" | ")}`] : []),
        ].join("\n");
      });
      return { content: [{ type: "text", text: `Found ${results.length} symbol(s) matching "${query}":\n\n${lines.join("\n\n")}` }] };
    }
  );

  // ── Tool 10: get-file-structure ───────────────────────────────────────────
  server.tool(
    "get-file-structure",
    {
      filePath: z.string().describe(
        "Repo-relative path (e.g. 'mdui/src/pages/outbound/listing/Listing.vue')"
      ),
    },
    async ({ filePath }) => {
      if (!indexReady) return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      const abs    = path.isAbsolute(filePath) ? filePath : path.join(REPO_ROOT, filePath);
      const struct = graph.getFileStructure(abs);
      if (!struct) {
        return { content: [{ type: "text", text: `File not in index: ${filePath}\nTry rebuild-code-index if the file is new.` }] };
      }
      const importLines     = struct.imports.map((e) => {
        const t = graph.getNode(e.toId);
        return `  → ${t ? relPath(t.filePath) : e.toId}${e.label ? ` (${e.label})` : ""}`;
      });
      const importedByLines = struct.importedBy.map((e) => {
        const s = graph.getNode(e.fromId);
        return `  ← ${s ? relPath(s.filePath) : e.fromId}`;
      });
      const symbolLines = struct.children.map((n) => {
        const meta: string[] = [];
        if (n.metadata.isExported) meta.push("exported");
        if (n.metadata.isAsync)    meta.push("async");
        if (n.metadata.isStatic)   meta.push("static");
        return `  [${n.kind.padEnd(18)}] ${n.scopePath.padEnd(40)} line ${n.loc.start.line}` +
               (meta.length ? `  { ${meta.join(" | ")} }` : "");
      });
      return {
        content: [{
          type: "text",
          text: [
            `FILE: ${relPath(struct.file.filePath)}`,
            `\nSYMBOLS (${struct.children.length}):`,
            ...symbolLines,
            `\nIMPORTS (${importLines.length}):`,
            ...(importLines.length ? importLines : ["  (none)"]),
            `\nIMPORTED BY (${importedByLines.length}):`,
            ...(importedByLines.length ? importedByLines : ["  (none)"]),
          ].join("\n"),
        }],
      };
    }
  );

  // ── Tool 11: find-callers ─────────────────────────────────────────────────
  server.tool(
    "find-callers",
    {
      functionName: z.string().describe("Function or method name to look up (exact or partial)"),
      exact: z.boolean().optional().default(false).describe("true = exact name match only"),
    },
    async ({ functionName, exact }) => {
      if (!indexReady) return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      const targets = exact
        ? graph.getNodesByName(functionName)
        : graph.searchByName(functionName, 10).filter(
            (n) => n.kind === "function" || n.kind === "method" || n.kind === "graphql-resolver"
          );
      if (targets.length === 0) {
        return { content: [{ type: "text", text: `No function/method found named "${functionName}".` }] };
      }
      const sections: string[] = [];
      for (const target of targets) {
        const callers = graph.getCallers(target.id);
        sections.push(
          `TARGET: [${target.kind}] ${target.scopePath}  (${relPath(target.filePath)}:${target.loc.start.line})`,
          callers.length === 0
            ? "  No callers found in indexed codebase."
            : `  Called by ${callers.length} location(s):`,
          ...callers.map((c) => `    • [${c.kind}] ${c.scopePath}  (${relPath(c.filePath)}:${c.loc.start.line})`),
        );
      }
      return { content: [{ type: "text", text: sections.join("\n") }] };
    }
  );

  // ── Tool 12: get-vue-component ────────────────────────────────────────────
  server.tool(
    "get-vue-component",
    {
      name: z.string().describe(
        "Component name or partial path (e.g. 'OrderListing', 'Listing', 'outbound/listing')"
      ),
    },
    async ({ name }) => {
      if (!indexReady) return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      const candidates = graph
        .searchByName(name, 20)
        .filter((n) => n.kind === "vue-component" || (n.kind === "file" && n.filePath.endsWith(".vue")));
      if (candidates.length === 0) {
        return { content: [{ type: "text", text: `No Vue component found matching "${name}".` }] };
      }
      const lines: string[] = [];
      for (const cmp of candidates.slice(0, 5)) {
        const m = cmp.metadata;
        const section = (label: string, items: unknown) => {
          const arr = Array.isArray(items) ? (items as string[]) : [];
          return arr.length ? `  ${label}: ${arr.join(", ")}` : null;
        };
        lines.push(
          `COMPONENT: ${cmp.name}`,
          `  file     : ${relPath(cmp.filePath)}`,
          `  loc      : line ${cmp.loc.start.line}–${cmp.loc.end.line}`,
          ...[
            section("props",      m.props),
            section("data keys",  m.dataKeys),
            section("computed",   m.computed),
            section("methods",    m.methods),
            section("mixins",     m.mixins),
            section("apollo",     m.apolloQueries),
            section("components", m.components),
            section("emits",      m.emits),
          ].filter(Boolean) as string[],
          "",
        );
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // ── Tool 13: get-resolver-info ────────────────────────────────────────────
  server.tool(
    "get-resolver-info",
    {
      name: z.string().describe(
        "Resolver field name or partial match (e.g. 'outboundOrderList', 'inventory')"
      ),
    },
    async ({ name }) => {
      if (!indexReady) return { content: [{ type: "text", text: `Index not ready. Status: ${indexStatus}` }] };
      const resolvers = graph
        .searchByName(name, 30, "graphql-resolver")
        .filter((n) => n.filePath.includes("mdbff"));
      if (resolvers.length === 0) {
        return { content: [{ type: "text", text: `No BFF resolver found matching "${name}".` }] };
      }
      const lines = resolvers.map((r) => [
        `[${r.metadata.graphqlOperation ?? "?"}] ${r.name}`,
        `  file   : ${relPath(r.filePath)}:${r.loc.start.line}`,
        `  params : ${(r.metadata.params as string[] | undefined)?.join(", ") || "(none)"}`,
        `  async  : ${r.metadata.isAsync ? "yes" : "no"}`,
      ].join("\n"));
      return { content: [{ type: "text", text: `Found ${resolvers.length} resolver(s) matching "${name}":\n\n${lines.join("\n\n")}` }] };
    }
  );

  // ── Tool 14: find-related-context ─────────────────────────────────────────
  server.tool(
    "find-related-context",
    {
      keywords: z.array(z.string()).min(1).max(8).describe(
        "2–6 keywords from the JIRA ticket. Include the domain (e.g. 'outbound'), " +
        "the feature area (e.g. 'order', 'listing', 'exception'), and any page or " +
        "component name fragments (e.g. 'filter', 'detail', 'suborder'). " +
        "Used for both filename and content matching."
      ),
      maxComponents: z.number().int().min(1).max(8).optional().describe(
        "Max components to return (default 5). Increase to 8 for complex multi-component features."
      ),
    },
    async ({ keywords, maxComponents = 5 }) => {
      const scored = new Map<string, number>();

      const addScore = (absPath: string, pts: number) => {
        scored.set(absPath, (scored.get(absPath) ?? 0) + pts);
      };

      const searchDirs = [
        path.join(MDUI, "pages"),
        path.join(MDUI, "components"),
      ];

      const allVueFiles: string[] = [];
      for (const dir of searchDirs) {
        if (fs.existsSync(dir)) {
          const files = await fg("**/*.vue", { cwd: dir, absolute: true });
          allVueFiles.push(...files);
        }
      }

      for (const keyword of keywords) {
        const kl = keyword.toLowerCase();
        for (const f of allVueFiles) {
          if (relPath(f).toLowerCase().includes(kl)) addScore(f, 3);
        }
        for (const f of grepFiles(keyword, MDUI, ["*.vue"])) {
          addScore(path.isAbsolute(f) ? f : path.join(REPO_ROOT, f), 1);
        }
      }

      const ranked = [...scored.entries()]
        .sort(([, a], [, b]) => b - a)
        .slice(0, maxComponents)
        .map(([absPath]) => absPath)
        .filter((p) => fs.existsSync(p));

      if (ranked.length === 0) {
        return {
          content: [{
            type: "text",
            text: [
              `No related components found for keywords: [${keywords.join(", ")}]`,
              "",
              "Try broader keywords (e.g. just the domain name like 'outbound'), or use",
              "find-components / read-source-file directly.",
            ].join("\n"),
          }],
        };
      }

      const SNIPPET_CHARS = 4_000;
      const sections: string[] = [
        `## Related components for: [${keywords.join(", ")}]`,
        `Returning ${ranked.length} component(s) sorted by relevance score:\n`,
      ];

      for (const absPath of ranked) {
        const relFilePath = relPath(absPath);
        const baseName    = path.basename(absPath, ".vue");
        sections.push(`---\n### ${path.basename(absPath)}  ·  ${relFilePath}`);

        if (indexReady) {
          const nodes = graph
            .searchByName(baseName, 10)
            .filter((n) =>
              (n.kind === "vue-component" || n.kind === "file") &&
              n.filePath === absPath
            );
          if (nodes.length > 0) {
            const cmp = nodes[0];
            const m   = cmp.metadata;
            const field = (label: string, val: unknown): string | null => {
              const arr = Array.isArray(val) ? (val as string[]) : [];
              return arr.length ? `  ${label}: ${arr.join(", ")}` : null;
            };
            const apiLines = [
              field("props",      m.props),
              field("data keys",  m.dataKeys),
              field("computed",   m.computed),
              field("methods",    m.methods),
              field("apollo",     m.apolloQueries),
              field("components", m.components),
              field("mixins",     m.mixins),
              field("emits",      m.emits),
            ].filter(Boolean) as string[];
            if (apiLines.length) {
              sections.push("**API Surface (from AST index):**", ...apiLines, "");
            }
          }
        }

        let source: string;
        try {
          const raw = fs.readFileSync(absPath, "utf-8");
          source = raw.length > SNIPPET_CHARS
            ? raw.slice(0, SNIPPET_CHARS) +
              `\n\n... [truncated at ${SNIPPET_CHARS} chars — full length ${raw.length}. Use read-source-file("${relFilePath}") to read the rest]`
            : raw;
        } catch {
          source = "[Error: could not read file]";
        }
        sections.push("**Source:**", "```vue", source, "```\n");
      }

      return { content: [{ type: "text", text: sections.join("\n") }] };
    }
  );

  // ── Tool 15: list-captured-pages ──────────────────────────────────────────
  server.tool(
    "list-captured-pages",
    {
      branch: z.string().optional().describe(
        "Capture label (branch name). Omit to use the most recently updated capture set."
      ),
    },
    async ({ branch }) => {
      const label = resolveCaptureLabel(branch);
      if (!label) {
        return {
          content: [{
            type: "text",
            text: "No captures found. Run `npm run crawl` to build a capture set from the live app.",
          }],
        };
      }
      return { content: [{ type: "text", text: formatCapturedPages(label) }] };
    }
  );

  // ── Tool 16: survey-page-templates ────────────────────────────────────────
  server.tool(
    "survey-page-templates",
    {
      branch: z.string().optional().describe("Capture label. Omit to use latest."),
    },
    async ({ branch }) => {
      const label = resolveCaptureLabel(branch);
      if (!label) {
        return {
          content: [{
            type: "text",
            text: "No captures found. Run `npm run crawl` then `npm run analyze-captures`.",
          }],
        };
      }
      return { content: [{ type: "text", text: surveyPageTemplates(label) }] };
    }
  );

  // ── Tool 17: get-page-template ────────────────────────────────────────────
  server.tool(
    "get-page-template",
    {
      route: z.string().optional().describe(
        "Single route from the survey, e.g. /outbound/ordersV2"
      ),
      routes: z.array(z.string()).max(6).optional().describe(
        "Up to 6 routes to batch-load in one call (preferred over single route)"
      ),
      archetype: z
        .enum(["listing-table", "dashboard-tabs", "form", "other"])
        .optional()
        .describe("Archetype fallback when no specific route matches the ticket"),
      branch: z.string().optional().describe("Capture label. Omit for latest."),
    },
    async ({ route, routes, archetype, branch }) => {
      const label = resolveCaptureLabel(branch);
      if (!label) {
        return {
          content: [{
            type: "text",
            text: "No captures. Run `npm run crawl` + `npm run analyze-captures` first.",
          }],
        };
      }

      if (routes?.length) {
        return { content: [{ type: "text", text: getPageTemplatesBatchText(label, routes) }] };
      }

      if (!route && !archetype) {
        return {
          content: [{
            type: "text",
            text: "Provide route, routes[], or archetype. Call survey-page-templates first.",
          }],
        };
      }

      return {
        content: [{
          type: "text",
          text: getPageTemplateText(label, route, archetype as PageArchetype | undefined),
        }],
      };
    }
  );

  return server;
}
