/**
 * Post-crawl analyzer — strips captured page HTML into reusable templates.
 *
 * Run: npm run analyze-captures
 *      npx tsx src/crawler/analyze-captures.ts --label develop
 *
 * Also invoked automatically at the end of crawl.ts when CRAWL_ANALYZE_TEMPLATES=true.
 */

import { parse } from "node-html-parser";
import fs from "node:fs";

import { sanitizeHtml } from "./sanitize";
import { injectTemplatePreviewHead } from "./template-styles";
import {
  type CapturedPage,
  type PageArchetype,
  type PageTemplateMeta,
  type TemplateAnalysis,
  type TemplateIndex,
  ensureCaptureDirs,
  hashContent,
  listCaptureLabels,
  listPages,
  readManifest,
  safeLabel,
  slugifyRoute,
  writeArchetypeTemplate,
  writeManifest,
  writePageTemplate,
  writeTemplateAnalysis,
  writeTemplateIndex,
} from "./capture-store";

const MAX_TABLE_ROWS = 3;

export interface AnalyzeOptions {
  label: string;
  sanitize?: boolean;
  maxTableRows?: number;
}

interface ProcessedPage {
  page: CapturedPage;
  templateHtml: string;
  meta: PageTemplateMeta;
  shell: string;
}

function stripStyleAndScript(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
}

function truncateTableBodies(html: string, maxRows: number): string {
  return html.replace(/<tbody\b[^>]*>([\s\S]*?)<\/tbody>/gi, (_match, inner: string) => {
    const rows = inner.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? [];
    if (rows.length <= maxRows) return `<tbody>${inner}</tbody>`;
    const kept = rows.slice(0, maxRows).join("");
    return `<tbody>${kept}<!-- rows truncated: ${rows.length - maxRows} more --></tbody>`;
  });
}

export function detectArchetype(components: string[]): PageArchetype {
  if (components.includes("q-form")) return "form";
  if (components.includes("q-tab-panels")) return "dashboard-tabs";
  if (components.includes("q-table")) return "listing-table";
  return "other";
}

function extractShell(html: string): string {
  const end = html.search(/<\/header>/i);
  return end > 0 ? html.slice(0, end + 9) : html.slice(0, Math.min(html.length, 8_000));
}

function firstMatch(html: string, re: RegExp): string | undefined {
  const m = re.exec(html);
  return m?.[0];
}

function extractRegions(html: string): { subNav: string; mainContent: string } {
  const root = parse(html);
  const subNav = root.querySelector(".q-tabs, [role='tablist'], .sub-nav, .secondary-nav");
  const mainContent = root.querySelector("main, .q-page, #q-app .q-page-container, .page-content");
  return {
    subNav: subNav?.outerHTML ?? "",
    mainContent: mainContent?.outerHTML ?? "",
  };
}

function processPage(page: CapturedPage, opts: AnalyzeOptions): ProcessedPage {
  const maxTableRows = opts.maxTableRows ?? MAX_TABLE_ROWS;

  let html = page.html;
  if (opts.sanitize) html = sanitizeHtml(html);
  html = stripStyleAndScript(html);
  html = truncateTableBodies(html, maxTableRows);

  const archetype = detectArchetype(page.detectedComponents);
  const slug = slugifyRoute(page.route);
  const cssBundleId = page.cssBundleIds[0];

  const templateHtml = injectTemplatePreviewHead(html, cssBundleId);
  const shell = extractShell(html);
  const regions = extractRegions(html);

  const meta: PageTemplateMeta = {
    route: page.route,
    slug,
    archetype,
    detectedComponents: page.detectedComponents,
    strippedByteSize: Buffer.byteLength(html, "utf-8"),
    shellByteSize: Buffer.byteLength(shell, "utf-8"),
    subNavByteSize: Buffer.byteLength(regions.subNav, "utf-8"),
    mainContentByteSize: Buffer.byteLength(regions.mainContent, "utf-8"),
    cssBundleId,
  };

  return { page, templateHtml: html, meta, shell };
}

function pickCanonical(pages: ProcessedPage[], archetype: PageArchetype, preferredRoute?: string): ProcessedPage | undefined {
  const matches = pages.filter((p) => p.meta.archetype === archetype);
  if (!matches.length) return undefined;
  if (preferredRoute) {
    const exact = matches.find((p) => p.page.route === preferredRoute);
    if (exact) return exact;
  }
  const sorted = [...matches].sort((a, b) => a.meta.strippedByteSize - b.meta.strippedByteSize);
  return sorted[Math.floor(sorted.length / 2)];
}

function buildCommonPatterns(canonical: ProcessedPage): TemplateAnalysis["archetypes"][PageArchetype]["commonPatterns"] {
  const html = canonical.templateHtml;
  return {
    tableClasses: firstMatch(html, /<div[^>]*class="[^"]*q-table[^"]*"[^>]*>/i),
    filterBarSnippet: firstMatch(html, /<[^>]*(?:filter|q-btn)[^>]*>[\s\S]{0,200}?Filter[\s\S]{0,200}?<\/[^>]+>/i),
    sectionBannerSnippet: firstMatch(html, /<[^>]*(?:banner|section|stat)[^>]*>[\s\S]{0,400}?<\/div>/i),
  };
}

