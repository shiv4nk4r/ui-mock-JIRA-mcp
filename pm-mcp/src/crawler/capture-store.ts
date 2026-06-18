/**
 * Capture store — shared types + filesystem read/write helpers for the rendered
 * capture maps produced by the crawler and served by the MCP server.
 *
 * This module is intentionally free of any Playwright / browser dependency so it
 * can be imported by the running MCP server (which never launches a browser).
 *
 * Layout under pm-mcp/.cache/captures/<label>/:
 *   manifest.json          index of pages, component ids, css bundle ids
 *   pages/<slug>.json      one CapturedPage per route
 *   components/<id>.json   one CapturedComponent per rendered component/modal
 *   styles/<hash>.css      compiled global CSS bundles, deduped by content hash
 *   screenshots/*.png      page + component screenshots
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PM_MCP_ROOT } from "../paths";

export const CAPTURES_ROOT = path.join(PM_MCP_ROOT, ".cache", "captures");
export const CAPTURE_VERSION = "1";

/** Sanitize a label (branch name or custom tag) for safe directory usage. */
export function safeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._/-]/g, "_");
}

export function captureDir(label: string): string {
  return path.join(CAPTURES_ROOT, safeLabel(label));
}

/** Turn a route path into a filesystem-safe slug. `/` → "root". */
export function slugifyRoute(route: string): string {
  const trimmed = route.replace(/[?#].*$/, "").replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "root";
  return trimmed.replace(/\//g, "__").replace(/[^a-zA-Z0-9._-]/g, "-");
}

export interface CapturedModalRef {
  id: string;
  trigger: string;
}

export interface CapturedPage {
  route: string;
  slug: string;
  url: string;
  title: string;
  /** Full rendered outer HTML of the document (optionally sanitized). */
  html: string;
  /** Screenshot file name under screenshots/, if captured. */
  screenshot?: string;
  /** Content-hash ids of CSS bundles that style this page. */
  cssBundleIds: string[];
  /** Component keys detected on the page (e.g. q-table, q-dialog). */
  detectedComponents: string[];
  /** Modal/menu snapshots captured by interacting with the page. */
  modals: CapturedModalRef[];
  capturedAt: string;
  sanitized: boolean;
}

export interface CapturedComponent {
  id: string;
  /** Root selector / Quasar class the snapshot was keyed on, e.g. q-table. */
  componentKey: string;
  /** Best-effort mapping to a source SFC (mdui/src/...vue), when found. */
  sourceMatch?: string;
  /** Route the snapshot was captured from. */
  route: string;
  /** Self-contained rendered HTML subtree. */
  renderedHtml: string;
  screenshot?: string;
  kind: "component" | "modal";
  /** For modals: the trigger text/selector that opened it. */
  trigger?: string;
  /** Structural signature used to dedupe near-identical snapshots. */
  signature: string;
}

export interface PageSummary {
  route: string;
  slug: string;
  title: string;
  screenshot?: string;
  componentCount: number;
  modalCount: number;
}

export interface CaptureManifest {
  version: string;
  label: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
  /** Git commit / build id of the live app at capture time, if known. */
  appCommit?: string;
  pages: PageSummary[];
  componentIds: string[];
  cssBundleIds: string[];
}

// ── Directory helpers ─────────────────────────────────────────────────────────

export function ensureCaptureDirs(label: string): string {
  const dir = captureDir(label);
  for (const sub of ["pages", "components", "styles", "screenshots"]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  return dir;
}

export function manifestPath(label: string): string {
  return path.join(captureDir(label), "manifest.json");
}

export function hasCapture(label: string): boolean {
  return fs.existsSync(manifestPath(label));
}

/** List capture labels (sub-directories containing a manifest), newest first. */
export function listCaptureLabels(): string[] {
  if (!fs.existsSync(CAPTURES_ROOT)) return [];
  const labels: Array<{ label: string; mtime: number }> = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const abs = path.join(dir, entry.name);
      const label = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (fs.existsSync(path.join(abs, "manifest.json"))) {
        labels.push({
          label,
          mtime: fs.statSync(path.join(abs, "manifest.json")).mtimeMs,
        });
      } else {
        walk(abs, label);
      }
    }
  };
  walk(CAPTURES_ROOT, "");
  return labels.sort((a, b) => b.mtime - a.mtime).map((l) => l.label);
}

// ── Manifest ──────────────────────────────────────────────────────────────────

export function readManifest(label: string): CaptureManifest | null {
  const p = manifestPath(label);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as CaptureManifest;
  } catch {
    return null;
  }
}

export function writeManifest(label: string, manifest: CaptureManifest): void {
  ensureCaptureDirs(label);
  fs.writeFileSync(manifestPath(label), JSON.stringify(manifest, null, 2), "utf-8");
}

// ── Pages ─────────────────────────────────────────────────────────────────────

export function writePage(label: string, page: CapturedPage): void {
  const p = path.join(captureDir(label), "pages", `${page.slug}.json`);
  fs.writeFileSync(p, JSON.stringify(page, null, 2), "utf-8");
}

export function readPageBySlug(label: string, slug: string): CapturedPage | null {
  const p = path.join(captureDir(label), "pages", `${slug}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as CapturedPage;
  } catch {
    return null;
  }
}

export function readPageByRoute(label: string, route: string): CapturedPage | null {
  return readPageBySlug(label, slugifyRoute(route));
}

export function listPages(label: string): CapturedPage[] {
  const dir = path.join(captureDir(label), "pages");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as CapturedPage;
      } catch {
        return null;
      }
    })
    .filter((p): p is CapturedPage => p !== null);
}

// ── Components ────────────────────────────────────────────────────────────────

export function writeComponent(label: string, component: CapturedComponent): void {
  const p = path.join(captureDir(label), "components", `${component.id}.json`);
  fs.writeFileSync(p, JSON.stringify(component, null, 2), "utf-8");
}

export function readComponent(label: string, id: string): CapturedComponent | null {
  const p = path.join(captureDir(label), "components", `${id}.json`);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as CapturedComponent;
  } catch {
    return null;
  }
}

export function listComponents(label: string): CapturedComponent[] {
  const dir = path.join(captureDir(label), "components");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      try {
        return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as CapturedComponent;
      } catch {
        return null;
      }
    })
    .filter((c): c is CapturedComponent => c !== null);
}

// ── CSS bundles ───────────────────────────────────────────────────────────────

export function hashContent(content: string): string {
  return crypto.createHash("sha1").update(content).digest("hex").slice(0, 12);
}

/** Persist a CSS bundle deduped by content hash; returns its id. */
export function writeCssBundle(label: string, css: string): string {
  const id = hashContent(css);
  const p = path.join(captureDir(label), "styles", `${id}.css`);
  if (!fs.existsSync(p)) fs.writeFileSync(p, css, "utf-8");
  return id;
}

export function readCssBundle(label: string, id: string): string | null {
  const p = path.join(captureDir(label), "styles", `${id}.css`);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf-8");
}

// ── Screenshots ───────────────────────────────────────────────────────────────

export function writeScreenshot(label: string, name: string, data: Buffer): string {
  const fileName = name.endsWith(".png") ? name : `${name}.png`;
  const p = path.join(captureDir(label), "screenshots", fileName);
  fs.writeFileSync(p, data);
  return fileName;
}
