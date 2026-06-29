/**
 * Browser helpers — launch, app-ready waiting, CSS bundle extraction, and
 * same-origin link discovery.
 */

import fs from "node:fs";

import { chromium } from "playwright";
import type { Browser, BrowserContext, Page } from "playwright";

import type { CrawlConfig } from "./config";
import { waitForPageReady } from "./wait-for-page";

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
}

export const NAME_SHIM_CONTENT =
  "window.__name = window.__name || function (fn) { return fn; };";

export async function installEvaluateShim(context: BrowserContext): Promise<void> {
  await context.addInitScript({ content: NAME_SHIM_CONTENT });
}

export async function launchSession(config: CrawlConfig): Promise<BrowserSession> {
  const hasCreds = Boolean(config.username && config.password);
  const hasState = fs.existsSync(config.storageStatePath);
  if (!hasState && !hasCreds) {
    throw new Error(
      `No auth state at ${config.storageStatePath} and no CRAWL_USERNAME/CRAWL_PASSWORD set. ` +
        "Run `npm run crawl:login` first, or provide credentials for inline login."
    );
  }
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({
    ...(hasState && !hasCreds ? { storageState: config.storageStatePath } : {}),
    viewport: config.viewport,
  });
  context.setDefaultNavigationTimeout(config.navTimeoutMs);
  await installEvaluateShim(context);
  return { browser, context };
}

export async function gotoAndSettle(
  page: Page,
  url: string,
  config: CrawlConfig
): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: config.navTimeoutMs });
  await waitForPageReady(page, config);
}

export async function spaNavigate(
  page: Page,
  route: string,
  config: CrawlConfig
): Promise<boolean> {
  const issued = await page.evaluate((r) => {
    const el =
      (document.querySelector("#q-app") as unknown as { __vue__?: unknown }) ??
      (document.body as unknown as { __vue__?: unknown });
    const vue = el?.__vue__ as
      | { $router?: { push: (p: string) => Promise<unknown> }; $root?: { $router?: { push: (p: string) => Promise<unknown> } } }
      | undefined;
    const router = vue?.$router ?? vue?.$root?.$router;
    if (!router) return false;
    Promise.resolve(router.push(r)).catch(() => {});
    return true;
  }, route);
  if (!issued) return false;
  await waitForPageReady(page, config);
  return true;
}

interface RawSheet {
  href: string | null;
  css: string | null;
}

export async function extractCss(
  page: Page,
  context: BrowserContext
): Promise<string> {
  const sheets: RawSheet[] = await page.evaluate(() => {
    const out: Array<{ href: string | null; css: string | null }> = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let css: string | null = null;
      try {
        const rules = (sheet as CSSStyleSheet).cssRules;
        css = Array.from(rules).map((r) => r.cssText).join("\n");
      } catch {
        css = null;
      }
      out.push({ href: (sheet as CSSStyleSheet).href, css });
    }
    return out;
  });

  const parts: string[] = [];
  for (const sheet of sheets) {
    if (sheet.css !== null) {
      if (sheet.href) parts.push(`/* source: ${sheet.href} */`);
      parts.push(sheet.css);
      continue;
    }
    if (sheet.href) {
      try {
        const res = await context.request.get(sheet.href);
        if (res.ok()) {
          parts.push(`/* source: ${sheet.href} */`);
          parts.push(await res.text());
        }
      } catch { /* skip unfetchable stylesheet */ }
    }
  }
  return parts.join("\n\n");
}

export async function discoverLinks(page: Page, origin: string): Promise<string[]> {
  const hrefs: string[] = await page.$$eval("a[href]", (els) =>
    els.map((e) => (e as HTMLAnchorElement).href).filter((h): h is string => Boolean(h))
  );
  const seen = new Set<string>();
  const out: string[] = [];
  for (const href of hrefs) {
    try {
      const u = new URL(href);
      if (u.origin !== origin) continue;
      u.hash = "";
      const norm = u.toString();
      if (seen.has(norm)) continue;
      seen.add(norm);
      out.push(norm);
    } catch { /* ignore invalid URL */ }
  }
  return out;
}
