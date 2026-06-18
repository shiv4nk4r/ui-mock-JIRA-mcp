/**
 * Preview stylesheet injection for analyzed page templates.
 *
 * Templates strip inline <style> blocks (CSS lives in styles/<hash>.css).
 * We add relative <link> tags so templates render correctly when served by
 * pm-mcp at /captures/<label>/templates/... — not when opened via file://.
 */

export const CAPTURE_CSS_LINK_ATTR = "data-md-capture-css-link";

/** Relative path from templates/per-route/ or templates/archetypes/ to a CSS bundle. */
export function captureCssHref(cssBundleId: string): string {
  return `../../styles/${cssBundleId}.css`;
}

const FONT_LINKS = [
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap">',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">',
];

/** Inject font + captured Quasar CSS links into template <head> for browser preview. */
export function injectTemplatePreviewHead(html: string, cssBundleId: string | undefined): string {
  if (!cssBundleId?.trim()) return html;

  const previewNote =
    "<!-- Styled preview: open via pm-mcp (npm run dev) at http://127.0.0.1:3100/captures/<label>/templates/... — file:// cannot load the CSS bundle. -->";
  const captureLink = `<link rel="stylesheet" href="${captureCssHref(cssBundleId)}" ${CAPTURE_CSS_LINK_ATTR}="true">`;
  const headExtras = [previewNote, ...FONT_LINKS, captureLink].join("\n    ");

  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `    ${headExtras}\n  </head>`);
  }
  if (/<html/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (m) => `${m}\n  <head>\n    ${headExtras}\n  </head>`);
  }
  return `<!DOCTYPE html><html><head>\n    ${headExtras}\n  </head><body>${html}</body></html>`;
}

/** Remove preview CSS links before inlining styles for iframe srcDoc mockups. */
export function stripTemplatePreviewLinks(html: string): string {
  return html.replace(/<link[^>]*data-md-capture-css-link[^>]*>\s*/gi, "");
}
