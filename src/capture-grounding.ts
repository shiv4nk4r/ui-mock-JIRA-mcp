/**
 * Mockup CSS grounding from captured pages.
 *
 * Reads the captured Quasar CSS bundle (filesystem-only, no HTTP server)
 * and injects it inline into generated mockup HTML for pixel-accurate iframe rendering.
 */

import {
  listCaptureLabels,
  readManifest,
  readCssBundle,
} from "./crawler/capture-store";
import { buildGroundingPromptBlock } from "./lean-mockup-run";
import { MOCKUP_ICON_STYLES, rewriteMockupAssetUrls } from "./mockup-assets";

const STYLE_MARKER = "data-md-capture-css";

export interface MockupGrounding {
  available: boolean;
  label: string;
  cssText: string;
  cssBundleId: string;
  promptBlock: string;
}

/** Remove server-injected capture CSS before sending HTML to Claude for refinement. */
export function stripInjectedCaptureCss(html: string): string {
  if (!html?.trim()) return html;
  return html
    .replace(/<style[^>]*data-md-capture-css[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link[^>]*data-md-capture-css-link[^>]*>\s*/gi, "");
}

/** Synchronously load the primary CSS bundle for the most recent capture set. */
export function buildMockupGrounding(): MockupGrounding {
  const empty: MockupGrounding = { available: false, label: "develop", cssText: "", cssBundleId: "", promptBlock: "" };

  const label = listCaptureLabels()[0];
  if (!label) return empty;

  const manifest = readManifest(label);
  if (!manifest?.cssBundleIds?.length) return { ...empty, label };

  const cssBundleId = manifest.cssBundleIds[0];
  const cssText = readCssBundle(label, cssBundleId) ?? "";
  if (!cssText.trim()) return { ...empty, label };

  return {
    available: true,
    label,
    cssText,
    cssBundleId,
    promptBlock: buildGroundingPromptBlock(label),
  };
}

/** Inline captured Quasar CSS into mockup HTML — required for iframe srcDoc. */
export function injectGroundingIntoHtml(html: string, cssText: string): string {
  if (!html?.trim()) return html;

  let doc = rewriteMockupAssetUrls(html)
    .replace(/<style[^>]*data-md-capture-css[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link[^>]*data-md-capture-css-link[^>]*>\s*/gi, "");

  const headExtras = cssText.trim()
    ? `${MOCKUP_ICON_STYLES}\n<style ${STYLE_MARKER}="true">\n${cssText}\n</style>`
    : MOCKUP_ICON_STYLES;

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
