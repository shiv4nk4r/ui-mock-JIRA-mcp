/**
 * indexer.ts — File-system walker + two-pass graph builder.
 *
 * Pass 1: Walk the file trees (mdui/src, mdbff/src), parse every source file,
 *         load all nodes and structural edges (contains) into the GraphStore.
 *
 * Pass 2: Resolve rawImports (file → file) and rawCalls (function → function)
 *         against the fully populated node index and add cross-file edges.
 *
 * Alias resolution:  The Quasar/Webpack `src/` alias used in mdui imports
 * (e.g. "src/graphql/queries/…") is expanded to the real mdui/src/ path.
 * Similarly "components/…" resolves relative to mdui/src/.
 *
 * Concurrency: files are parsed in batches (default 20 concurrent) to avoid
 * overwhelming the Node.js event loop on a 1 000-file codebase.
 */

import fg       from 'fast-glob';
import path     from 'path';
import fs       from 'fs';

import { parseFile }              from './parser';
import { GraphStore }             from './graph-store';
import type { CacheHeader }       from './graph-store';
import { cachePathForBranch }     from '../paths';
import type {
  CodeEdge,
  CodeNode,
  IndexerConfig,
  ParseResult,
  RawCall,
  RawImport,
} from './types';

// ─── Public API ───────────────────────────────────────────────────────────────

export interface IndexResult {
  filesIndexed:  number;
  filesErrored:  number;
  totalNodes:    number;
  totalEdges:    number;
  durationMs:    number;
  errors:        Array<{ file: string; error: string }>;
}

/**
 * Full index: scan all roots, parse every file, populate `store`.
 * Safe to call multiple times — clears the store first.
 */
export async function buildIndex(
  store:  GraphStore,
  config: IndexerConfig,
): Promise<IndexResult> {
  const t0 = Date.now();
  store.clear();

  // ── Derive repoRoot (common ancestor of all roots) ───────────────────────
  const repoRoot = config.repoRoot ?? commonAncestor(config.roots);

  // ── Collect all source files ───────────────────────────────────────────────
  const allFiles: string[] = [];
  for (const root of config.roots) {
    const pattern = '**/*.{vue,js,mjs,ts,graphql,gql}';
    const ignore  = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/.quasar/**',
      '**/coverage/**',
      '**/__pact/**',
      '**/*.spec.js',
      '**/*.test.js',
      '**/*.spec.ts',
      '**/*.test.ts',
      ...(config.ignore ?? []),
    ];
    const found = await fg(pattern, { cwd: root, absolute: true, ignore, dot: false });
    allFiles.push(...found);
  }

  // ── Pass 1: parse files concurrently (batched) ───────────────────────────
  const concurrency = config.concurrency ?? 20;
  const parseResults: ParseResult[] = [];
  const errors: Array<{ file: string; error: string }> = [];

  for (let i = 0; i < allFiles.length; i += concurrency) {
    const batch = allFiles.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      batch.map((f) => Promise.resolve(parseFile(f, repoRoot)))
    );

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j];
      const file   = batch[j];
      if (result.status === 'fulfilled') {
        const pr = result.value;
        parseResults.push(pr);
        // Collect per-parse errors (non-fatal)
        for (const e of pr.errors) {
          errors.push({ file, error: e });
        }
        // Load nodes and structural edges immediately
        for (const node of pr.nodes) store.addNode(node);
        for (const edge of pr.edges) store.addEdge(edge);
      } else {
        errors.push({ file, error: String(result.reason) });
      }
    }
  }

  // ── Pass 2: resolve cross-file imports and calls ──────────────────────────
  const aliases = buildAliasMap(config);

  for (const pr of parseResults) {
    resolveImports(pr.rawImports, pr.filePath, store, aliases, config.roots);
    resolveCalls(pr.rawCalls, store);
  }

  const stats = store.stats();

  const result: IndexResult = {
    filesIndexed: parseResults.filter((r) => r.errors.length === 0).length,
    filesErrored: errors.length,
    totalNodes:   stats.totalNodes,
    totalEdges:   stats.totalEdges,
    durationMs:   Date.now() - t0,
    errors,
  };

  // Auto-save to cache if path is configured
  if (config.cachePath) {
    store.saveToFile(config.cachePath, {
      repoRoot,
      branch: config.branch,
      commit: config.commit,
    });
  }

  return result;
}

