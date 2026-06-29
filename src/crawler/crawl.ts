/**
 * Crawl orchestrator.
 *
 * Run: npm run crawl   (requires `npm run crawl:login` first, or CRAWL_USERNAME/PASSWORD)
 *
 * BFS over the live Manager Dashboard starting from configured route seeds,
 * capturing rendered HTML, the compiled CSS bundle, screenshots, component
 * snapshots, and modal snapshots into the capture store.
 */

import type { Page } from "playwright";

import { discoverLinks, gotoAndSettle, launchSession, spaNavigate } from "./browser";
import { discoverRoutesFromRepo, loadCrawlConfig, type CrawlConfig } from "./config";
import { capturePage, captureCurrent } from "./capture-page";
import { captureInteractions } from "./capture-interactions";
import { mapToSource } from "./extract-components";
import { automatedLogin, isOnLoginPage } from "./login";
import { analyzeCaptures } from "./analyze-captures";
import {
  CAPTURE_VERSION,
  type CaptureManifest,
  type CapturedComponent,
  type CapturedModalRef,
  type CapturedPage,
  type PageSummary,
  ensureCaptureDirs,
  hashContent,
  slugifyRoute,
  writeComponent,
  writeCssBundle,
  writeManifest,
  writePage,
  writeScreenshot,
} from "./capture-store";

interface QueueItem {
  url: string;
  depth: number;
}

