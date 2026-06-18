/**
 * test-parser.ts — Runnable test script for the parsing engine.
 *
 * Run with:
 *   npx ts-node --esm src/parser/test-parser.ts
 * OR (after installing ts-node):
 *   npx ts-node src/parser/test-parser.ts
 *
 * Outputs a human-readable ASCII graph of the mockCode.js parse result,
 * followed by a suite of assertions.  Exits with code 1 if any assertion fails.
 */

import path from 'path';
import { parseFile }                              from './parser';
import { GraphStore }                             from './graph-store';
import { buildIndex, defaultConfig, tryLoadCache,
         defaultCachePath }                       from './indexer';
import type { CodeNode, CodeEdge }                from './types';

const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';

// ─── Pretty-print helpers ──────────────────────────────────────────────────

function header(title: string) {
  const bar = '─'.repeat(70);
  console.log(`\n${BOLD}${CYAN}${bar}${RESET}`);
  console.log(`${BOLD}${CYAN}  ${title}${RESET}`);
  console.log(`${BOLD}${CYAN}${bar}${RESET}`);
}

function printNode(n: CodeNode, indent = 0) {
  const pad    = '  '.repeat(indent);
  const kind   = `${YELLOW}[${n.kind}]${RESET}`;
  const name   = `${BOLD}${n.name}${RESET}`;
  const loc    = `${DIM}${n.loc.start.line}:${n.loc.start.column}–${n.loc.end.line}:${n.loc.end.column}${RESET}`;
  const scope  = n.scopePath !== n.name ? `${DIM} (${n.scopePath})${RESET}` : '';
  const meta: string[] = [];
  if (n.metadata.isExported)  meta.push('exported');
  if (n.metadata.isAsync)     meta.push('async');
  if (n.metadata.isStatic)    meta.push('static');
  if (n.metadata.params?.length) meta.push(`params(${n.metadata.params.join(', ')})`);
  if (n.metadata.methods?.length) meta.push(`methods(${(n.metadata.methods as string[]).join(', ')})`);
  const metaStr = meta.length ? `  ${DIM}{ ${meta.join(' | ')} }${RESET}` : '';
  console.log(`${pad}${kind} ${name}${scope} @ ${loc}${metaStr}`);
}

function printEdge(e: CodeEdge, fromName: string, toName: string, indent = 0) {
  const pad    = '  '.repeat(indent);
  const kind   = `${GREEN}--${e.kind}-->` + RESET;
  const label  = e.label ? `  ${DIM}(${e.label})${RESET}` : '';
  console.log(`${pad}${BOLD}${fromName}${RESET} ${kind} ${BOLD}${toName}${RESET}${label}`);
}

// ─── Assertion helpers ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ${GREEN}✓${RESET} ${message}`);
    passed++;
  } else {
    console.log(`  ${RED}✗ FAIL${RESET} ${message}`);
    failed++;
  }
}

function assertCount(label: string, actual: number, expected: number) {
  assert(actual >= expected, `${label}: got ${actual}, expected ≥${expected}`);
}

// ─── Test 1: single-file parse ────────────────────────────────────────────

header('TEST 1 — Single-file parse: mockCode.js');

const MOCK_FILE  = path.resolve(__dirname, 'mockCode.js');
const REPO_ROOT  = path.resolve(__dirname, '../../..');  // poc-mcp/src/parser → manager-dashboard/
const result     = parseFile(MOCK_FILE, REPO_ROOT);

console.log(`\n${BOLD}Parse errors:${RESET} ${result.errors.length === 0 ? GREEN + 'none' + RESET : RED + result.errors.join('; ') + RESET}`);

header('Nodes');
for (const node of result.nodes) {
  printNode(node, node.kind === 'file' ? 0 : 1);
}

header('Structural edges (contains)');
const containsEdges = result.edges.filter((e) => e.kind === 'contains');
for (const e of containsEdges) {
  const from = result.nodes.find((n) => n.id === e.fromId);
  const to   = result.nodes.find((n) => n.id === e.toId);
  if (from && to) printEdge(e, from.name, to.name, 1);
}

header('Call edges (intra-file)');
const callEdges = result.edges.filter((e) => e.kind === 'calls');
for (const e of callEdges) {
  const from = result.nodes.find((n) => n.id === e.fromId);
  const to   = result.nodes.find((n) => n.id === e.toId);
  if (from && to) printEdge(e, from.name, to.name, 1);
}