function buildAnalysisSummary(analysis: TemplateAnalysis): string {
  const lines = ["CROSS-PAGE CAPTURE PATTERNS:", `Pages analyzed: ${analysis.pageCount}`];
  for (const [archetype, info] of Object.entries(analysis.archetypes) as Array<[PageArchetype, TemplateAnalysis["archetypes"][PageArchetype]]>) {
    if (!info.routes.length) continue;
    lines.push(`- ${archetype}: ${info.routes.length} route(s), canonical=${info.canonicalRoute ?? "n/a"}`);
    if (info.commonPatterns.tableClasses) lines.push(`  table: ${info.commonPatterns.tableClasses.slice(0, 200)}`);
    if (info.commonPatterns.filterBarSnippet) lines.push(`  filter: ${info.commonPatterns.filterBarSnippet.slice(0, 160)}`);
  }
  return lines.join("\n");
}

export { buildAnalysisSummary };

export function analyzeCaptures(opts: AnalyzeOptions): TemplateAnalysis {
  const { label } = opts;
  ensureCaptureDirs(label);
  const pages = listPages(label);
  if (!pages.length) {
    throw new Error(`No captured pages for label "${label}". Run npm run crawl first.`);
  }

  const processed = pages.map((p) => processPage(p, opts));
  for (const { templateHtml, meta } of processed) writePageTemplate(label, meta.slug, templateHtml, meta);

  const archetypeRoutes: Record<PageArchetype, string[]> = {
    "listing-table": [], "dashboard-tabs": [], form: [], other: [],
  };
  for (const p of processed) archetypeRoutes[p.meta.archetype].push(p.page.route);

  const listingCanonical   = pickCanonical(processed, "listing-table", "/downloads");
  const dashboardCanonical = pickCanonical(processed, "dashboard-tabs", "/overview/v2");
  const formCanonical      = pickCanonical(processed, "form", "/users/access-control");

  if (listingCanonical)   writeArchetypeTemplate(label, "listing-table",  listingCanonical.templateHtml);
  if (dashboardCanonical) writeArchetypeTemplate(label, "dashboard-tabs", dashboardCanonical.templateHtml);
  if (formCanonical)      writeArchetypeTemplate(label, "form",           formCanonical.templateHtml);

  const shellMap = new Map<string, { routes: string[]; sampleRoute: string }>();
  for (const p of processed) {
    const h = hashContent(p.shell);
    const entry = shellMap.get(h) ?? { routes: [], sampleRoute: p.page.route };
    entry.routes.push(p.page.route);
    shellMap.set(h, entry);
  }

  const analysis: TemplateAnalysis = {
    generatedAt: new Date().toISOString(),
    label,
    pageCount: processed.length,
    archetypes: {
      "listing-table": {
        routes: archetypeRoutes["listing-table"],
        canonicalRoute: listingCanonical?.page.route,
        canonicalSlug: listingCanonical?.meta.slug,
        commonPatterns: listingCanonical ? buildCommonPatterns(listingCanonical) : {},
      },
      "dashboard-tabs": {
        routes: archetypeRoutes["dashboard-tabs"],
        canonicalRoute: dashboardCanonical?.page.route,
        canonicalSlug: dashboardCanonical?.meta.slug,
        commonPatterns: dashboardCanonical ? buildCommonPatterns(dashboardCanonical) : {},
      },
      form: {
        routes: archetypeRoutes.form,
        canonicalRoute: formCanonical?.page.route,
        canonicalSlug: formCanonical?.meta.slug,
        commonPatterns: formCanonical ? buildCommonPatterns(formCanonical) : {},
      },
      other: { routes: archetypeRoutes.other, commonPatterns: {} },
    },
    shellVariants: [...shellMap.entries()].map(([hash, { routes, sampleRoute }]) => ({
      hash, routeCount: routes.length, sampleRoute,
    })),
  };

  writeTemplateAnalysis(label, analysis);

  const templateIndex: TemplateIndex = {
    label,
    generatedAt: analysis.generatedAt,
    templates: processed.map(({ page, meta }) => ({
      route: page.route,
      slug: meta.slug,
      archetype: meta.archetype,
      detectedComponents: meta.detectedComponents,
      strippedByteSize: meta.strippedByteSize,
      cssBundleId: meta.cssBundleId,
    })),
  };
  writeTemplateIndex(label, templateIndex);

  const manifest = readManifest(label);
  if (manifest) {
    const archetypes = (Object.keys(archetypeRoutes) as PageArchetype[]).filter(
      (a) => archetypeRoutes[a].length > 0
    );
    writeManifest(label, { ...manifest, templatesGeneratedAt: analysis.generatedAt, archetypes, updatedAt: analysis.generatedAt });
  }

  console.log(`[analyze] ${processed.length} template(s) → ~/.pm-orchestrator/captures/${label}/templates/`);
  console.log(`[analyze] archetypes: ${Object.entries(archetypeRoutes).map(([k, v]) => `${k}=${v.length}`).join(", ")}`);

  return analysis;
}

function parseCliLabel(): string {
  const idx = process.argv.indexOf("--label");
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.CRAWL_LABEL ?? listCaptureLabels()[0] ?? "develop";
}

async function main() {
  const label = parseCliLabel();
  analyzeCaptures({ label, sanitize: process.env.CRAWL_SANITIZE === "true" });
}

const isMain = process.argv[1]?.includes("analyze-captures");
if (isMain) {
  main().catch((err) => {
    console.error(`[analyze] Fatal: ${(err as Error).message}`);
    process.exit(1);
  });
}
