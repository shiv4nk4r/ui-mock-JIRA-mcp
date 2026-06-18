/**
 * Capture catalog — MCP-side read/format helpers over the rendered capture
 * store. Produces text for the capture tools and absolute URLs to the static
 * CSS bundles + screenshots served by the Express server.
 *
 * No Playwright import here — this runs inside the live MCP server.
 */

import {
  type CapturedComponent,
  type CapturedPage,
  type CaptureManifest,
  type PageArchetype,
  hasCapture,
  listCaptureLabels,
  listComponents,
  readArchetypeTemplate,
  readComponent,
  readManifest,
  readPageByRoute,
  readPageTemplate,
  readPageTemplateMeta,
  readTemplateAnalysis,
  readTemplateIndex,
  listPages,
} from "./crawler/capture-store";

/** Path prefix the Express server mounts the capture store under. */
export const CAPTURES_URL_PREFIX = "/captures";

function serverBaseUrl(): string {
  const host = process.env.MCP_HOST ?? "127.0.0.1";
  const port = process.env.MCP_PORT ?? "3100";
  return `http://${host}:${port}`;
}

export function cssBundleUrl(label: string, id: string): string {
  return `${serverBaseUrl()}${CAPTURES_URL_PREFIX}/${label}/styles/${id}.css`;
}

export function screenshotUrl(label: string, file: string): string {
  return `${serverBaseUrl()}${CAPTURES_URL_PREFIX}/${label}/screenshots/${file}`;
}

/**
 * Resolve which capture set to serve for the active branch: prefer an exact
 * label match, otherwise fall back to the most recently updated capture set.
 */
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
    return `No captured pages for "${label}". Run \`npm run crawl -w pm-mcp\` to build the capture set.`;
  }

  const header = [
    `CAPTURED RENDERED PAGES (label: ${label}${manifest?.appCommit ? `, app: ${manifest.appCommit.slice(0, 7)}` : ""})`,
    manifest?.updatedAt ? `Captured: ${manifest.updatedAt}` : "",
    `${pages.length} page(s). Use get-captured-page(route) for rendered HTML + CSS bundle URL.`,
    "",
  ].filter(Boolean);

  const lines = pages.map(
    (p) =>
      `  ${p.route} — ${p.title || "(untitled)"} · ${p.componentCount} components, ${p.modalCount} modals`
  );
  return [...header, ...lines].join("\n");
}

export function getCapturedPageText(label: string, route: string): string {
  const page: CapturedPage | null = readPageByRoute(label, route);
  if (!page) {
    return `No captured page for route "${route}" (label: ${label}). Call list-captured-pages to see what exists.`;
  }

  const cssUrls = page.cssBundleIds.map((id) => cssBundleUrl(label, id));
  const parts: string[] = [
    `CAPTURED PAGE: ${page.route}`,
    `title: ${page.title}`,
    `source url: ${page.url}`,
    `captured: ${page.capturedAt}${page.sanitized ? " (sanitized)" : ""}`,
    page.screenshot ? `screenshot: ${screenshotUrl(label, page.screenshot)}` : "",
    cssUrls.length
      ? `CSS bundle (link this absolute URL in the mockup <head>):\n${cssUrls.map((u) => `  <link rel="stylesheet" href="${u}">`).join("\n")}`
      : "",
    page.detectedComponents.length
      ? `components on page: ${page.detectedComponents.join(", ")}`
      : "",
    page.modals.length
      ? `modals: ${page.modals.map((m) => `${m.id} (trigger: "${m.trigger}")`).join(", ")}`
      : "",
    "",
    "=== RENDERED HTML (real DOM — reuse this structure against the CSS bundle above) ===",
    page.html,
  ];
  return parts.filter(Boolean).join("\n");
}

function matchesQuery(c: CapturedComponent, q: string): boolean {
  if (!q) return true;
  const hay = `${c.componentKey} ${c.sourceMatch ?? ""} ${c.route} ${c.trigger ?? ""} ${c.kind}`.toLowerCase();
  return hay.includes(q);
}

