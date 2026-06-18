/**
 * Server-side mockup grounding from captured page templates.
 *
 * Picks the closest per-route template by scoring ticket text against all
 * captured routes, loads the full HTML file (with sample data + layout), and
 * inlines Quasar CSS for iframe preview.
 *
 * Loads from pm-mcp HTTP when running, with filesystem fallback to
 * pm-mcp/.cache/captures/ and pm-ui/public/captures/index.json.
 */

import fs from "node:fs";
import path from "node:path";

import { getMcpHealthUrl, getMcpServerUrl } from "./mcp-client";
import { MOCKUP_ICON_STYLES, rewriteMockupAssetUrls } from "./mockup-assets";
import { WORKSPACE_ROOT } from "./paths";

const STYLE_MARKER = "data-md-capture-css";
const MAX_DIALOG_PROMPT_CHARS = 6_000;
const MAX_ANALYSIS_SUMMARY_CHARS = 2_500;

export const BASE_TEMPLATE_START = "BASE_TEMPLATE_START";
export const BASE_TEMPLATE_END = "BASE_TEMPLATE_END";

type PageArchetype = "listing-table" | "dashboard-tabs" | "form" | "other";
type TemplateSource = "per-route" | "archetype" | "none";

interface CaptureManifest {
  label: string;
  cssBundleIds: string[];
  pages: Array<{ route: string; slug: string }>;
  componentIds: string[];
}

interface TemplateIndexEntry {
  route: string;
  slug: string;
  archetype: PageArchetype;
  detectedComponents: string[];
  strippedByteSize: number;
  cssBundleId?: string;
}

interface TemplateIndex {
  label: string;
  templates: TemplateIndexEntry[];
}

interface TemplateAnalysisJson {
  archetypes: Record<
    PageArchetype,
    { routes: string[]; canonicalRoute?: string; canonicalSlug?: string }
  >;
}

interface CapturedComponentJson {
  id: string;
  componentKey: string;
  route: string;
  renderedHtml: string;
  kind: "component" | "modal";
}

export interface MockupGrounding {
  available: boolean;
  label: string;
  route: string;
  cssText: string;
  cssBundleId: string;
  templateHtml: string;
  templateSource: TemplateSource;
  templateSlug: string;
  archetype: PageArchetype;
  matchScore: number;
  analysisSummary: string;
  dialogHtml: string;
  dialogComponentId: string;
  promptBlock: string;
}

const ROUTE_HINTS: Array<{ re: RegExp; route: string }> = [
  { re: /outbound|order.?line|pick(ing)?|ship|container|handling.?unit|capacity/i, route: "/outbound/ordersV2" },
  { re: /inbound|receive|transfer.?order/i, route: "/inbound/listing" },
  { re: /inventory|sku|product|storage|recall|tag.?change|stale/i, route: "/inventory/products" },
  { re: /audit|cycle.?count|ira|gtp/i, route: "/audit/audit" },
  { re: /exception|breach/i, route: "/exception/listing" },
  { re: /shift|planning|tool/i, route: "/overview/v2" },
  { re: /station|zone|rack|hardware|system/i, route: "/system/station-management" },
  { re: /user|role|access|billing/i, route: "/users/v2Listing" },
  { re: /report|operations.?log/i, route: "/reports/operations-log" },
  { re: /notification/i, route: "/notification/listing" },
  { re: /transport/i, route: "/transport/listing" },
  { re: /overview|analytics|dashboard/i, route: "/overview/v2" },
  { re: /download/i, route: "/downloads" },
];

function captureCacheDir(label: string): string {
  return path.join(WORKSPACE_ROOT, "pm-mcp", ".cache", "captures", label);
}

