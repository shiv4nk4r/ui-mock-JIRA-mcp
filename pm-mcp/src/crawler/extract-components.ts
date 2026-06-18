/**
 * Component snapshot extraction.
 *
 * Slices self-contained rendered subtrees from a page, keyed by well-known
 * Quasar / app root classes, computes a structural signature for dedupe, and
 * provides a best-effort mapping back to a source SFC.
 */

import fs from "node:fs";
import path from "node:path";

import fg from "fast-glob";
import type { Page } from "playwright";

/** Root selectors we treat as reusable component snapshots. */
export const COMPONENT_SELECTORS: string[] = [
  ".q-table",
  ".q-dialog",
  ".q-menu",
  ".q-drawer",
  ".q-card",
  ".q-banner",
  ".q-tabs",
  ".q-toolbar",
  ".q-table__top",
  ".q-form",
  ".q-list",
  ".q-stepper",
  ".q-expansion-item",
  ".q-tab-panels",
];

export interface RawSnapshot {
  componentKey: string;
  html: string;
  signature: string;
}

/**
 * Runs in the browser: for each selector, return the outerHTML + a structural
 * signature for the first few matching elements (top-level only — skips nested
 * matches of the same selector to keep snapshots self-contained).
 */
export async function collectSnapshots(
  page: Page,
  selectors: string[],
  perSelector = 3,
  maxHtml = 60_000
): Promise<RawSnapshot[]> {
  return page.evaluate(
    ({ selectors, perSelector, maxHtml }) => {
      const results: Array<{ componentKey: string; html: string; signature: string }> = [];

      const signatureOf = (el: Element): string => {
        const parts: string[] = [];
        const visit = (node: Element, depth: number) => {
          if (depth > 2) return;
          const cls = Array.from(node.classList).sort().join(".");
          parts.push(`${node.tagName.toLowerCase()}${cls ? "." + cls : ""}`);
          if (depth < 2) {
            for (const child of Array.from(node.children)) visit(child, depth + 1);
          }
        };
        visit(el, 0);
        return parts.join(">");
      };

      for (const selector of selectors) {
        const key = selector.replace(/^\./, "");
        const all = Array.from(document.querySelectorAll(selector));
        // Keep only top-level matches (not contained in another match).
        const topLevel = all.filter(
          (el) => !all.some((other) => other !== el && other.contains(el))
        );
        let count = 0;
        for (const el of topLevel) {
          if (count >= perSelector) break;
          const rect = (el as HTMLElement).getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue; // skip hidden
          const html = (el as HTMLElement).outerHTML;
          if (!html || html.length > maxHtml) continue;
          results.push({ componentKey: key, html, signature: signatureOf(el) });
          count++;
        }
      }
      return results;
    },
    { selectors, perSelector, maxHtml }
  );
}

/** Dedupe snapshots by (componentKey + signature), keeping the first seen. */
export function dedupeSnapshots(snapshots: RawSnapshot[]): RawSnapshot[] {
  const seen = new Set<string>();
  const out: RawSnapshot[] = [];
  for (const s of snapshots) {
    const k = `${s.componentKey}::${s.signature}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

// ── Best-effort source mapping ────────────────────────────────────────────────

let sourceIndex: Map<string, string> | null = null;

/** Build a kebab-case-name → relative SFC path index from the repo checkout. */
function buildSourceIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const repoRoot = process.env.REPO_ROOT;
  if (!repoRoot) return index;
  const mduiSrc = path.join(repoRoot, "mdui", "src");
  if (!fs.existsSync(mduiSrc)) return index;

  const files = fg.sync(["components/**/*.vue", "pages/**/*.vue"], {
    cwd: mduiSrc,
    onlyFiles: true,
  });
  for (const rel of files) {
    const base = path.basename(rel, ".vue");
    const kebab = base
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/_/g, "-")
      .toLowerCase();
    index.set(kebab, path.join("mdui", "src", rel).replace(/\\/g, "/"));
  }
  return index;
}

/**
 * Best-effort: match an app component class on the rendered element to a source
 * SFC by kebab-case file name. Quasar library components (q-*) intentionally
 * return undefined — they have no SFC in the repo.
 */
export function mapToSource(html: string): string | undefined {
  if (!sourceIndex) sourceIndex = buildSourceIndex();
  if (sourceIndex.size === 0) return undefined;

  // Pull class names off the root element only.
  const m = html.match(/^<[a-zA-Z0-9-]+[^>]*\sclass=("|')([^"']+)\1/);
  if (!m) return undefined;
  const classes = m[2].split(/\s+/).filter((c) => c && !c.startsWith("q-"));
  for (const cls of classes) {
    const hit = sourceIndex.get(cls.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}