// ─── Cache helpers ────────────────────────────────────────────────────────────

export interface CacheLoadResult {
  loaded:   boolean;
  meta:     CacheHeader | null;
  /** Age of the cache in milliseconds (undefined if not loaded) */
  ageMs?:   number;
}

export interface CacheLoadOptions {
  maxAgeMs?: number;
  commit?: string;
}

/**
 * Try to load a previously saved graph from `cachePath`.
 * Returns { loaded: true, meta, ageMs } on success.
 * Returns { loaded: false } if the file is missing, corrupt, or too old.
 */
export function tryLoadCache(
  store:    GraphStore,
  cachePath: string,
  options: CacheLoadOptions | number = {},
): CacheLoadResult {
  const opts: CacheLoadOptions =
    typeof options === 'number' ? { maxAgeMs: options } : options;
  const maxAgeMs = opts.maxAgeMs ?? 24 * 60 * 60 * 1000;

  const meta = store.loadFromFile(cachePath);
  if (!meta) return { loaded: false, meta: null };

  if (opts.commit && meta.commit && meta.commit !== opts.commit) {
    store.clear();
    return { loaded: false, meta, ageMs: 0 };
  }

  const ageMs = meta.savedAt
    ? Date.now() - new Date(meta.savedAt).getTime()
    : Infinity;

  if (ageMs > maxAgeMs) {
    store.clear();
    return { loaded: false, meta, ageMs };
  }

  return { loaded: true, meta, ageMs };
}

// ─── Alias map builder ────────────────────────────────────────────────────────

function buildAliasMap(config: IndexerConfig): Map<string, string> {
  const map = new Map<string, string>();

  // User-supplied aliases
  for (const [alias, target] of Object.entries(config.aliases ?? {})) {
    map.set(alias, target);
  }

  // Quasar built-ins: `src/` and `components/` resolve relative to mdui root
  const mduiRoot  = config.roots.find((r) => r.includes('mdui'));
  const mdbffRoot = config.roots.find((r) => r.includes('mdbff'));

  if (mduiRoot) {
    const srcDir = path.join(mduiRoot, 'src');
    map.set('src/', srcDir + '/');
    map.set('components/', path.join(srcDir, 'components') + '/');
    map.set('assets/',     path.join(srcDir, 'assets') + '/');
    map.set('store/',      path.join(srcDir, 'store') + '/');
    map.set('boot/',       path.join(srcDir, 'boot') + '/');
  }

  if (mdbffRoot) {
    // BFF doesn't use aliases — all imports are relative
  }

  return map;
}

// ─── Import resolution ────────────────────────────────────────────────────────

const RESOLVABLE_EXTS = ['.vue', '.js', '.mjs', '.ts', '.graphql', '.gql', ''];

function resolveImports(
  rawImports: RawImport[],
  fromFile:   string,
  store:      GraphStore,
  aliases:    Map<string, string>,
  roots:      string[],
): void {
  for (const ri of rawImports) {
    // Skip npm packages (no path separator at start, no alias match)
    const resolved = resolveImportPath(ri.source, fromFile, aliases, roots);
    if (!resolved) continue;

    // Find the file node in the store
    const targetNode = findFileNode(resolved, store);
    if (!targetNode) continue;

    const fromFileNode = findFileNodeByPath(fromFile, store);
    if (!fromFileNode) continue;

    // Avoid duplicate import edges
    const edgeId = `${fromFileNode.id}--imports--${targetNode.id}`;
    if (store.getEdge(edgeId)) continue;

    const edge: CodeEdge = {
      id:     edgeId,
      kind:   'imports',
      fromId: fromFileNode.id,
      toId:   targetNode.id,
      label:  ri.specifiers.join(', '),
      loc:    ri.loc,
    };
    store.addEdge(edge);
  }
}

