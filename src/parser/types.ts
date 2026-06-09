// ─────────────────────────────────────────────────────────────────────────────
// Core graph types for the MCP code-parsing engine.
// These are the canonical data structures exchanged between parser → graph-store
// → MCP tools.
// ─────────────────────────────────────────────────────────────────────────────

export type NodeKind =
  | 'file'              // one node per source file
  | 'function'          // function declaration / arrow / expression
  | 'class'             // class declaration
  | 'method'            // class method (instance or static)
  | 'variable'          // const/let/var top-level binding
  | 'vue-component'     // export default { ... } inside a .vue SFC
  | 'graphql-type'      // GraphQL ObjectTypeDefinition / InputObjectType / etc.
  | 'graphql-operation' // Query / Mutation / Subscription field definition
  | 'graphql-resolver'; // resolver function body inside a BFF resolver object

export type EdgeKind =
  | 'contains'  // structural parent → child  (file→fn, class→method)
  | 'imports'   // file imports identifier from another module
  | 'calls'     // function/method calls another function (local or cross-file)
  | 'uses'      // vue-component dynamically imports another component
  | 'resolves'; // graphql-resolver handles a graphql-operation/type

// ─── Location ───────────────────────────────────────────────────────────────

export interface SourceLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

// ─── Nodes ──────────────────────────────────────────────────────────────────

export interface CodeNode {
  /** Globally unique ID: "<relativePath>::<kind>::<scopePath>" */
  id: string;
  kind: NodeKind;
  /** Short identifier name (function name, class name, variable name, …) */
  name: string;
  /** Absolute file path */
  filePath: string;
  /** Dot-separated scope path inside the file, e.g. "MyClass.myMethod" */
  scopePath: string;
  /** Character range in the source file (adjusted for Vue SFC script offset) */
  loc: SourceLocation;
  metadata: NodeMetadata;
}

export interface NodeMetadata {
  isExported?: boolean;
  isDefault?: boolean;
  isAsync?: boolean;
  isStatic?: boolean;            // method: static keyword
  isArrow?: boolean;             // function: arrow function
  params?: string[];             // function/method param names
  // Vue SFC specific
  props?: string[];
  emits?: string[];
  computed?: string[];
  dataKeys?: string[];
  methods?: string[];
  mixins?: string[];
  apolloQueries?: string[];
  components?: string[];
  // GraphQL specific
  graphqlKind?: string;          // 'ObjectType' | 'InputType' | 'EnumType' | 'ScalarType' | ...
  graphqlOperation?: string;     // 'Query' | 'Mutation' | 'Subscription' | parent type name
  graphqlFields?: string[];      // field names on a GraphQL type
  // language info
  language?: 'js' | 'ts' | 'vue' | 'graphql';
  [key: string]: unknown;
}

// ─── Edges ──────────────────────────────────────────────────────────────────

export interface CodeEdge {
  /** Unique edge ID: "<fromId>--<kind>--<toId>" */
  id: string;
  kind: EdgeKind;
  fromId: string;
  toId: string;
  /** Human-readable label — imported name, callee name, etc. */
  label?: string;
  /** Where in the source this edge originates */
  loc?: SourceLocation;
}

// ─── Parse result ────────────────────────────────────────────────────────────
// Returned by parseFile(); consumed by the indexer to populate the graph store.

export interface ParseResult {
  filePath: string;
  nodes: CodeNode[];
  edges: CodeEdge[];
  errors: string[];
  /** Unresolved import records; the indexer resolves them to file nodes */
  rawImports: RawImport[];
  /** Unresolved call sites; the indexer resolves them to function nodes */
  rawCalls: RawCall[];
}

export interface RawImport {
  /** The raw import path string (may be relative, aliased, or npm) */
  source: string;
  /** Named specifiers imported (includes "default" for default imports) */
  specifiers: string[];
  isDefaultImport: boolean;
  loc: SourceLocation;
  /** ID of the file node that owns this import */
  fromFileId: string;
}

export interface RawCall {
  /** Bare callee name (e.g. "fetchOrders", "this.myMethod" → "myMethod") */
  callee: string;
  /** Node ID of the function/method scope that contains this call */
  fromScopeId: string;
  loc: SourceLocation;
}

// ─── Indexer config ──────────────────────────────────────────────────────────

export interface IndexerConfig {
  /** Absolute paths of directories to scan */
  roots: string[];
  /**
   * Base for relative node IDs. Defaults to the common ancestor of all roots.
   * Set this explicitly to the monorepo root for stable node IDs.
   */
  repoRoot?: string;
  /**
   * Absolute path to the cache file.
   * When set, buildIndex() saves the graph here after completion.
   * tryLoadCache() reads from this path.
   */
  cachePath?: string;
  /** Glob patterns to exclude (relative to root) */
  ignore?: string[];
  /** Quasar / Webpack import aliases to resolve */
  aliases?: Record<string, string>;
  /** Max files to parse concurrently */
  concurrency?: number;
}

// ─── Graph query helpers (returned by GraphStore methods) ────────────────────

export interface SymbolSearchResult {
  node: CodeNode;
  /** Inbound edges (e.g. callers) */
  inEdges: CodeEdge[];
  /** Outbound edges (e.g. callees, imports) */
  outEdges: CodeEdge[];
}

export interface FileStructure {
  file: CodeNode;
  children: CodeNode[];          // all nodes directly contained by this file
  imports: CodeEdge[];           // imports edges originating from this file
  importedBy: CodeEdge[];        // imports edges pointing to this file
}
