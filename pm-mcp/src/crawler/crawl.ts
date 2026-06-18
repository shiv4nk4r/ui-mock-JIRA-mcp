/**
 * Crawl orchestrator.
 *
 * Run: npm run crawl -w pm-mcp   (requires `npm run crawl:login` first)
 *
 * BFS over the live Manager Dashboard starting from configured route seeds,
 * capturing rendered HTML, the compiled CSS bundle, screenshots, component
 * snapshots, and modal snapshots into the capture store.
 */

import type { Page } from "playwright";

import { discoverLinks, launchSession } from "./browser";
import {
  discoverRoutesFromRepo,
  loadCrawlConfig,
  type CrawlConfig,
} from "./config";
import { capturePage } from "./capture-page";
import { captureInteractions } from "./capture-interactions";
import { mapToSource } from "./extract-components";
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
    return (u.pathname + u.search).replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

function buildSeeds(config: CrawlConfig): string[] {
  const fromRepo = discoverRoutesFromRepo();
  const routes = new Set<string>([...config.routes, ...fromRepo]);
  return [...routes].map((r) => {
    const route = r.startsWith("/") ? r : `/${r}`;
    return `${config.baseUrl}${route}`;
  });
}

async function main() {
  const config = loadCrawlConfig();
  if (!config.baseUrl) {
    console.error(
      "[crawl] CRAWL_BASE_URL is not set. Add it to pm-mcp/.env.local, e.g.\n" +
        "  CRAWL_BASE_URL=https://your-manager-dashboard.example.com"
    );
    process.exit(1);
  }

  const origin = new URL(config.baseUrl).origin;
  ensureCaptureDirs(config.label);
  console.log(`[crawl] label=${config.label} base=${config.baseUrl} headless=${config.headless}`);

  const { browser, context } = await launchSession(config);
  const page: Page = await context.newPage();

  const visited = new Set<string>();
  const queue: QueueItem[] = buildSeeds(config).map((url) => ({ url, depth: 0 }));

  const pages: PageSummary[] = [];
  const allComponentIds: string[] = [];
  const allCssBundleIds = new Set<string>();
  const globalComponentSigs = new Set<string>();

  try {
    while (queue.length > 0 && pages.length < config.maxPages) {
      const item = queue.shift()!;
      const normalized = item.url.replace(/#.*$/, "");
      if (visited.has(normalized)) continue;
      visited.add(normalized);

      const route = routeOf(item.url, config.baseUrl);
      const slug = slugifyRoute(route);
      console.log(`[crawl] (${pages.length + 1}/${config.maxPages}) ${route}`);

      let result;
      try {
        result = await capturePage(page, context, item.url, config);
      } catch (e) {
        console.warn(`[crawl]   skipped ${route}: ${(e as Error).message}`);
        continue;
      }

      // Persist CSS bundle (deduped by content hash).
      const cssBundleIds: string[] = [];
      if (result.css.trim()) {
        const cssId = writeCssBundle(config.label, result.css);
        cssBundleIds.push(cssId);
        allCssBundleIds.add(cssId);
      }

      // Persist page screenshot.
      let pageShot: string | undefined;
      try {
        pageShot = writeScreenshot(config.label, slug, result.screenshot);
      } catch {
        /* non-fatal */
      }

      // Persist component snapshots (deduped globally by signature).
      for (const snap of result.snapshots) {
        const sigKey = `${snap.componentKey}::${snap.signature}`;
        if (globalComponentSigs.has(sigKey)) continue;
        globalComponentSigs.add(sigKey);
        const id = `${snap.componentKey}__${hashContent(sigKey).slice(0, 10)}`;
        const component: CapturedComponent = {
          id,
          componentKey: snap.componentKey,
          sourceMatch: mapToSource(snap.html),
          route,
          renderedHtml: snap.html,
          kind: "component",
          signature: snap.signature,
        };
        writeComponent(config.label, component);
        allComponentIds.push(id);
      }

      // Interactive (modal) capture.
      const modalRefs: CapturedModalRef[] = [];
      if (config.captureModals) {
        try {
          const modals = await captureInteractions(page, config, item.url);
          for (const modal of modals) {
            const sigKey = `${modal.componentKey}::${modal.signature}`;
            const id = `${modal.componentKey}__${hashContent(sigKey).slice(0, 10)}`;
            let shot: string | undefined;
            if (modal.screenshot) {
              shot = writeScreenshot(config.label, `${slug}__${id}`, modal.screenshot);
            }
            if (!globalComponentSigs.has(sigKey)) {
              globalComponentSigs.add(sigKey);
              const component: CapturedComponent = {
                id,
                componentKey: modal.componentKey,
                sourceMatch: mapToSource(modal.html),
                route,
                renderedHtml: modal.html,
                screenshot: shot,
                kind: "modal",
                trigger: modal.trigger,
                signature: modal.signature,
              };
              writeComponent(config.label, component);
              allComponentIds.push(id);
            }
            modalRefs.push({ id, trigger: modal.trigger });
          }
        } catch (e) {
          console.warn(`[crawl]   modal capture failed on ${route}: ${(e as Error).message}`);
        }
      }

      const capturedPage: CapturedPage = {
        route,
        slug,
        url: item.url,
        title: result.title,
        html: result.html,
        screenshot: pageShot,
        cssBundleIds,
        detectedComponents: result.detectedComponents,
        modals: modalRefs,
        capturedAt: new Date().toISOString(),
        sanitized: config.sanitize,
      };
      writePage(config.label, capturedPage);
      pages.push({
        route,
        slug,
        title: result.title,
        screenshot: pageShot,
        componentCount: result.snapshots.length,
        modalCount: modalRefs.length,
      });

      // BFS expansion.
      if (item.depth < config.maxDepth) {
        const links = await discoverLinks(page, origin).catch(() => []);
        for (const link of links) {
          const norm = link.replace(/#.*$/, "");
          if (!visited.has(norm)) queue.push({ url: link, depth: item.depth + 1 });
        }
      }
    }

    const now = new Date().toISOString();
    const manifest: CaptureManifest = {
      version: CAPTURE_VERSION,
      label: config.label,
      baseUrl: config.baseUrl,
      createdAt: now,
      updatedAt: now,
      appCommit: config.appCommit,
      pages,
      componentIds: allComponentIds,
      cssBundleIds: [...allCssBundleIds],
    };
    writeManifest(config.label, manifest);

    console.log(
      `[crawl] Done. ${pages.length} page(s), ${allComponentIds.length} component(s), ` +
        `${allCssBundleIds.size} css bundle(s) → .cache/captures/${config.label}`
    );
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`[crawl] Fatal: ${(err as Error).message}`);
  process.exit(1);
});