function resolveImportPath(
  source:  string,
  fromFile: string,
  aliases:  Map<string, string>,
  roots:    string[],
): string | null {
  // npm package — skip
  if (!source.startsWith('.') && !source.startsWith('/')) {
    // Try aliases first
    for (const [prefix, target] of aliases) {
      if (source.startsWith(prefix)) {
        const remainder = source.slice(prefix.length);
        const candidate = path.join(target, remainder);
        return resolveWithExtensions(candidate);
      }
    }
    return null; // npm package
  }

  // Relative path
  const base = path.resolve(path.dirname(fromFile), source);
  return resolveWithExtensions(base);
}

function resolveWithExtensions(base: string): string | null {
  // Already has an extension
  if (path.extname(base) && fs.existsSync(base)) return base;

  // Try adding extensions
  for (const ext of RESOLVABLE_EXTS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }

  // Try index files
  for (const ext of ['.js', '.mjs', '.ts', '.vue']) {
    const candidate = path.join(base, `index${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function findFileNode(absolutePath: string, store: GraphStore): CodeNode | undefined {
  const nodes = store.getNodesByFile(absolutePath);
  return nodes.find((n) => n.kind === 'file');
}

function findFileNodeByPath(absolutePath: string, store: GraphStore): CodeNode | undefined {
  return findFileNode(absolutePath, store);
}

// ─── Call resolution ──────────────────────────────────────────────────────────

function resolveCalls(rawCalls: RawCall[], store: GraphStore): void {
  for (const rc of rawCalls) {
    // Find caller node
    const caller = store.getNode(rc.fromScopeId);
    if (!caller) continue;

    // Look up callee by name — prefer functions/methods in same file first
    const candidates = store.getNodesByName(rc.callee).filter(
      (n) => n.kind === 'function' || n.kind === 'method' || n.kind === 'graphql-resolver',
    );

    if (candidates.length === 0) continue;

    // Heuristic: pick the candidate in the same file first, then any
    const target =
      candidates.find((n) => n.filePath === caller.filePath) ?? candidates[0];

    if (target.id === caller.id) continue; // skip self-calls

    const edgeId = `${caller.id}--calls--${target.id}`;
    if (store.getEdge(edgeId)) continue;

    const edge: CodeEdge = {
      id:     edgeId,
      kind:   'calls',
      fromId: caller.id,
      toId:   target.id,
      label:  rc.callee,
      loc:    rc.loc,
    };
    store.addEdge(edge);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute the longest common directory ancestor of a list of absolute paths */
function commonAncestor(paths: string[]): string {
  if (paths.length === 0) return '/';
  if (paths.length === 1) return path.dirname(paths[0]);
  const parts = paths.map((p) => p.split(path.sep));
  const min = Math.min(...parts.map((p) => p.length));
  let i = 0;
  while (i < min && parts.every((p) => p[i] === parts[0][i])) i++;
  return parts[0].slice(0, i).join(path.sep) || path.sep;
}

// ─── Default config for this monorepo ────────────────────────────────────────

export function defaultConfig(repoRoot: string, branch = 'develop'): IndexerConfig {
  return {
    repoRoot,
    branch,
    cachePath: cachePathForBranch(branch),
    roots: [
      path.join(repoRoot, 'mdui'),
      path.join(repoRoot, 'mdbff'),
    ],
    ignore: [
      '**/*.min.js',
      '**/vendor/**',
      '**/mock*/**',
    ],
    concurrency: 20,
  };
}

/** Default cache file path for a branch */
export function defaultCachePath(branch: string): string {
  return cachePathForBranch(branch);
}

export { cachePathForBranch };
