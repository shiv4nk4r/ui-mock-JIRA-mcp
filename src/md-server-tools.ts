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

function resolveMdRepoRoot(): string {
  const fromEnv = process.env.MD_REPO_ROOT?.trim();
  if (fromEnv) return fromEnv;
  const bundled = path.join(process.cwd(), "pm-mcp", ".repos", "manager-dashboard");
  if (fs.existsSync(bundled)) return bundled;
  const home = process.env.HOME ?? "";
  for (const c of [
    path.join(home, "workplace", "manager-dashboard"),
    path.join(home, "gor", "manager-dashboard"),
  ]) {
    if (c && fs.existsSync(c)) return c;
  }
  return bundled;
}

const REPO_ROOT = resolveMdRepoRoot();
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

// ── i18n helpers ──────────────────────────────────────────────────────────────
// Loads the English translation file once and caches it in memory.

const I18N_FILE = path.join(MDUI, "i18n/en-us/index.js");
let _i18nCache: Record<string, string> | null = null;

function loadI18n(): Record<string, string> {
  if (_i18nCache) return _i18nCache;
  try {
    const src = fs.readFileSync(I18N_FILE, "utf-8");
    const result: Record<string, string> = {};
    const re = /^\s+(\w+):\s*['"]([^'"]+)['"]/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src))) result[m[1]] = m[2];
    _i18nCache = result;
    return result;
  } catch {
    return {};
  }
}

/** Resolve a raw label expression from Vue source to English text.
 *  Handles: this.$t('key')  |  'Literal text'  |  conditional expressions  */