export function formatRenderedComponents(label: string, query?: string): string {
  const q = query?.toLowerCase().trim() ?? "";
  const components = listComponents(label).filter((c) => matchesQuery(c, q));
  if (!components.length) {
    return query
      ? `No captured components match "${query}" (label: ${label}).`
      : `No captured components for "${label}". Run \`npm run crawl -w pm-mcp\` first.`;
  }

  // Group by component key for readability.
  const byKey = new Map<string, CapturedComponent[]>();
  for (const c of components) {
    if (!byKey.has(c.componentKey)) byKey.set(c.componentKey, []);
    byKey.get(c.componentKey)!.push(c);
  }

  const lines: string[] = [
    `CAPTURED RENDERED COMPONENTS (label: ${label}, ${components.length} shown).`,
    "Call get-rendered-component(id) for the real rendered HTML + CSS bundle URL.",
    "",
  ];
  for (const [key, items] of [...byKey.entries()].sort()) {
    lines.push(`## ${key} (${items.length})`);
    for (const c of items) {
      const src = c.sourceMatch ? ` · src: ${c.sourceMatch}` : "";
      const trig = c.trigger ? ` · modal trigger: "${c.trigger}"` : "";
      lines.push(`  ${c.id} — route: ${c.route}${src}${trig}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function getRenderedComponentText(label: string, idOrKey: string): string {
  let component = readComponent(label, idOrKey);

  // Fallback: treat the argument as a component key and return the first match.
  if (!component) {
    const matches = listComponents(label).filter(
      (c) => c.componentKey === idOrKey || c.id.startsWith(idOrKey)
    );
    component = matches[0] ?? null;
  }

  if (!component) {
    return `No captured component "${idOrKey}" (label: ${label}). Call list-rendered-components to browse ids.`;
  }

  const cssUrl = cssUrlForComponent(label);
  const parts: string[] = [
    `RENDERED COMPONENT: ${component.id}`,
    `key: ${component.componentKey} · kind: ${component.kind}`,
    `captured from route: ${component.route}`,
    component.sourceMatch ? `source SFC: ${component.sourceMatch}` : "source SFC: (unmapped — library/Quasar component)",
    component.trigger ? `opened via: "${component.trigger}"` : "",
    component.screenshot ? `screenshot: ${screenshotUrl(label, component.screenshot)}` : "",
    cssUrl ? `CSS bundle (link this in the mockup <head>): ${cssUrl}` : "",
    "",
    "=== RENDERED HTML (real DOM subtree — reuse verbatim against the CSS bundle) ===",
    component.renderedHtml,
  ];
  return parts.filter(Boolean).join("\n");
}

/** The primary CSS bundle for a capture set (components share the global bundle). */
function cssUrlForComponent(label: string): string | null {
  const manifest: CaptureManifest | null = readManifest(label);
  const id = manifest?.cssBundleIds[0];
  return id ? cssBundleUrl(label, id) : null;
}

function cssUrlForBundle(label: string, bundleId?: string): string | null {
  const id = bundleId ?? readManifest(label)?.cssBundleIds[0];
  return id ? cssBundleUrl(label, id) : null;
}

function normalizeRoute(route: string): string {
  const trimmed = route.trim();
  if (!trimmed || trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

export function formatPageTemplates(label: string): string {
  const index = readTemplateIndex(label);
  if (!index?.templates.length) {
    return `No page templates for "${label}". Run \`npm run crawl -w pm-mcp\` then \`npm run analyze-captures -w pm-mcp\`.`;
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
    "Pick the best route yourself, then call get-page-template(route) for the stripped DOM base.",
    "Archetype fallbacks: get-page-template(archetype=listing-table|dashboard-tabs|form|other).",
    "",
  ].filter(Boolean);

  const lines = index.templates.map(
    (t) =>
      `  ${t.route} — ${t.archetype} · ${t.detectedComponents.join(", ") || "(no components)"}`
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
        const cssUrl = cssUrlForBundle(label, entry.cssBundleId ?? meta?.cssBundleId);
        return [
          `PAGE TEMPLATE: ${entry.route}`,
          `slug: ${entry.slug}`,
          `archetype: ${entry.archetype}`,
          meta?.detectedComponents.length
            ? `components: ${meta.detectedComponents.join(", ")}`
            : "",
          cssUrl
            ? `CSS bundle (server injects this — reference only):\n  <link rel="stylesheet" href="${cssUrl}">`
            : "",
          "",
          "=== STRIPPED TEMPLATE HTML (edit in place — preserve layout/classes, change visible text) ===",
          html,
        ]
          .filter(Boolean)
          .join("\n");
      }
    }
    return `No page template for route "${route}" (label: ${label}). Call list-page-templates to browse routes.`;
  }

  if (archetype) {
    const html = readArchetypeTemplate(label, archetype);
    if (html) {
      const cssUrl = cssUrlForBundle(label);
      const routes = analysisRoutesForArchetype(label, archetype);
      return [
        `ARCHETYPE TEMPLATE: ${archetype}`,
        routes.length ? `example routes: ${routes.slice(0, 8).join(", ")}` : "",
        cssUrl ? `CSS bundle: ${cssUrl}` : "",
        "",
        "=== STRIPPED ARCHETYPE TEMPLATE HTML ===",
        html,
      ]
        .filter(Boolean)
        .join("\n");
    }
    return `No archetype template "${archetype}" for label "${label}".`;
  }

  return "Provide route or archetype. Call list-page-templates first.";
}

