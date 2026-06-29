/**
 * Preview stylesheet injection for analyzed page templates.
 *
 * Templates strip inline <style> blocks (CSS lives in styles/<hash>.css).
 * We add relative <link> tags so templates render correctly when opened via
 * a static server — not when opened via file://.
 */

export const CAPTURE_CSS_LINK_ATTR = "data-md-capture-css-link";

export function captureCssHref(cssBundleId: string): string {
  return `../../styles/${cssBundleId}.css`;
}

const FONT_LINKS = [
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:wght@400;600;700&display=swap">',
  '<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons">',
];

export function injectTemplatePreviewHead(html: string, cssBundleId: string | undefined): string {
  if (!cssBundleId?.trim()) return html;

  const previewNote =
    "<!-- Styled preview: requires a static file server at the captures root — file:// cannot load the CSS bundle. -->";
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

export function stripTemplatePreviewLinks(html: string): string {
  return html.replace(/<link[^>]*data-md-capture-css-link[^>]*>\s*/gi, "");
}
