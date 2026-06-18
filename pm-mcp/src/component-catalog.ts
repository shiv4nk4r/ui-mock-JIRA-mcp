import path from "node:path";

import type { GraphStore } from "./parser/graph-store";
import type { CodeNode } from "./parser/types";

export type ComponentScope = "components" | "pages" | "both";

const COMPONENTS_SEG = `${path.sep}components${path.sep}`;
const PAGES_SEG = `${path.sep}pages${path.sep}`;

export function componentScopeOf(filePath: string): ComponentScope | null {
  if (filePath.includes(COMPONENTS_SEG)) return "components";
  if (filePath.includes(PAGES_SEG)) return "pages";
  return null;
}

/** A reusable component is a vue-component node under mdui/src/components or /pages. */
export function isReusableComponent(node: CodeNode): boolean {
  return node.kind === "vue-component" && componentScopeOf(node.filePath) !== null;
}

export interface CatalogEntry {
  name: string;
  relPath: string;
  absPath: string;
  scope: ComponentScope;
  props: string[];
  childComponents: string[];
}

function toEntry(node: CodeNode, repoRoot: string): CatalogEntry {
  const m = (node.metadata ?? {}) as Record<string, unknown>;
  return {
    name: node.name,
    relPath: path.relative(repoRoot, node.filePath),
    absPath: node.filePath,
    scope: componentScopeOf(node.filePath) ?? "components",
    props: (m.props as string[]) ?? [],
    childComponents: (m.components as string[]) ?? [],
  };
}

export function listReusableComponents(
  graph: GraphStore,
  repoRoot: string,
  opts: { query?: string; scope?: ComponentScope; limit?: number } = {}
): CatalogEntry[] {
  const { query, scope = "both", limit = 200 } = opts;
  const q = query?.toLowerCase().trim();

  let nodes = graph.getNodesByKind("vue-component").filter(isReusableComponent);
  if (scope !== "both") {
    nodes = nodes.filter((n) => componentScopeOf(n.filePath) === scope);
  }
  if (q) {
    nodes = nodes.filter(
      (n) =>
        n.name.toLowerCase().includes(q) ||
        n.filePath.toLowerCase().includes(q)
    );
  }

  const entries = nodes.map((n) => toEntry(n, repoRoot));
  // Rank exact-name matches first, then components/ over pages/, then alpha.
  entries.sort((a, b) => {
    if (q) {
      const ae = a.name.toLowerCase() === q ? 0 : 1;
      const be = b.name.toLowerCase() === q ? 0 : 1;
      if (ae !== be) return ae - be;
    }
    if (a.scope !== b.scope) return a.scope === "components" ? -1 : 1;
    return a.relPath.localeCompare(b.relPath);
  });

  return entries.slice(0, limit);
}

/** Resolve a single component by name or relative/absolute path. */
export function resolveComponent(
  graph: GraphStore,
  repoRoot: string,
  query: string
): CatalogEntry | undefined {
  const raw = query.trim();
  const normalized = raw.replace(/^\/+/, "").toLowerCase();

  const all = graph.getNodesByKind("vue-component").filter(isReusableComponent);

  // 1) Exact path match (rel or abs), with or without .vue
  const byPath = all.find((n) => {
    const rel = path.relative(repoRoot, n.filePath).toLowerCase();
    return (
      rel === normalized ||
      rel === `${normalized}.vue` ||
      n.filePath.toLowerCase() === normalized ||
      rel.endsWith(`/${normalized}`) ||
      rel.endsWith(`/${normalized}.vue`)
    );
  });
  if (byPath) return toEntry(byPath, repoRoot);

  // 2) Exact name match (e.g. "OrderListing")
  const baseName = raw.replace(/\.vue$/i, "");
  const byName = all.filter((n) => n.name.toLowerCase() === baseName.toLowerCase());
  if (byName.length) {
    byName.sort((a, b) =>
      componentScopeOf(a.filePath) === "components" ? -1 : 1
    );
    return toEntry(byName[0], repoRoot);
  }

  // 3) Fuzzy fallback
  const fuzzy = listReusableComponents(graph, repoRoot, { query: raw, limit: 1 });
  return fuzzy[0];
}

export interface ReferenceCheck {
  ref: string;
  resolved: boolean;
  match?: string;
  suggestions?: string[];
}

export function validateComponentRefs(
  graph: GraphStore,
  repoRoot: string,
  refs: string[]
): ReferenceCheck[] {
  return refs.map((ref) => {
    const hit = resolveComponent(graph, repoRoot, ref);
    const exact =
      hit &&
      (hit.name.toLowerCase() === ref.replace(/\.vue$/i, "").toLowerCase() ||
        hit.relPath.toLowerCase().endsWith(ref.toLowerCase().replace(/^\/+/, "")));
    if (exact && hit) {
      return { ref, resolved: true, match: hit.relPath };
    }
    const suggestions = listReusableComponents(graph, repoRoot, {
      query: ref,
      limit: 5,
    }).map((e) => e.relPath);
    return { ref, resolved: false, suggestions };
  });
}

export function formatCatalog(entries: CatalogEntry[]): string {
  if (entries.length === 0) return "No reusable components found.";
  const lines = entries.map((e) => {
    const propStr = e.props.length ? ` · props: ${e.props.slice(0, 8).join(", ")}${e.props.length > 8 ? "…" : ""}` : "";
    return `  ${e.name} — ${e.relPath}${propStr}`;
  });
  return lines.join("\n");
}