function analysisRoutesForArchetype(label: string, archetype: PageArchetype): string[] {
  const analysis = readTemplateAnalysis(label);
  return analysis?.archetypes[archetype]?.routes ?? [];
}

const MAX_BATCH_ROUTES = 6;

/** Full survey of every page template — metadata only, no HTML. Agent must call this first. */
export function surveyPageTemplates(label: string): string {
  const index = readTemplateIndex(label);
  if (!index?.templates.length) {
    return `No page templates for "${label}". Run crawl + analyze-captures first.`;
  }

  const analysis = readTemplateAnalysis(label);
  const lines: string[] = [
    `PAGE TEMPLATE SURVEY (label: ${label}, ${index.templates.length} routes)`,
    index.generatedAt ? `Generated: ${index.generatedAt}` : "",
    "",
    "REQUIRED: Read this entire survey before building a mockup.",
    "Then either (a) pick one primary route via get-page-template(route), or",
    "(b) mix regions/components from multiple routes — call get-page-template(routes=[...]) to load up to 6 candidates.",
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

    if (analysis.shellVariants.length) {
      lines.push("=== SHELL VARIANTS (shared header/nav layouts) ===");
      for (const v of analysis.shellVariants) {
        lines.push(`  hash ${v.hash.slice(0, 8)} — ${v.routeCount} routes, sample: ${v.sampleRoute}`);
      }
      lines.push("");
    }
  }

  lines.push("=== ALL ROUTES (route · archetype · components · region sizes) ===");
  for (const entry of index.templates) {
    const meta = readPageTemplateMeta(label, entry.slug);
    const comps = (meta?.detectedComponents ?? entry.detectedComponents).join(", ") || "—";
    const regions = meta
      ? `shell=${meta.shellByteSize}b subNav=${meta.subNavByteSize}b main=${meta.mainContentByteSize}b`
      : `~${entry.strippedByteSize}b`;
    lines.push(`  ${entry.route} · ${entry.archetype} · [${comps}] · ${regions}`);
  }

  return lines.join("\n");
}

export function getPageTemplatesBatchText(label: string, routes: string[]): string {
  const unique = [...new Set(routes.map(normalizeRoute))].slice(0, MAX_BATCH_ROUTES);
  if (!unique.length) return "Provide at least one route.";

  const parts = unique.map((route) => {
    const text = getPageTemplateText(label, route);
    return `---\n${text}`;
  });
  return parts.join("\n\n");
}