function resolveLabel(raw: string, i18n: Record<string, string>): string {
  const tMatch = raw.match(/\$t\(['"](\w+)['"]\)/);
  if (tMatch) return i18n[tMatch[1]] ?? tMatch[1];
  const strMatch = raw.match(/['"]([^'"]+)['"]/);
  if (strMatch) return strMatch[1];
  // Conditional: this.flag ? this.$t('a') : this.$t('b') — take first branch
  const condMatch = raw.match(/\$t\(['"](\w+)['"]\).*\$t\(['"](\w+)['"]\)/);
  if (condMatch) return `${i18n[condMatch[1]] ?? condMatch[1]} / ${i18n[condMatch[2]] ?? condMatch[2]}`;
  return raw.trim().slice(0, 60);
}

// ── Table column extractor ────────────────────────────────────────────────────

interface ColumnDef {
  name:        string;
  label:       string;
  field:       string;
  align:       string;
  sortable:    boolean;
  filterable:  boolean;
  searchable:  boolean;
  headerStyle: string;
}

/** Extract the tableFields / columns array from a Vue SFC source. */
function extractColumnsFromSource(src: string, i18n: Record<string, string>): ColumnDef[] {
  // Strip <template> and <style> so bracket counting isn't confused
  const script = src.replace(/<template[\s\S]*?<\/template>/gi, "")
                    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Find the column array — try multiple property names
  const MARKERS = ["tableFields", "columns", "tableColumns", "columnDefs"];
  let arrayContent = "";

  for (const marker of MARKERS) {
    const idx = script.indexOf(`${marker}(`);
    if (idx === -1) continue;
    // Walk forward to find the first [
    let start = -1;
    for (let i = idx; i < Math.min(idx + 200, script.length); i++) {
      if (script[i] === "[") { start = i; break; }
    }
    if (start === -1) continue;
    // Find matching ]
    let depth = 0, end = -1;
    for (let i = start; i < script.length; i++) {
      if (script[i] === "[") depth++;
      else if (script[i] === "]") { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end !== -1) { arrayContent = script.slice(start + 1, end); break; }
  }

  if (!arrayContent) return [];

  // Extract individual column objects { ... } at depth 1
  const objects: string[] = [];
  let depth = 0, objStart = -1;
  for (let i = 0; i < arrayContent.length; i++) {
    if (arrayContent[i] === "{") { if (depth === 0) objStart = i; depth++; }
    else if (arrayContent[i] === "}") { depth--; if (depth === 0 && objStart !== -1) { objects.push(arrayContent.slice(objStart + 1, i)); objStart = -1; } }
  }

  const cols: ColumnDef[] = [];
  for (const obj of objects) {
    const name = obj.match(/\bname:\s*['"](\w+)['"]/)?.[1];
    if (!name) continue;
    const labelRaw = obj.match(/\blabel:\s*([\s\S]+?),?\s*\n/)?.[1]?.trim() ?? "";
    cols.push({
      name,
      label:       resolveLabel(labelRaw, i18n),
      field:       obj.match(/\bfield:\s*['"](\w+)['"]/)?.[1]  ?? name,
      align:       obj.match(/\balign:\s*['"](\w+)['"]/)?.[1]  ?? "left",
      sortable:    /\bsortable:\s*true\b|\bcanSort:\s*true\b/.test(obj),
      filterable:  /\bfilterable:\s*true\b/.test(obj),
      searchable:  /\bsearchable:\s*true\b/.test(obj),
      headerStyle: obj.match(/\bheaderStyle:\s*['"]([^'"]+)['"]/)?.[1] ?? "",
    });
  }
  return cols;
}

// ── Status map extractor ──────────────────────────────────────────────────────

/** Extract every { 'Status Label': '#hexcolor' } mapping found in a file. */
function extractStatusMapFromSource(src: string): Record<string, string> {
  const result: Record<string, string> = {};
  const re = /['"]([A-Za-z][^'"]{0,60})['"]\s*:\s*['"](\#[0-9a-fA-F]{6})['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) result[m[1]] = m[2];
  return result;
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
  server.registerTool(
    "list-routes",
    { inputSchema: {
      filter: z.string().optional().describe(
        "Optional domain to filter (e.g. 'outbound', 'inbound', 'inventory'). Omit for all routes."
      ),
    } },
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
  server.registerTool(
    "find-components",
    { inputSchema: {
      query: z.string().describe(
        "Name fragment or domain to search for (e.g. 'OrderListing', 'outbound', 'inventory/listing')"
      ),
      type: z
        .enum(["component", "page", "any"])
        .default("any")
        .describe("Restrict search: 'component' → components/, 'page' → pages/, 'any' → both"),
    } },
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
  server.registerTool(
    "read-source-file",
    { inputSchema: {
      path: z.string().describe(
        "Repo-relative path (e.g. 'mdui/src/pages/outbound/listing/Listing.vue')"
      ),
    } },
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
  server.registerTool(
    "list-graphql",
    { inputSchema: {
      domain: z.string().describe(
        "Domain name (e.g. 'outbound', 'inbound', 'inventory', 'alert', 'audit'). Use 'all' to list every domain."
      ),
      kind: z
        .enum(["queries", "mutations", "subscriptions", "all"])
        .default("all")
        .describe("Type of GraphQL operation to list"),
    } },
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
  server.registerTool(
    "find-usages",
    { inputSchema: {
      symbol: z.string().describe(
        "Exact symbol to search for: component name, GraphQL query constant, Vuex action, etc."
      ),
      scope: z
        .enum(["frontend", "backend", "all"])
        .default("frontend")
        .describe("Where to look: 'frontend' → mdui/src, 'backend' → mdbff/src, 'all' → both"),
    } },
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
  server.registerTool(
    "list-store-modules",
    { inputSchema: {
      domain: z.string().optional().describe(
        "Domain to inspect (e.g. 'outbound', 'inbound', 'inventory'). Omit to list all top-level modules."
      ),
    } },
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
  server.registerTool(
    "list-resolvers",
    { inputSchema: {
      domain: z.string().optional().describe(
        "Domain to inspect (e.g. 'outbound', 'order', 'alert', 'inbound'). Omit to list all resolver domains."
      ),
    } },
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
  server.registerTool(
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
  server.registerTool(
    "search-code-symbols",
    { inputSchema: {
      query: z.string().describe(
        "Name fragment to search for (case-insensitive). Matches functions, classes, Vue components, GraphQL resolvers, etc."
      ),
      kind: z
        .enum(["function", "class", "method", "variable", "vue-component", "graphql-type", "graphql-operation", "graphql-resolver", "file"])
        .optional()
        .describe("Filter by symbol kind"),
      limit: z.number().int().min(1).max(100).optional().describe("Max results (default 20)"),
    } },
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
  server.registerTool(
    "get-file-structure",
    { inputSchema: {
      filePath: z.string().describe(
        "Repo-relative path (e.g. 'mdui/src/pages/outbound/listing/Listing.vue')"
      ),
    } },
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
  server.registerTool(
    "find-callers",
    { inputSchema: {
      functionName: z.string().describe("Function or method name to look up (exact or partial)"),
      exact: z.boolean().optional().default(false).describe("true = exact name match only"),
    } },
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
  server.registerTool(
    "get-vue-component",
    { inputSchema: {
      name: z.string().describe(
        "Component name or partial path (e.g. 'OrderListing', 'Listing', 'outbound/listing')"
      ),
    } },
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
  server.registerTool(
    "get-resolver-info",
    { inputSchema: {
      name: z.string().describe(
        "Resolver field name or partial match (e.g. 'outboundOrderList', 'inventory')"
      ),
    } },
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
  server.registerTool(
    "find-related-context",
    { inputSchema: {
      keywords: z.array(z.string()).min(1).max(8).describe(
        "2–6 keywords from the JIRA ticket. Include the domain (e.g. 'outbound'), " +
        "the feature area (e.g. 'order', 'listing', 'exception'), and any page or " +
        "component name fragments (e.g. 'filter', 'detail', 'suborder'). " +
        "Used for both filename and content matching."
      ),
      maxComponents: z.number().int().min(1).max(8).optional().describe(
        "Max components to return (default 5). Increase to 8 for complex multi-component features."
      ),
    } },
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
  server.registerTool(
    "list-captured-pages",
    { inputSchema: {
      branch: z.string().optional().describe(
        "Capture label (branch name). Omit to use the most recently updated capture set."
      ),
    } },
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
  server.registerTool(
    "survey-page-templates",
    { inputSchema: {
      branch: z.string().optional().describe("Capture label. Omit to use latest."),
    } },
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
  server.registerTool(
    "get-page-template",
    { inputSchema: {
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
    } },
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

  // ── Tool 18: get-table-columns ────────────────────────────────────────────
  // Extracts the real column definitions from a Vue listing component and resolves
  // every $t('key') label to its English text via the en-us i18n file.
  // Use this before generating any listing mockup to get exact column names/order.

  server.registerTool(
    "get-table-columns",
    { inputSchema: {
      path: z.string().optional().describe(
        "Repo-relative path to the Vue component (e.g. 'mdui/src/components/audit/Audit.vue'). " +
        "Preferred when you already know the file."
      ),
      component: z.string().optional().describe(
        "Name fragment or domain keyword to search for when path is unknown " +
        "(e.g. 'audit', 'outbound listing', 'inventory v2'). Falls back to text search."
      ),
    } },
    async ({ path: filePath, component }) => {
      const i18n = loadI18n();

      // Resolve target file
      let absPath: string | null = null;

      if (filePath) {
        absPath = path.isAbsolute(filePath) ? filePath : path.join(REPO_ROOT, filePath);
        if (!fs.existsSync(absPath)) {
          return { content: [{ type: "text", text: `File not found: ${filePath}` }] };
        }
      } else if (component) {
        const q = component.toLowerCase().replace(/\//g, path.sep.toLowerCase());
        const files = await fg("**/*.vue", { cwd: MDUI, absolute: true });
        // Prefer listing/main components (Audit.vue, List.vue, Listing.vue)
        const scored = files
          .filter((f) => relPath(f).toLowerCase().includes(q))
          .sort((a, b) => {
            const score = (f: string) => {
              const base = path.basename(f).toLowerCase();
              if (base === "list.vue" || base === "listing.vue") return 0;
              if (base.includes("list")) return 1;
              if (/audit|inventory|inbound|outbound/i.test(base)) return 2;
              return 3;
            };
            return score(a) - score(b);
          });
        absPath = scored[0] ?? null;
        if (!absPath) {
          return { content: [{ type: "text", text: `No Vue component found matching "${component}".` }] };
        }
      } else {
        return { content: [{ type: "text", text: "Provide either path or component." }] };
      }

      const src = fs.readFileSync(absPath, "utf-8");
      const cols = extractColumnsFromSource(src, i18n);

      if (cols.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No tableFields/columns array found in ${relPath(absPath)}.\n` +
                  `Try read-source-file to inspect the component manually.`,
          }],
        };
      }

      const rows = cols.map((c) => {
        const flags: string[] = [];
        if (c.sortable)   flags.push("sortable");
        if (c.filterable) flags.push("filterable");
        if (c.searchable) flags.push("searchable");
        const style = c.headerStyle ? ` | ${c.headerStyle}` : "";
        return `  ${c.label.padEnd(32)} field=${c.field}  align=${c.align}${flags.length ? `  [${flags.join(", ")}]` : ""}${style}`;
      }).join("\n");

      return {
        content: [{
          type: "text",
          text: [
            `## Table columns — ${relPath(absPath)} (${cols.length} columns)`,
            "",
            "Use these exact labels and field names in the mockup. Never invent columns.",
            "",
            rows,
            "",
            "JSON (for direct use in column definitions):",
            "```json",
            JSON.stringify(cols, null, 2),
            "```",
          ].join("\n"),
        }],
      };
    }
  );

  // ── Tool 19: get-domain-status-map ────────────────────────────────────────
  // Returns all status label → chip background color mappings for a domain.
  // Searches constants/ files and component source for STATUS_COLOR_MAP and
  // inline chip style objects. Use this to get correct chip colors for any domain.

  server.registerTool(
    "get-domain-status-map",
    { inputSchema: {
      domain: z.string().describe(
        "Domain name (e.g. 'outbound', 'inbound', 'audit', 'inventory', 'resources', 'system')"
      ),
    } },
    async ({ domain }) => {
      const d = domain.toLowerCase();
      const combined: Record<string, string> = {};

      // 1. Check known constants files first (most reliable source)
      const DOMAIN_CONSTANTS: Record<string, string> = {
        outbound:  "mdui/src/constants/order.js",
        order:     "mdui/src/constants/order.js",
        tool:      "mdui/src/constants/tool.js",
        equipment: "mdui/src/constants/tool.js",
      };
      const constFile = DOMAIN_CONSTANTS[d];
      if (constFile) {
        try {
          const src = fs.readFileSync(path.join(REPO_ROOT, constFile), "utf-8");
          Object.assign(combined, extractStatusMapFromSource(src));
        } catch { /* ignore */ }
      }

      // 2. Scan domain component directory for inline color maps
      const compDir = path.join(MDUI, "components", d);
      if (fs.existsSync(compDir)) {
        const files = await fg("**/*.{vue,js}", { cwd: compDir, absolute: true });
        for (const f of files.slice(0, 15)) {
          try {
            const src = fs.readFileSync(f, "utf-8");
            Object.assign(combined, extractStatusMapFromSource(src));
          } catch { /* ignore */ }
        }
      }

      // 3. Shared StatusChip component has device/resource maps
      const statusChipFile = path.join(MDUI, "components/resources/utils/StatusChip.vue");
      if (fs.existsSync(statusChipFile) && (d === "resources" || d === "system" || Object.keys(combined).length === 0)) {
        try {
          const src = fs.readFileSync(statusChipFile, "utf-8");
          Object.assign(combined, extractStatusMapFromSource(src));
        } catch { /* ignore */ }
      }

      if (Object.keys(combined).length === 0) {
        return {
          content: [{
            type: "text",
            text: `No status color map found for domain "${domain}".\n` +
                  `Use the default STATUS_COLOR_MAP from design.md Section 0.`,
          }],
        };
      }

      // Group by color for readability
      const byColor: Record<string, string[]> = {};
      for (const [status, color] of Object.entries(combined)) {
        (byColor[color] ??= []).push(status);
      }

      const groups = Object.entries(byColor).map(([color, statuses]) => {
        const names = { "#ececec": "grey", "#ebf5e8": "green", "#ffd8d7": "red", "#ffeedc": "orange", "#e3f2fd": "blue" };
        const name = names[color as keyof typeof names] ?? "";
        return `  ${color}${name ? ` (${name})` : ""}:\n${statuses.map((s) => `    - "${s}"`).join("\n")}`;
      });

      return {
        content: [{
          type: "text",
          text: [
            `## Status → chip background color map for domain: ${domain}`,
            "",
            "Use these exact hex values in chip inline styles. Never invent colors.",
            "Chip pattern: <q-chip dense size=\"sm\" class=\"q-ma-none\" :style=\"\`background-color: \${color}; font-size: 12px;\`\">",
            "",
            ...groups,
            "",
            "JSON:",
            "```json",
            JSON.stringify(combined, null, 2),
            "```",
          ].join("\n"),
        }],
      };
    }
  );

  // ── Tool 20: resolve-i18n-keys ────────────────────────────────────────────
  // Resolves translation keys from Vue source (e.g. $t('auditDetails')) to their
  // actual English text. Use when you see $t('key') in component source and need
  // the real label for column headers, button labels, or section titles.

  server.registerTool(
    "resolve-i18n-keys",
    { inputSchema: {
      keys: z.array(z.string()).min(1).max(60).describe(
        "List of i18n keys to resolve (e.g. ['auditDetails', 'creationDetails', 'priority'])"
      ),
    } },
    async ({ keys }) => {
      const i18n = loadI18n();
      const result: Array<{ key: string; text: string; found: boolean }> = keys.map((k) => ({
        key:   k,
        text:  i18n[k] ?? k,
        found: k in i18n,
      }));

      const found   = result.filter((r) => r.found);
      const missing = result.filter((r) => !r.found);

      const lines = [
        `## i18n key → English text (${found.length}/${keys.length} resolved)`,
        "",
        ...found.map((r)   => `  ${r.key.padEnd(35)} → "${r.text}"`),
        ...(missing.length ? ["", `Not found (${missing.length}): ${missing.map((r) => r.key).join(", ")}`] : []),
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    }
  );

  // ── Tool 21: read-files-batch ─────────────────────────────────────────────
  // Read up to 6 repo files in a single call. Saves multiple tool-call rounds
  // when you need the listing component + its GraphQL query + its constants
  // file together. Each file is capped at 10 KB.

  server.registerTool(
    "read-files-batch",
    { inputSchema: {
      paths: z.array(z.string()).min(1).max(6).describe(
        "Repo-relative paths to read (e.g. ['mdui/src/components/audit/Audit.vue', " +
        "'mdui/src/graphql/queries/audit/audit-list.js'])"
      ),
    } },
    async ({ paths }) => {
      const CAP = 10_000;
      const sections: string[] = [];

      for (const p of paths) {
        const abs = path.isAbsolute(p) ? p : path.join(REPO_ROOT, p);
        if (!fs.existsSync(abs)) {
          sections.push(`## ${p}\n[File not found]`);
          continue;
        }
        let content: string;
        try {
          const raw = fs.readFileSync(abs, "utf-8");
          content = raw.length > CAP
            ? raw.slice(0, CAP) + `\n\n... [truncated — ${raw.length} total chars. Use read-source-file for the full file.]`
            : raw;
        } catch {
          content = `[Error reading file]`;
        }
        sections.push(`## ${p}\n\n\`\`\`\n${content}\n\`\`\``);
      }

      return { content: [{ type: "text", text: sections.join("\n\n---\n\n") }] };
    }
  );

  return server;
}
