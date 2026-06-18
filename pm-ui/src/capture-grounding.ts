/**
 * Server-side mockup CSS grounding from captured pages.
 *
 * Template selection is left to the AI agent via MCP tools.
 * This module loads the captured Quasar CSS bundle for post-generation iframe injection.
 */

import fs from "node:fs";
import path from "node:path";

import { buildGroundingPromptBlock } from "./lean-mockup-run";
import { getMcpHealthUrl, getMcpServerUrl } from "./mcp-client";
import { MOCKUP_ICON_STYLES, rewriteMockupAssetUrls } from "./mockup-assets";
import { WORKSPACE_ROOT } from "./paths";

export { formatRouteHints, suggestTemplateRoutes } from "./lean-mockup-run";

const STYLE_MARKER = "data-md-capture-css";

/** Remove server-injected capture CSS before sending HTML to Claude (re-injected after). */
export function stripInjectedCaptureCss(html: string): string {
  if (!html?.trim()) return html;
  return html
    .replace(/<style[^>]*data-md-capture-css[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<link[^>]*data-md-capture-css-link[^>]*>\s*/gi, "");
}

export interface MockupGrounding {
  available: boolean;
  label: string;
  cssText: string;
  cssBundleId: string;
  promptBlock: string;
}

interface CaptureManifest {
  label: string;
  cssBundleIds: string[];
}

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

async function loadCssBundle(label: string, bundleId: string): Promise<string> {
  if (!bundleId) return "";

  const remote = await fetchText(`${captureStaticBase()}/${label}/styles/${bundleId}.css`);
  if (remote.trim()) return remote;

  return readLocalText(path.join(captureCacheDir(label), "styles", `${bundleId}.css`));
}

export async function buildMockupGrounding(): Promise<MockupGrounding> {
  const empty: MockupGrounding = {
    available: false,
    label: "develop",
    cssText: "",
    cssBundleId: "",
    promptBlock: "",
  };

  const label = await resolveCaptureLabel();
  const manifest =
    (await fetchJson<CaptureManifest>(`${captureStaticBase()}/${label}/manifest.json`)) ??
    readLocalJson<CaptureManifest>(path.join(captureCacheDir(label), "manifest.json"));

  if (!manifest?.cssBundleIds?.length) return empty;

  const cssBundleId = manifest.cssBundleIds[0];
  const cssText = await loadCssBundle(label, cssBundleId);
  if (!cssText.trim()) return empty;

  return {
    available: true,
    label,
    cssText,
    cssBundleId,
    promptBlock: buildGroundingPromptBlock(label),
  };
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