header('Raw imports (unresolved)');
for (const ri of result.rawImports) {
  console.log(`  ${DIM}import ${JSON.stringify(ri.specifiers)} from ${JSON.stringify(ri.source)}${RESET}`);
}

header('Assertions — mockCode.js');

assert(result.errors.length === 0, 'No parse errors');
assertCount('nodes total',    result.nodes.length, 10);
assertCount('contains edges', containsEdges.length, 8);
assertCount('raw imports',    result.rawImports.length, 3);

const kinds = result.nodes.map((n) => n.kind);
assert(kinds.includes('file'),           'file node present');
assert(kinds.includes('function'),       'function nodes present');
assert(kinds.includes('class'),          'class node present');
assert(kinds.includes('method'),         'method nodes present');
assert(kinds.includes('vue-component'), 'vue-component node present');

const fnNames = result.nodes.filter((n) => n.kind === 'function').map((n) => n.name);
assert(fnNames.includes('validateSlotId'),  'validateSlotId extracted');
assert(fnNames.includes('buildOrderSummary'), 'buildOrderSummary extracted');
assert(fnNames.includes('createRateLimiter'), 'createRateLimiter extracted');

const classNodes = result.nodes.filter((n) => n.kind === 'class');
assert(classNodes.some((n) => n.name === 'WarehouseManager'), 'WarehouseManager class extracted');

const methodNames = result.nodes.filter((n) => n.kind === 'method').map((n) => n.name);
assert(methodNames.includes('init'),           'WarehouseManager.init method extracted');
assert(methodNames.includes('processOrders'),  'WarehouseManager.processOrders method extracted');
assert(methodNames.includes('formatSlotReport'), 'WarehouseManager.formatSlotReport method extracted');

const asyncFns = result.nodes.filter((n) => n.metadata.isAsync);
assert(asyncFns.length > 0, 'async functions detected');

const vueCmp = result.nodes.find((n) => n.kind === 'vue-component');
assert(vueCmp !== undefined, 'vue-component node created from export default');
if (vueCmp) {
  assert((vueCmp.metadata.props as string[])?.includes('warehouseId'), 'prop warehouseId captured');
  assert((vueCmp.metadata.methods as string[])?.includes('fetchOrders'), 'method fetchOrders captured');
  assert((vueCmp.metadata.computed as string[])?.includes('hasOrders'), 'computed hasOrders captured');
}

// ─── Test 2: GraphStore query API ─────────────────────────────────────────

header('TEST 2 — GraphStore query API');

const store = new GraphStore();
for (const node of result.nodes) store.addNode(node);
for (const edge of result.edges) store.addEdge(edge);

const warehouseNodes = store.searchByName('warehouse');
assertCount('searchByName("warehouse") ≥ 2 results', warehouseNodes.length, 2);

const fnKindNodes = store.getNodesByKind('function');
assertCount('getNodesByKind("function") ≥ 5', fnKindNodes.length, 5);

const fileNodes = store.getNodesByKind('file');
assert(fileNodes.length === 1, 'exactly one file node in store');

const fileStruct = store.getFileStructure(MOCK_FILE);
assert(fileStruct !== null, 'getFileStructure returns result');
if (fileStruct) {
  assertCount('file has ≥ 8 children', fileStruct.children.length, 8);
}

const managerNode = store.getNodesByName('WarehouseManager')[0];
if (managerNode) {
  const children = store.getChildren(managerNode.id);
  assertCount('WarehouseManager has ≥ 3 method children', children.length, 3);
}

console.log('');
header(`Stats: ${store.stats().totalNodes} nodes | ${store.stats().totalEdges} edges`);
console.log('');
for (const [k, v] of Object.entries(store.stats())) {
  if (typeof v === 'number') console.log(`  ${DIM}${k.padEnd(20)}${RESET}${BOLD}${v}${RESET}`);
}

// ─── Test 3 (optional): Full codebase index ────────────────────────────────
//
//   --full   Build index from source files and save to cache
//   --load   Load from cache only (instant, no re-scan)
//   (none)   Skip test 3 entirely

