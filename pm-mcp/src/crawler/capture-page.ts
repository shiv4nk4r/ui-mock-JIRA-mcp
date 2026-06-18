/**
 * Single-page capture: rendered HTML, screenshot, CSS bundle, detected
 * components, and reusable component snapshots.
 */

import type { BrowserContext, Page } from "playwright";

import type { CrawlConfig } from "./config";
import { extractCss, gotoAndSettle } from "./browser";
import {
  COMPONENT_SELECTORS,
  collectSnapshots,
  dedupeSnapshots,
  type RawSnapshot,
} from "./extract-components";
import { sanitizeHtml } from "./sanitize";

export interface CapturePageResult {
  url: string;
  title: string;
  html: string;
  css: string;
  screenshot: Buffer;
  detectedComponents: string[];
  snapshots: RawSnapshot[];
}

/** Detect which known component keys are present on the page. */
async function detectComponents(page: Page): Promise<string[]> {
  return page.evaluate((selectors) => {
    const present: string[] = [];
    for (const sel of selectors) {
      if (document.querySelector(sel)) present.push(sel.replace(/^\./, ""));
    }
    return present;
  }, COMPONENT_SELECTORS);
}

export async function capturePage(
  page: Page,
  context: BrowserContext,
  url: string,
  config: CrawlConfig
): Promise<CapturePageResult> {
  await gotoAndSettle(page, url, config);
  return captureCurrent(page, context, url, config);
}

/** Capture the page in its current (already-navigated) state — no navigation. */
export async function captureCurrent(
  page: Page,
  context: BrowserContext,
  url: string,
  config: CrawlConfig
): Promise<CapturePageResult> {
  const title = await page.title();
  let html = await page.content();
  if (config.sanitize) html = sanitizeHtml(html);

  const css = await extractCss(page, context);
  const screenshot = await page.screenshot({ fullPage: true });
  const detectedComponents = await detectComponents(page);

  let snapshots: RawSnapshot[] = [];
  if (config.captureComponents) {
    const raw = await collectSnapshots(page, COMPONENT_SELECTORS);
    snapshots = dedupeSnapshots(raw).map((s) =>
      config.sanitize ? { ...s, html: sanitizeHtml(s.html) } : s
    );
  }

  return {
    url,
    title,
    html,
    css,
    screenshot,
    detectedComponents,
    snapshots,
  };
}