function routeOf(url: string, baseUrl: string): string {
  try {
    const u = new URL(url);
    const base = new URL(baseUrl);
    if (u.origin !== base.origin) return u.pathname + u.search;
    return u.pathname.replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

async function main() {
  const config = loadCrawlConfig();

  if (!config.baseUrl) {
    console.error("[crawl] CRAWL_BASE_URL is not set. Add it to .env.local.");
    process.exit(1);
  }

  console.log(`[crawl] Starting crawl of ${config.baseUrl} (label: ${config.label})`);
  ensureCaptureDirs(config.label);

  const { browser, context } = await launchSession(config);
  const page = await context.newPage();

  if (config.username && config.password) {
    console.log("[crawl] Attempting inline credential login…");
    const ok = await automatedLogin(page, context, config);
    console.log(ok ? "[crawl] Login succeeded." : "[crawl] Login status unknown — proceeding.");
  }

  const origin = new URL(config.baseUrl).origin;

  // Seed routes: CLI config + repo discovery
  const seedRoutes = [...config.routes];
  const repoRoutes = discoverRoutesFromRepo();
  console.log(`[crawl] Discovered ${repoRoutes.length} routes from repo router.`);
  const allSeeds = [...new Set([...seedRoutes, ...repoRoutes])];

  const queue: QueueItem[] = allSeeds.map((r) => ({
    url: r.startsWith("http") ? r : `${origin}${r.startsWith("/") ? r : "/" + r}`,
    depth: 0,
  }));

  const visited = new Set<string>();
  const pageResults: CapturedPage[] = [];
  const componentResults: CapturedComponent[] = [];
  const cssBundleIds = new Set<string>();
  const pagesCreatedAt = new Date().toISOString();

  let pageCount = 0;

  while (queue.length > 0 && pageCount < config.maxPages) {
    const item = queue.shift()!;
    const normalUrl = item.url.replace(/\/$/, "") || item.url;

    if (visited.has(normalUrl)) continue;
    visited.add(normalUrl);

    const route = routeOf(normalUrl, config.baseUrl);
    console.log(`[crawl] [${pageCount + 1}/${config.maxPages}] ${route}`);

    try {
      let result;
      if (config.spaNav && pageCount > 0) {
        const navigated = await spaNavigate(page, route, config);
        if (navigated) {
          result = await captureCurrent(page, context, normalUrl, config);
        } else {
          result = await capturePage(page, context, normalUrl, config);
        }
      } else {
        result = await capturePage(page, context, normalUrl, config);
      }

      if (await isOnLoginPage(page)) {
        console.log("[crawl] Session expired — re-authenticating…");
        if (config.username && config.password) {
          await automatedLogin(page, context, config);
          result = await capturePage(page, context, normalUrl, config);
        } else {
          console.error("[crawl] Cannot re-authenticate without credentials. Stopping.");
          break;
        }
      }

      const cssBundleId = result.css.trim() ? writeCssBundle(config.label, result.css) : undefined;
      if (cssBundleId) cssBundleIds.add(cssBundleId);

      const screenshotName = slugifyRoute(route);
      const screenshotFile = writeScreenshot(config.label, screenshotName, result.screenshot);

      const modals: CapturedModalRef[] = [];

      if (config.captureModals) {
        const modalSnapshots = await captureInteractions(page, config, async () => {
          if (config.spaNav) {
            await spaNavigate(page, route, config).catch(() => {});
          } else {
            await gotoAndSettle(page, normalUrl, config).catch(() => {});
          }
        });

        for (const ms of modalSnapshots) {
          const id = hashContent(ms.signature + ms.componentKey);
          const comp: CapturedComponent = {
            id,
            componentKey: ms.componentKey,
            route,
            renderedHtml: ms.html,
            kind: "modal",
            trigger: ms.trigger,
            signature: ms.signature,
          };
          writeComponent(config.label, comp);
          componentResults.push(comp);
          modals.push({ id, trigger: ms.trigger });
        }
      }

      for (const snap of result.snapshots) {
        const sourceMatch = await mapToSource(snap.componentKey, process.env.MD_REPO_ROOT ?? "").catch(() => undefined);
        const id = hashContent(snap.signature + route);
        const comp: CapturedComponent = {
          id,
          componentKey: snap.componentKey,
          sourceMatch,
          route,
          renderedHtml: snap.html,
          kind: "component",
          signature: snap.signature,
        };
        writeComponent(config.label, comp);
        componentResults.push(comp);
      }

      const capturedPage: CapturedPage = {
        route,
        slug: slugifyRoute(route),
        url: normalUrl,
        title: result.title,
        html: result.html,
        screenshot: screenshotFile,
        cssBundleIds: cssBundleId ? [cssBundleId] : [],
        detectedComponents: result.detectedComponents,
        modals,
        capturedAt: new Date().toISOString(),
        sanitized: config.sanitize,
      };

      writePage(config.label, capturedPage);
      pageResults.push(capturedPage);
      pageCount++;

      if (item.depth < config.maxDepth) {
        const links = await discoverLinks(page, origin);
        for (const link of links) {
          const norm = link.replace(/\/$/, "") || link;
          if (!visited.has(norm)) {
            queue.push({ url: norm, depth: item.depth + 1 });
          }
        }
      }
    } catch (err) {
      console.error(`[crawl] Error on ${route}: ${(err as Error).message}`);
    }
  }

  await browser.close();

  const manifest: CaptureManifest = {
    version: CAPTURE_VERSION,
    label: config.label,
    baseUrl: config.baseUrl,
    createdAt: pagesCreatedAt,
    updatedAt: new Date().toISOString(),
    appCommit: config.appCommit,
    pages: pageResults.map((p): PageSummary => ({
      route: p.route,
      slug: p.slug,
      title: p.title,
      screenshot: p.screenshot,
      componentCount: p.detectedComponents.length,
      modalCount: p.modals.length,
    })),
    componentIds: componentResults.map((c) => c.id),
    cssBundleIds: [...cssBundleIds],
  };

  writeManifest(config.label, manifest);

  console.log(`[crawl] Captured ${pageResults.length} pages, ${componentResults.length} components.`);
  console.log(`[crawl] Manifest written → ~/.pm-orchestrator/captures/${config.label}/manifest.json`);

  if (config.analyzeTemplates && pageResults.length > 0) {
    console.log("[crawl] Running template analyzer…");
    try {
      analyzeCaptures({ label: config.label, sanitize: config.sanitize });
    } catch (err) {
      console.error(`[crawl] Template analysis failed: ${(err as Error).message}`);
    }
  }

  console.log("[crawl] Done.");
}

main().catch((err) => {
  console.error(`[crawl] Fatal: ${(err as Error).message}`);
  process.exit(1);
});