const RUN_FULL_INDEX = process.argv.includes('--full');
const LOAD_CACHE     = process.argv.includes('--load');

const REPO_ROOT_FULL = path.resolve(__dirname, '../../..');  // manager-dashboard/

async function runFullIndex(fromCache: boolean) {
  const fullStore  = new GraphStore();
  const cachePath  = defaultCachePath('develop');

  if (fromCache) {
    header('TEST 3 — Load from cache');
    const t0  = Date.now();
    const res = tryLoadCache(fullStore, cachePath, Infinity); // no age limit when explicit --load
    if (!res.loaded) {
      console.log(`  ${RED}Cache not found or invalid: ${cachePath}${RESET}`);
      console.log(`  ${DIM}Run with --full first to build the cache.${RESET}`);
      return;
    }
    const ms = Date.now() - t0;
    console.log(`\n  ${BOLD}Source:${RESET}      cache`);
    console.log(`  ${BOLD}Cache file:${RESET}  ${DIM}${cachePath}${RESET}`);
    console.log(`  ${BOLD}Saved at:${RESET}    ${res.meta?.savedAt ?? '?'}`);
    console.log(`  ${BOLD}Age:${RESET}         ${Math.round((res.ageMs ?? 0) / 1000)}s`);
    console.log(`  ${BOLD}Load time:${RESET}   ${ms}ms`);
  } else {
    header('TEST 3 — Full codebase index (mdui + mdbff)');
    console.log(`${DIM}This may take 10–30 seconds for ~1 000 files...${RESET}`);

    const indexResult = await buildIndex(fullStore, defaultConfig(REPO_ROOT_FULL, 'develop'));

    console.log(`\n  ${BOLD}Files indexed:${RESET}  ${GREEN}${indexResult.filesIndexed}${RESET}`);
    console.log(`  ${BOLD}Files errored:${RESET}  ${indexResult.filesErrored > 0 ? RED : GREEN}${indexResult.filesErrored}${RESET}`);
    console.log(`  ${BOLD}Total nodes:${RESET}    ${indexResult.totalNodes}`);
    console.log(`  ${BOLD}Total edges:${RESET}    ${indexResult.totalEdges}`);
    console.log(`  ${BOLD}Duration:${RESET}       ${indexResult.durationMs}ms`);
    console.log(`  ${BOLD}Cache saved:${RESET}    ${DIM}${cachePath}${RESET}`);

    if (indexResult.errors.length > 0) {
      console.log(`\n  ${RED}Sample errors (first 5):${RESET}`);
      for (const e of indexResult.errors.slice(0, 5)) {
        console.log(`    ${DIM}${path.basename(e.file)}: ${e.error.slice(0, 80)}${RESET}`);
      }
    }
  }

  const fullStats = fullStore.stats();
  console.log(`\n  ${BOLD}Kind breakdown:${RESET}`);
  for (const [k, v] of Object.entries(fullStats)) {
    if (typeof v === 'number' && !['totalNodes','totalEdges','indexedFiles'].includes(k)) {
      console.log(`    ${DIM}${k.padEnd(22)}${RESET}${v}`);
    }
  }

  const outboundListResolver = fullStore.searchByName('outboundOrderList', 5, 'graphql-resolver');
  assert(outboundListResolver.length > 0, 'BFF resolver outboundOrderList indexed');

  const vueCmps = fullStore.getNodesByKind('vue-component');
  assertCount('vue-component nodes ≥ 50', vueCmps.length, 50);
}

async function main() {
  if (RUN_FULL_INDEX || LOAD_CACHE) {
    await runFullIndex(LOAD_CACHE);
  } else {
    console.log(`\n${DIM}  (skip full index — run with --full to build+save, --load to read cache)${RESET}`);
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  header('Results');
  const total = passed + failed;
  const pct   = total > 0 ? Math.round((passed / total) * 100) : 0;
  console.log(`\n  ${BOLD}${passed}/${total} assertions passed (${pct}%)${RESET}`);
  if (failed > 0) {
    console.log(`  ${RED}${failed} FAILED${RESET}`);
    process.exit(1);
  } else {
    console.log(`  ${GREEN}All assertions passed ✓${RESET}`);
  }
  console.log('');
}

main().catch((e) => { console.error(e); process.exit(1); });
