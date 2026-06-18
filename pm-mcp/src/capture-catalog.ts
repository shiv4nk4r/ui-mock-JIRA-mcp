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
  hasCapture,
  listCaptureLabels,
  listComponents,
  readComponent,
  readManifest,
  readPageByRoute,
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
