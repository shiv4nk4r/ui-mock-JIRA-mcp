/**
 * Component snapshot extraction — slices self-contained rendered subtrees
 * keyed on well-known Quasar root classes.
 */

import path from "node:path";

import fg from "fast-glob";
import type { Page } from "playwright";

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
          if (depth < 2) for (const c of Array.from(node.children)) visit(c, depth + 1);
        };
        visit(el, 0);
        return parts.join(">");
      };

      for (const selector of selectors) {
        const key = selector.replace(/^\./, "");
        const all = Array.from(document.querySelectorAll(selector));
        const topLevel = all.filter(
          (el) => !all.some((other) => other !== el && other.contains(el))
        );
        let count = 0;
        for (const el of topLevel) {
          if (count >= perSelector) break;
          const rect = (el as HTMLElement).getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
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

export function dedupeSnapshots(snapshots: RawSnapshot[]): RawSnapshot[] {
  const seen = new Set<string>();
  return snapshots.filter((s) => {
    if (seen.has(s.signature)) return false;
    seen.add(s.signature);
    return true;
  });
}

export async function mapToSource(
  componentKey: string,
  repoRoot: string
): Promise<string | undefined> {
  const mdui = path.join(repoRoot, "mdui/src");
  if (!mdui) return undefined;
  try {
    const candidates = await fg(`**/*${componentKey}*.vue`, { cwd: mdui, absolute: true });
    return candidates[0];
  } catch {
    return undefined;
  }
}
