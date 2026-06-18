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

import { discoverLinks, gotoAndSettle, launchSession, spaNavigate } from "./browser";
import {
  discoverRoutesFromRepo,
  loadCrawlConfig,
  type CrawlConfig,
} from "./config";
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
    return (u.pathname + u.search).replace(/\/+$/, "") || "/";
  } catch {
    return url;
  }
}

function buildSeeds(config: CrawlConfig): string[] {
  const fromRepo = discoverRoutesFromRepo();
  const routes = new Set<string>([...config.routes, ...fromRepo]);
  console.log(`[crawl] ${routes.size} seed route(s) (${fromRepo.length} from router, ${config.routes.length} from env)`);
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

  // Inline login (preferred): logs in inside this live context so tokens stored
  // in sessionStorage / memory survive the whole crawl (storageState can't).
  let booted = false;
  if (config.username && config.password) {
    console.log("[crawl] Logging in inline with provided credentials…");
    const ok = await automatedLogin(page, context, config);
    if (!ok) {
      console.warn(
        "[crawl] Inline login unconfirmed — continuing, but pages may be the login screen. " +
          "Check .cache/crawl-auth/login-*.png."
      );
    } else {
      console.log("[crawl] Login confirmed.");
      booted = true; // app is already booted + authenticated in this tab
    }
  }

  // For servers without history-mode fallback, boot the SPA at "/" once and
  // navigate client-side via the router for every subsequent route.
  if (config.spaNav && !booted) {
    console.log("[crawl] SPA nav mode — booting app at base URL…");
    await gotoAndSettle(page, config.baseUrl, config);
  }

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
        if (config.spaNav) {
          let navOk = await spaNavigate(page, route, config);
          if (!navOk) {
            console.warn(`[crawl]   skipped ${route}: SPA router not reachable`);
            continue;
          }
          // Some routes trip a logout/redirect — re-authenticate and retry once.
          if (config.username && config.password && (await isOnLoginPage(page))) {
            console.warn(`[crawl]   ${route}: bounced to login, re-authenticating…`);
            await automatedLogin(page, context, config);
            navOk = await spaNavigate(page, route, config);
          }
          if (await isOnLoginPage(page)) {
            console.warn(`[crawl]   skipped ${route}: auth bounce (still on login after retry)`);
            continue;
          }
          result = await captureCurrent(page, context, item.url, config);
        } else {
          result = await capturePage(page, context, item.url, config);
        }
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
          const recover = async () => {
            if (config.spaNav) {
              await spaNavigate(page, route, config);
            } else {
              await gotoAndSettle(page, item.url, config);
            }
          };
          const modals = await captureInteractions(page, config, recover);
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

    if (config.analyzeTemplates && pages.length > 0) {
      console.log("[crawl] Analyzing captures into page templates…");
      analyzeCaptures({ label: config.label, sanitize: config.sanitize });
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(`[crawl] Fatal: ${(err as Error).message}`);
  process.exit(1);
});
