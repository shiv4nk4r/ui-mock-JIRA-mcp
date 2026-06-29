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
  const screenshot = await page.screenshot({ fullPage: false, type: "png" });
  const detectedComponents = await detectComponents(page);

  let snapshots: RawSnapshot[] = [];
  if (config.captureComponents) {
    const raw = await collectSnapshots(page, COMPONENT_SELECTORS);
    snapshots = dedupeSnapshots(raw);
  }

  return { url, title, html, css, screenshot, detectedComponents, snapshots };
}