function captureStaticBase(): string {
  return getMcpServerUrl().replace(/\/mcp\/?$/, "/captures");
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchText(url: string): Promise<string> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function readLocalText(filePath: string): string {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

function readLocalJson<T>(filePath: string): T | null {
  const raw = readLocalText(filePath);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function resolveCaptureLabel(): Promise<string> {
  try {
    const res = await fetch(getMcpHealthUrl(), { signal: AbortSignal.timeout(4_000) });
    if (!res.ok) return "develop";
    const body = (await res.json()) as { branch?: string };
    return body.branch ?? "develop";
  } catch {
    return "develop";
  }
}

function routeToSlug(route: string): string {
  const trimmed = route.replace(/[?#].*$/, "").replace(/^\/+|\/+$/g, "");
  if (!trimmed) return "root";
  return trimmed.replace(/\//g, "__").replace(/[^a-zA-Z0-9._-]/g, "-");
}

function pickArchetype(ticketText: string): PageArchetype {
  if (/form|create|edit|wizard|access.?control/i.test(ticketText)) return "form";
  if (/overview|dashboard|analytics|tab.?panel|transport/i.test(ticketText)) return "dashboard-tabs";
  if (/table|listing|list|order|inventory|audit|exception|notification|report/i.test(ticketText)) {
    return "listing-table";
  }
  return "listing-table";
}

function tokenizeForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

/** Score how well a captured route template matches ticket text. */
export function scoreTemplateMatch(
  ticketText: string,
  entry: TemplateIndexEntry
): number {
  const lower = ticketText.toLowerCase();
  const words = tokenizeForMatch(ticketText);
  let score = 0;

  for (const hint of ROUTE_HINTS) {
    if (hint.route === entry.route && hint.re.test(ticketText)) score += 30;
  }

  const routeLower = entry.route.toLowerCase();
  if (lower.includes(routeLower.replace(/\//g, " "))) score += 15;

  const segments = entry.route.split("/").filter(Boolean);
  for (const seg of segments) {
    const parts = seg.split(/[-_]/).filter((p) => p.length > 2);
    for (const part of parts) {
      if (words.includes(part.toLowerCase())) score += 4;
      if (lower.includes(part.toLowerCase())) score += 2;
    }
  }

  const ticketArchetype = pickArchetype(ticketText);
  if (entry.archetype === ticketArchetype) score += 8;

  if (/table|listing|grid/i.test(ticketText) && entry.detectedComponents.includes("q-table")) {
    score += 6;
  }
  if (/tab|dashboard|overview/i.test(ticketText) && entry.detectedComponents.includes("q-tabs")) {
    score += 5;
  }
  if (/modal|dialog|form/i.test(ticketText) && entry.detectedComponents.includes("q-form")) {
    score += 5;
  }

  return score;
}

export function pickClosestTemplate(
  ticketText: string,
  index: TemplateIndex
): { entry: TemplateIndexEntry; score: number } | null {
  if (!index.templates.length) return null;

  let best: TemplateIndexEntry | null = null;
  let bestScore = -1;

  for (const entry of index.templates) {
    const score = scoreTemplateMatch(ticketText, entry);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  if (!best || bestScore <= 0) {
    const archetype = pickArchetype(ticketText);
    const fallback = index.templates.find((t) => t.archetype === archetype) ?? index.templates[0];
    return fallback ? { entry: fallback, score: bestScore > 0 ? bestScore : 1 } : null;
  }

  return { entry: best, score: bestScore };
}

async function loadTemplateIndex(label: string): Promise<TemplateIndex | null> {
  const remote = await fetchJson<TemplateIndex>(
    `${captureStaticBase()}/${label}/templates/index.json`
  );
  if (remote?.templates?.length) return remote;

  const cacheIndex = readLocalJson<TemplateIndex>(
    path.join(captureCacheDir(label), "templates", "index.json")
  );
  if (cacheIndex?.templates?.length) return cacheIndex;

  return readLocalJson<TemplateIndex>(
    path.join(WORKSPACE_ROOT, "pm-ui", "public", "captures", label, "index.json")
  );
}

async function loadTemplateHtml(label: string, slug: string, archetype: PageArchetype): Promise<{
  html: string;
  source: TemplateSource;
}> {
  const perRouteRemote = await fetchText(`${captureStaticBase()}/${label}/templates/per-route/${slug}.html`);
  if (perRouteRemote.trim()) return { html: perRouteRemote, source: "per-route" };

  const perRouteLocal = readLocalText(
    path.join(captureCacheDir(label), "templates", "per-route", `${slug}.html`)
  );
  if (perRouteLocal.trim()) return { html: perRouteLocal, source: "per-route" };

  const archetypeRemote = await fetchText(
    `${captureStaticBase()}/${label}/templates/archetypes/${archetype}.html`
  );
  if (archetypeRemote.trim()) return { html: archetypeRemote, source: "archetype" };

  const archetypeLocal = readLocalText(
    path.join(captureCacheDir(label), "templates", "archetypes", `${archetype}.html`)
  );
  if (archetypeLocal.trim()) return { html: archetypeLocal, source: "archetype" };

  return { html: "", source: "none" };
}

async function loadCssBundle(label: string, bundleId: string, fallbackId?: string): Promise<string> {
  const id = bundleId || fallbackId || "";
  if (!id) return "";

  const remote = await fetchText(`${captureStaticBase()}/${label}/styles/${id}.css`);
  if (remote.trim()) return remote;

  return readLocalText(path.join(captureCacheDir(label), "styles", `${id}.css`));
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n<!-- [truncated] -->`;
}

function scoreComponent(c: CapturedComponentJson, route: string, wantsModal: boolean): number {
  let score = 0;
  if (c.componentKey === "q-dialog" || c.kind === "modal") score += 10;
  if (c.route === route) score += 5;
  if (wantsModal && c.kind === "modal") score += 3;
  return score;
}

async function loadComponents(label: string, ids: string[]): Promise<CapturedComponentJson[]> {
  const base = `${captureStaticBase()}/${label}/components`;
  const results: CapturedComponentJson[] = [];
  for (const id of ids) {
    const c = await fetchJson<CapturedComponentJson>(`${base}/${id}.json`);
    if (c?.renderedHtml) results.push(c);
  }
  return results;
}

function buildAnalysisSummary(
  analysis: TemplateAnalysisJson | null,
  archetype: PageArchetype,
  route: string
): string {
  if (!analysis) return "";
  const info = analysis.archetypes[archetype];
  if (!info?.routes.length) return "";
  const lines = [
    "CROSS-PAGE CAPTURE PATTERNS:",
    `- Selected template route: ${route}`,
    `- Archetype: ${archetype} (${info.routes.length} captured route(s))`,
    "- The base template is a FULL captured page with real layout, nav placement, filter bar, and sample table rows.",
    "- Preserve ALL DOM structure and class names — only change visible text/data for the Jira ticket.",
  ].filter(Boolean);
  return truncateText(lines.join("\n"), MAX_ANALYSIS_SUMMARY_CHARS);
}

function buildPromptBlock(opts: {
  route: string;
  templateSource: TemplateSource;
  templateSlug: string;
  archetype: PageArchetype;
  matchScore: number;
  analysisSummary: string;
  dialogHtml: string;
  dialogId: string;
}): string {
  const lines = [
    "=== CAPTURED PAGE TEMPLATE GROUNDING ===",
    "The USER message contains the COMPLETE captured page HTML (BASE_TEMPLATE_START/END).",
    "This is the exact layout from the live Manager Dashboard — same nav placement, sub-tabs, filter bar, table structure, and sample data rows.",
    "You are EDITING that file in place. DO NOT rebuild the page shell from scratch.",
    "Captured Quasar CSS is AUTO-INJECTED server-side into your HTML output.",
    "",
    `Closest matched route: ${opts.route}`,
    `Template: ${opts.templateSlug} (${opts.templateSource}, score=${opts.matchScore})`,
    `Archetype: ${opts.archetype}`,
    "",
    "RULES:",
    "- Start from the base template — preserve every element's placement, classes, and nesting.",
    "- Only change visible TEXT: cell values, column headers, labels, status chips, stat counts, button labels.",
    "- Keep sample row structure; update cell content to match the ticket scenario.",
    "- Add modals only if required — use the q-dialog reference below when needed.",
    "- DO NOT hand-write table CSS or replace q-table with plain <table>.",
    "- Action column icons: get-brand-icon data-uri <img>, not hand-drawn SVGs.",
    "",
  ];

  if (opts.analysisSummary) lines.push(opts.analysisSummary, "");
  if (opts.dialogHtml) {
    lines.push("REFERENCE q-dialog (for modals):", opts.dialogHtml, "");
  }
  lines.push("=== END CAPTURED PAGE TEMPLATE GROUNDING ===");
  return lines.join("\n");
}

export async function buildMockupGrounding(ticketText: string): Promise<MockupGrounding> {
  const empty: MockupGrounding = {
    available: false,
    label: "develop",
    route: "",
    cssText: "",
    cssBundleId: "",
    templateHtml: "",
    templateSource: "none",
    templateSlug: "",
    archetype: "other",
    matchScore: 0,
    analysisSummary: "",
    dialogHtml: "",
    dialogComponentId: "",
    promptBlock: "",
  };

  const label = await resolveCaptureLabel();
  const manifest =
    (await fetchJson<CaptureManifest>(`${captureStaticBase()}/${label}/manifest.json`)) ??
    readLocalJson<CaptureManifest>(path.join(captureCacheDir(label), "manifest.json"));

  if (!manifest?.cssBundleIds?.length) return empty;

  const templateIndex = await loadTemplateIndex(label);
  const analysis = await fetchJson<TemplateAnalysisJson>(
    `${captureStaticBase()}/${label}/templates/analysis.json`
  ) ?? readLocalJson<TemplateAnalysisJson>(
    path.join(captureCacheDir(label), "templates", "analysis.json")
  );

  const match = templateIndex ? pickClosestTemplate(ticketText, templateIndex) : null;
  const route = match?.entry.route ?? manifest.pages[0]?.route ?? "/outbound/ordersV2";
  const slug = match?.entry.slug ?? routeToSlug(route);
  const archetype = match?.entry.archetype ?? pickArchetype(ticketText);
  const cssBundleId = match?.entry.cssBundleId ?? manifest.cssBundleIds[0];

  const { html: templateHtml, source } = await loadTemplateHtml(label, slug, archetype);

  const cssText = await loadCssBundle(label, cssBundleId, manifest.cssBundleIds[0]);
  if (!cssText.trim() && !templateHtml.trim()) return empty;

  const wantsModal = /modal|dialog|popup|drawer/i.test(ticketText);
  const components = await loadComponents(label, manifest.componentIds ?? []);
  const dialogs = components
    .filter((c) => c.componentKey === "q-dialog" || c.kind === "modal")
    .sort((a, b) => scoreComponent(b, route, wantsModal) - scoreComponent(a, route, wantsModal));
  const bestDialog = wantsModal ? dialogs[0] : undefined;

  const hasTemplate = Boolean(templateHtml.trim());

  return {
    available: hasTemplate || Boolean(cssText.trim()),
    label,
    route,
    cssText,
    cssBundleId,
    templateHtml,
    templateSource: source,
    templateSlug: slug,
    archetype,
    matchScore: match?.score ?? 0,
    analysisSummary: buildAnalysisSummary(analysis, archetype, route),
    dialogHtml: bestDialog ? truncateText(bestDialog.renderedHtml, MAX_DIALOG_PROMPT_CHARS) : "",
    dialogComponentId: bestDialog?.id ?? "",
    promptBlock: hasTemplate
      ? buildPromptBlock({
          route,
          templateSource: source,
          templateSlug: slug,
          archetype,
          matchScore: match?.score ?? 0,
          analysisSummary: buildAnalysisSummary(analysis, archetype, route),
          dialogHtml: bestDialog ? truncateText(bestDialog.renderedHtml, MAX_DIALOG_PROMPT_CHARS) : "",
          dialogId: bestDialog?.id ?? "",
        })
      : "",
  };
}

/** Wrap the full captured template for the model user message (template first). */
export function wrapBaseTemplate(grounding: MockupGrounding): string {
  return [
    "=== BASE CAPTURED PAGE TEMPLATE (complete file — edit in place) ===",
    `Route: ${grounding.route} · Slug: ${grounding.templateSlug} · Match score: ${grounding.matchScore}`,
    "",
    BASE_TEMPLATE_START,
    grounding.templateHtml,
    BASE_TEMPLATE_END,
    "",
    "=== END BASE TEMPLATE ===",
    "",
    "Apply Jira ticket changes to the template above. Return the COMPLETE updated HTML document.",
    "Preserve all layout, nav placement, sub-tabs, filter bar, and table structure.",
  ].join("\n");
}

/** Styled HTML for immediate iframe preview before the model finishes. */
export function prepareInitialMockupHtml(grounding: MockupGrounding): string {
  if (!grounding.templateHtml?.trim()) return "";
  return injectGroundingIntoHtml(grounding.templateHtml, grounding.cssText);
}

const FONT_LINKS = MOCKUP_ICON_STYLES;

/** Inline captured Quasar CSS into mockup HTML (required for iframe srcDoc). */
export function injectGroundingIntoHtml(html: string, cssText: string): string {
  if (!html?.trim()) return html;

  let doc = rewriteMockupAssetUrls(html)
    .replace(/<style[^>]*data-md-capture-css[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link[^>]*data-md-capture-css-link[^>]*>\s*/gi, "");

  const headExtras = cssText.trim()
    ? `${FONT_LINKS}\n<style ${STYLE_MARKER}="true">\n${cssText}\n</style>`
    : FONT_LINKS;

  if (/<\/head>/i.test(doc)) {
    const hasIconFonts = /Material\+Icons|material-symbols-outlined|font-awesome/i.test(doc);
    if (!hasIconFonts) {
      doc = doc.replace(/<\/head>/i, `${headExtras}\n</head>`);
    } else if (cssText.trim()) {
      doc = doc.replace(/<\/head>/i, `<style ${STYLE_MARKER}="true">\n${cssText}\n</style>\n</head>`);
    }
    return doc;
  }

  if (/<html/i.test(doc)) {
    return doc.replace(/<html[^>]*>/i, (m) => `${m}\n<head>${headExtras}</head>`);
  }

  return `<!DOCTYPE html><html><head>${headExtras}</head><body>${doc}</body></html>`;
}
