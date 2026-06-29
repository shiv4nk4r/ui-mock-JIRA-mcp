/**
 * Capture store — shared types + filesystem read/write helpers for the rendered
 * capture maps produced by the crawler and served by the MCP tools.
 *
 * Layout under ~/.pm-orchestrator/captures/<label>/:
 *   manifest.json          index of pages, component ids, css bundle ids
 *   pages/<slug>.json      one CapturedPage per route
 *   components/<id>.json   one CapturedComponent per rendered component/modal
 *   styles/<hash>.css      compiled global CSS bundles, deduped by content hash
 *   screenshots/*.png      page + component screenshots
 *   templates/
 *     per-route/<slug>.html       stripped DOM template per route
 *     per-route/<slug>.meta.json  region metadata
 *     archetypes/<archetype>.html canonical archetype base
 *     analysis.json               cross-page pattern summary
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

export const CAPTURES_ROOT = path.join(homedir(), ".pm-orchestrator", "captures");
export const CAPTURE_VERSION = "1";

export function safeLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9._/-]/g, "_");
}

export function captureDir(label: string): string {
  return path.join(CAPTURES_ROOT, safeLabel(label));
}

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
  html: string;
  screenshot?: string;
  cssBundleIds: string[];
  detectedComponents: string[];
  modals: CapturedModalRef[];
  capturedAt: string;
  sanitized: boolean;
}

export interface CapturedComponent {
  id: string;
  componentKey: string;
  sourceMatch?: string;
  route: string;
  renderedHtml: string;
  screenshot?: string;
  kind: "component" | "modal";
  trigger?: string;
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

export type PageArchetype = "listing-table" | "dashboard-tabs" | "form" | "other";

export interface PageTemplateMeta {
  route: string;
  slug: string;
  archetype: PageArchetype;
  detectedComponents: string[];
  strippedByteSize: number;
  shellByteSize: number;
  subNavByteSize: number;
  mainContentByteSize: number;
  cssBundleId?: string;
}

export interface TemplateAnalysis {
  generatedAt: string;
  label: string;
  pageCount: number;
  archetypes: Record<
    PageArchetype,
    {
      routes: string[];
      canonicalRoute?: string;
      canonicalSlug?: string;
      commonPatterns: {
        tableClasses?: string;
        filterBarSnippet?: string;
        sectionBannerSnippet?: string;
      };
    }
  >;
  shellVariants: Array<{ hash: string; routeCount: number; sampleRoute: string }>;
}

export interface TemplateIndexEntry {
  route: string;
  slug: string;
  archetype: PageArchetype;
  detectedComponents: string[];
  strippedByteSize: number;
  cssBundleId?: string;
}

export interface TemplateIndex {
  label: string;
  generatedAt: string;
  templates: TemplateIndexEntry[];
}

export interface CaptureManifest {
  version: string;
  label: string;
  baseUrl: string;
  createdAt: string;
  updatedAt: string;
  appCommit?: string;
  pages: PageSummary[];
  componentIds: string[];
  cssBundleIds: string[];
  templatesGeneratedAt?: string;
  archetypes?: PageArchetype[];
}

// ── Directory helpers ─────────────────────────────────────────────────────────

export function ensureCaptureDirs(label: string): string {
  const dir = captureDir(label);
  for (const sub of ["pages", "components", "styles", "screenshots", "templates/per-route", "templates/archetypes"]) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  return dir;
}

export function templatesDir(label: string): string {
  return path.join(captureDir(label), "templates");
}

export function perRouteTemplatePath(label: string, slug: string): string {
  return path.join(templatesDir(label), "per-route", `${slug}.html`);
}

export function perRouteMetaPath(label: string, slug: string): string {
  return path.join(templatesDir(label), "per-route", `${slug}.meta.json`);
}

export function archetypeTemplatePath(label: string, archetype: PageArchetype): string {
  return path.join(templatesDir(label), "archetypes", `${archetype}.html`);
}

export function templateAnalysisPath(label: string): string {
  return path.join(templatesDir(label), "analysis.json");
}

export function templateIndexPath(label: string): string {
  return path.join(templatesDir(label), "index.json");
}

export function manifestPath(label: string): string {
  return path.join(captureDir(label), "manifest.json");
}

export function hasCapture(label: string): boolean {
  return fs.existsSync(manifestPath(label));
}

export function listCaptureLabels(): string[] {
  if (!fs.existsSync(CAPTURES_ROOT)) return [];
  const labels: Array<{ label: string; mtime: number }> = [];
  const walk = (dir: string, prefix: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const abs = path.join(dir, entry.name);
      const label = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (fs.existsSync(path.join(abs, "manifest.json"))) {
        labels.push({ label, mtime: fs.statSync(path.join(abs, "manifest.json")).mtimeMs });
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
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as CaptureManifest; } catch { return null; }
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
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as CapturedPage; } catch { return null; }
}

export function readPageByRoute(label: string, route: string): CapturedPage | null {
  return readPageBySlug(label, slugifyRoute(route));
}

export function listPages(label: string): CapturedPage[] {
  const dir = path.join(captureDir(label), "pages");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as CapturedPage; } catch { return null; } })
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
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as CapturedComponent; } catch { return null; }
}

export function listComponents(label: string): CapturedComponent[] {
  const dir = path.join(captureDir(label), "components");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as CapturedComponent; } catch { return null; } })
    .filter((c): c is CapturedComponent => c !== null);
}

// ── CSS bundles ───────────────────────────────────────────────────────────────

export function hashContent(content: string): string {
  return crypto.createHash("sha1").update(content).digest("hex").slice(0, 12);
}

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

// ── Templates ─────────────────────────────────────────────────────────────────

export function writePageTemplate(label: string, slug: string, html: string, meta: PageTemplateMeta): void {
  ensureCaptureDirs(label);
  fs.writeFileSync(perRouteTemplatePath(label, slug), html, "utf-8");
  fs.writeFileSync(perRouteMetaPath(label, slug), JSON.stringify(meta, null, 2), "utf-8");
}

export function readPageTemplate(label: string, slug: string): string | null {
  const p = perRouteTemplatePath(label, slug);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf-8");
}

export function readPageTemplateMeta(label: string, slug: string): PageTemplateMeta | null {
  const p = perRouteMetaPath(label, slug);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as PageTemplateMeta; } catch { return null; }
}

export function writeArchetypeTemplate(label: string, archetype: PageArchetype, html: string): void {
  ensureCaptureDirs(label);
  fs.writeFileSync(archetypeTemplatePath(label, archetype), html, "utf-8");
}

export function readArchetypeTemplate(label: string, archetype: PageArchetype): string | null {
  const p = archetypeTemplatePath(label, archetype);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf-8");
}

export function writeTemplateAnalysis(label: string, analysis: TemplateAnalysis): void {
  ensureCaptureDirs(label);
  fs.writeFileSync(templateAnalysisPath(label), JSON.stringify(analysis, null, 2), "utf-8");
}

export function readTemplateAnalysis(label: string): TemplateAnalysis | null {
  const p = templateAnalysisPath(label);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as TemplateAnalysis; } catch { return null; }
}

export function writeTemplateIndex(label: string, index: TemplateIndex): void {
  ensureCaptureDirs(label);
  fs.writeFileSync(templateIndexPath(label), JSON.stringify(index, null, 2), "utf-8");
}

export function readTemplateIndex(label: string): TemplateIndex | null {
  const p = templateIndexPath(label);
  if (!fs.existsSync(p)) return null;
  try { return JSON.parse(fs.readFileSync(p, "utf-8")) as TemplateIndex; } catch { return null; }
}
