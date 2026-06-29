/**
 * Capture catalog — formatting helpers over the rendered capture store.
 * Produces text for the MCP tools in md-mcp-server.ts.
 * No HTTP server dependency — reads directly from ~/.pm-orchestrator/captures/.
 */

import {
  type CaptureManifest,
  type PageArchetype,
  hasCapture,
  listCaptureLabels,
  readArchetypeTemplate,
  readManifest,
  readPageByRoute,
  readPageTemplate,
  readPageTemplateMeta,
  readTemplateAnalysis,
  readTemplateIndex,
  listPages,
} from "./crawler/capture-store";

export function resolveCaptureLabel(branch?: string): string | null {
  if (branch && hasCapture(branch)) return branch;
  const labels = listCaptureLabels();
  return labels[0] ?? null;
}

export function formatCapturedPages(label: string): string {
  const manifest = readManifest(label);
  const pages = manifest?.pages ?? listPages(label).map((p) => ({
    route: p.route,
    slug: p.slug,
    title: p.title,
    screenshot: p.screenshot,
    componentCount: p.detectedComponents.length,
    modalCount: p.modals.length,
  }));

  if (!pages.length) {
    return `No captured pages for "${label}". Run \`npm run crawl\` to build a capture set.`;
  }

  const header = [
    `CAPTURED RENDERED PAGES (label: ${label}${manifest?.appCommit ? `, app: ${manifest.appCommit.slice(0, 7)}` : ""})`,
    manifest?.updatedAt ? `Captured: ${manifest.updatedAt}` : "",
    `${pages.length} page(s). Use get-page-template(route) for stripped DOM template.`,
    "",
  ].filter(Boolean);

  const lines = pages.map(
    (p) => `  ${p.route} — ${p.title || "(untitled)"} · ${p.componentCount} components, ${p.modalCount} modals`
  );
  return [...header, ...lines].join("\n");
}

function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

export function formatPageTemplates(label: string): string {
  const index = readTemplateIndex(label);
  if (!index?.templates.length) {
    return `No page templates for "${label}". Run \`npm run crawl\` then \`npm run analyze-captures\`.`;
  }

  const analysis = readTemplateAnalysis(label);
  const archetypeCounts = analysis
    ? Object.entries(analysis.archetypes)
        .filter(([, info]) => info.routes.length > 0)
        .map(([name, info]) => `${name}=${info.routes.length}`)
        .join(", ")
    : "";

  const header = [
    `PAGE TEMPLATES (label: ${label}, ${index.templates.length} routes)`,
    index.generatedAt ? `Generated: ${index.generatedAt}` : "",
    archetypeCounts ? `Archetypes: ${archetypeCounts}` : "",
    "Pick the best route, then call get-page-template(route) for the stripped DOM base.",
    "",
  ].filter(Boolean);

  const lines = index.templates.map(
    (t) => `  ${t.route} — ${t.archetype} · ${t.detectedComponents.join(", ") || "(no components)"}`
  );
  return [...header, ...lines].join("\n");
}

export function getPageTemplateText(
  label: string,
  route?: string,
  archetype?: PageArchetype
): string {
  const index = readTemplateIndex(label);

  if (route) {
    const normalized = normalizeRoute(route);
    const entry = index?.templates.find((t) => normalizeRoute(t.route) === normalized);

    if (entry) {
      const html = readPageTemplate(label, entry.slug);
      if (html) {
        const meta = readPageTemplateMeta(label, entry.slug);
        const cssBundleId = entry.cssBundleId ?? meta?.cssBundleId;
        return [
          `PAGE TEMPLATE: ${entry.route}`,
          `slug: ${entry.slug}`,
          `archetype: ${entry.archetype}`,
          meta?.detectedComponents.length ? `components: ${meta.detectedComponents.join(", ")}` : "",
          cssBundleId ? `CSS bundle id: ${cssBundleId} (server auto-injects inline — do not add <link> yourself)` : "",
          "",
          "=== STRIPPED TEMPLATE HTML (edit in place — preserve layout/classes, replace visible text with ticket data) ===",
          html,
        ].filter(Boolean).join("\n");
      }
    }
    return `No page template for route "${route}" (label: ${label}). Call list-captured-pages to browse routes.`;
  }

  if (archetype) {
    const html = readArchetypeTemplate(label, archetype);
    if (html) {
      const routes = analysisRoutesForArchetype(label, archetype);
      return [
        `ARCHETYPE TEMPLATE: ${archetype}`,
        routes.length ? `example routes: ${routes.slice(0, 8).join(", ")}` : "",
        "",
        "=== STRIPPED ARCHETYPE TEMPLATE HTML ===",
        html,
      ].filter(Boolean).join("\n");
    }
    return `No archetype template "${archetype}" for label "${label}".`;
  }

  return "Provide route or archetype. Call survey-page-templates first.";
}

function analysisRoutesForArchetype(label: string, archetype: PageArchetype): string[] {
  const analysis = readTemplateAnalysis(label);
  return analysis?.archetypes[archetype]?.routes ?? [];
}

const MAX_BATCH_ROUTES = 6;

export function getPageTemplatesBatchText(label: string, routes: string[]): string {
  const unique = [...new Set(routes.map(normalizeRoute))].slice(0, MAX_BATCH_ROUTES);
  if (!unique.length) return "Provide at least one route.";
  return unique.map((route) => `---\n${getPageTemplateText(label, route)}`).join("\n\n");
}

export function surveyPageTemplates(label: string): string {
  const index = readTemplateIndex(label);
  if (!index?.templates.length) {
    return `No page templates for "${label}". Run npm run crawl + npm run analyze-captures first.`;
  }

  const analysis = readTemplateAnalysis(label);
  const lines: string[] = [
    `PAGE TEMPLATE SURVEY (label: ${label}, ${index.templates.length} routes)`,
    index.generatedAt ? `Generated: ${index.generatedAt}` : "",
    "",
    "Pick route(s) then ONE call: get-page-template(routes=[...]) — do NOT call survey-page-templates again.",
    "",
  ].filter(Boolean);

  if (analysis) {
    lines.push("=== ARCHETYPE GROUPS ===");
    for (const name of ["listing-table", "dashboard-tabs", "form", "other"] as PageArchetype[]) {
      const info = analysis.archetypes[name];
      if (!info?.routes.length) continue;
      lines.push(
        `${name} (${info.routes.length} routes)`,
        info.canonicalRoute ? `  canonical: ${info.canonicalRoute}` : "",
        `  routes: ${info.routes.join(", ")}`
      );
      const patterns = info.commonPatterns;
      if (patterns.tableClasses) lines.push(`  table pattern: ${patterns.tableClasses.slice(0, 120)}…`);
      if (patterns.filterBarSnippet) lines.push(`  filter bar: ${patterns.filterBarSnippet.slice(0, 80)}…`);
      lines.push("");
    }
  }

  lines.push("=== ALL ROUTES (route · archetype · components) ===");
  for (const entry of index.templates) {
    const meta = readPageTemplateMeta(label, entry.slug);
    const comps = (meta?.detectedComponents ?? entry.detectedComponents).join(", ") || "—";
    lines.push(`  ${entry.route} · ${entry.archetype} · [${comps}]`);
  }

  return lines.join("\n");
}
