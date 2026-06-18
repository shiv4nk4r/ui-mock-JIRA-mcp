/**
 * graph-store.ts — In-memory code knowledge graph.
 *
 * Stores all CodeNode and CodeEdge objects produced by the parser/indexer and
 * exposes a query API used by the MCP tools.  Every lookup is O(1) or O(k)
 * (where k = result count) via four secondary indexes:
 *
 *   nodesByFile    — filePath  → Set<nodeId>
 *   nodesByName    — lowercase name → Set<nodeId>     (fuzzy search)
 *   nodesByKind    — NodeKind  → Set<nodeId>
 *   outEdges       — fromId    → CodeEdge[]            (callee / contains)
 *   inEdges        — toId      → CodeEdge[]            (caller / importedBy)
 */

import fs   from 'fs';
import path from 'path';

import type {
  CodeEdge,
  CodeNode,
  EdgeKind,
  FileStructure,
  NodeKind,
  SymbolSearchResult,
} from './types';

export class GraphStore {
  private nodes    = new Map<string, CodeNode>();
  private edges    = new Map<string, CodeEdge>();

  // Indexes
  private byFile   = new Map<string, Set<string>>(); // filePath → node ids
  private byName   = new Map<string, Set<string>>(); // lowercase name → node ids
  private byKind   = new Map<NodeKind, Set<string>>();
  private outEdges = new Map<string, CodeEdge[]>();   // fromId → edges
  private inEdges  = new Map<string, CodeEdge[]>();   // toId   → edges

  // ── Write API ──────────────────────────────────────────────────────────────

  addNode(node: CodeNode): void {
    if (this.nodes.has(node.id)) return; // idempotent
    this.nodes.set(node.id, node);

    // byFile
    if (!this.byFile.has(node.filePath)) this.byFile.set(node.filePath, new Set());
    this.byFile.get(node.filePath)!.add(node.id);

    // byName — normalised to lowercase for case-insensitive search
    const key = node.name.toLowerCase();
    if (!this.byName.has(key)) this.byName.set(key, new Set());
    this.byName.get(key)!.add(node.id);

    // byKind
    if (!this.byKind.has(node.kind)) this.byKind.set(node.kind, new Set());
    this.byKind.get(node.kind)!.add(node.id);
  }

  addEdge(edge: CodeEdge): void {
    if (this.edges.has(edge.id)) return;
    this.edges.set(edge.id, edge);

    if (!this.outEdges.has(edge.fromId)) this.outEdges.set(edge.fromId, []);
    this.outEdges.get(edge.fromId)!.push(edge);

    if (!this.inEdges.has(edge.toId)) this.inEdges.set(edge.toId, []);
    this.inEdges.get(edge.toId)!.push(edge);
  }

  clear(): void {
    this.nodes.clear();
    this.edges.clear();
    this.byFile.clear();
    this.byName.clear();
    this.byKind.clear();
    this.outEdges.clear();
    this.inEdges.clear();
  }

  // ── Read API ───────────────────────────────────────────────────────────────

  getNode(id: string): CodeNode | undefined {
    return this.nodes.get(id);
  }

  getEdge(id: string): CodeEdge | undefined {
    return this.edges.get(id);
  }

  /** All nodes in a file (including the file node itself) */
  getNodesByFile(filePath: string): CodeNode[] {
    const ids = this.byFile.get(filePath);
    if (!ids) return [];
    return [...ids].map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  /** All nodes of a specific kind (e.g. all 'vue-component' nodes) */
  getNodesByKind(kind: NodeKind): CodeNode[] {
    const ids = this.byKind.get(kind);
    if (!ids) return [];
    return [...ids].map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  /** Case-insensitive exact name match */
  getNodesByName(name: string): CodeNode[] {
    const ids = this.byName.get(name.toLowerCase());
    if (!ids) return [];
    return [...ids].map((id) => this.nodes.get(id)!).filter(Boolean);
  }

  /**
   * Fuzzy name search — returns nodes whose name contains the query string
   * (case-insensitive).  Capped at `limit` results (default 50).
   */
  searchByName(query: string, limit = 50, kind?: NodeKind): CodeNode[] {
    const q       = query.toLowerCase();
    const results: CodeNode[] = [];
    for (const [key, ids] of this.byName) {
      if (!key.includes(q)) continue;
      for (const id of ids) {
        const node = this.nodes.get(id);
        if (!node) continue;
        if (kind && node.kind !== kind) continue;
        results.push(node);
        if (results.length >= limit) return results;
      }
    }
    return results;
  }

  /** Outbound edges from a node (e.g. what a file imports, who a function calls) */
  getOutEdges(nodeId: string, kind?: EdgeKind): CodeEdge[] {
    const all = this.outEdges.get(nodeId) ?? [];
    return kind ? all.filter((e) => e.kind === kind) : all;
  }

  /** Inbound edges to a node (e.g. who calls a function, who imports a file) */
  getInEdges(nodeId: string, kind?: EdgeKind): CodeEdge[] {
    const all = this.inEdges.get(nodeId) ?? [];
    return kind ? all.filter((e) => e.kind === kind) : all;
  }

  // ── Compound queries ───────────────────────────────────────────────────────

  /** All direct callers of a function/method node */
  getCallers(nodeId: string): CodeNode[] {
    return this.getInEdges(nodeId, 'calls')
      .map((e) => this.nodes.get(e.fromId)!)
      .filter(Boolean);
  }

  /** All functions/methods directly called by a node */
  getCallees(nodeId: string): CodeNode[] {
    return this.getOutEdges(nodeId, 'calls')
      .map((e) => this.nodes.get(e.toId)!)
      .filter(Boolean);
  }

  /** Files that a given file imports (direct dependencies) */
  getImports(fileNodeId: string): CodeNode[] {
    return this.getOutEdges(fileNodeId, 'imports')
      .map((e) => this.nodes.get(e.toId)!)
      .filter(Boolean);
  }

  /** Files that import a given file (reverse dependency) */
  getImportedBy(fileNodeId: string): CodeNode[] {
    return this.getInEdges(fileNodeId, 'imports')
      .map((e) => this.nodes.get(e.fromId)!)
      .filter(Boolean);
  }

  /** Children contained by a node (file → functions/classes/components, class → methods) */
  getChildren(nodeId: string): CodeNode[] {
    return this.getOutEdges(nodeId, 'contains')
      .map((e) => this.nodes.get(e.toId)!)
      .filter(Boolean);
  }

  /** Full file structure: file node + its direct children + import/importedBy edges */
  getFileStructure(filePath: string): FileStructure | null {
    const allNodes = this.getNodesByFile(filePath);
    const fileNode = allNodes.find((n) => n.kind === 'file');
    if (!fileNode) return null;

    const children = this.getChildren(fileNode.id);
    const imports  = this.getOutEdges(fileNode.id, 'imports');
    const importedBy = this.getInEdges(fileNode.id, 'imports');

    return { file: fileNode, children, imports, importedBy };
  }

  /**
   * Symbol search: returns a node with its in/out edges.
   * Used by the `search-code-symbols` MCP tool.
   */
  getSymbolDetail(nodeId: string): SymbolSearchResult | null {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    return {
      node,
      inEdges:  this.getInEdges(nodeId),
      outEdges: this.getOutEdges(nodeId),
    };
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  stats(): Record<string, number> {
    const kindCounts: Record<string, number> = {};
    for (const [kind, ids] of this.byKind) {
      kindCounts[kind] = ids.size;
    }
    return {
      totalNodes: this.nodes.size,
      totalEdges: this.edges.size,
      indexedFiles: (this.byKind.get('file') ?? new Set()).size,
      ...kindCounts,
    };
  }

  // ── Serialisation ─────────────────────────────────────────────────────────

  toJSON(): { nodes: CodeNode[]; edges: CodeEdge[] } {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
    };
  }

  /** Bulk-load nodes and edges from a plain object (e.g. parsed cache file). */
  hydrate(data: { nodes: CodeNode[]; edges: CodeEdge[] }): void {
    for (const node of data.nodes) this.addNode(node);
    for (const edge of data.edges) this.addEdge(edge);
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  /**
   * Write the graph + a metadata header to a JSON file.
   * Creates parent directories as needed.
   */
  saveToFile(filePath: string, meta: CacheHeader = {}): void {
    const payload: CacheFile = {
      version:   CACHE_VERSION,
      savedAt:   new Date().toISOString(),
      ...meta,
      ...this.toJSON(),
    };
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(payload), 'utf-8');
  }

  /**
   * Load a previously saved cache file into this store.
   * Returns the cache metadata (version, savedAt, repoRoot) or null if the
   * file is missing or has a version mismatch.
   */
  loadFromFile(filePath: string): CacheHeader | null {
    if (!fs.existsSync(filePath)) return null;
    let raw: string;
    try {
      raw = fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
    let parsed: CacheFile;
    try {
      parsed = JSON.parse(raw) as CacheFile;
    } catch {
      return null;
    }
    if (parsed.version !== CACHE_VERSION) return null;
    this.hydrate({ nodes: parsed.nodes, edges: parsed.edges });
    return { version: parsed.version, savedAt: parsed.savedAt, repoRoot: parsed.repoRoot };
  }
}

// ── Cache file types ──────────────────────────────────────────────────────────

const CACHE_VERSION = '1';

export interface CacheHeader {
  version?: string;
  savedAt?: string;
  repoRoot?: string;
  branch?: string;
  commit?: string;
}

interface CacheFile extends CacheHeader {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

// ── Module-level singleton ────────────────────────────────────────────────────
// One shared instance across all MCP tool calls within the same Node.js process.
// Re-built by the indexer when `rebuildIndex()` is called.

export const codeGraph = new GraphStore();
