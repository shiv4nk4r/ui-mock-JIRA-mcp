/**
 * Shared post-navigation wait — tuned for live dashboards with polling/WebSockets.
 * networkidle often never fires; we cap it and rely on DOM + short settle instead.
 */

import type { Page } from "playwright";

import type { CrawlConfig } from "./config";

export async function waitForPageReady(page: Page, config: CrawlConfig): Promise<void> {
  await page
    .waitForLoadState("networkidle", { timeout: config.networkIdleMs })
    .catch(() => {});

  await page
    .waitForFunction(
      () => {
        const root = document.querySelector("#q-app") ?? document.body;
        return !!root && root.childElementCount > 0;
      },
      { timeout: Math.min(config.navTimeoutMs, 10_000) }
    )
    .catch(() => {});

  if (config.tableWaitMs > 0) {
    const hasTable = (await page.locator(".q-table").count()) > 0;
    if (hasTable) {
      await page
        .waitForSelector(".q-table tbody tr, .q-table .q-td", {
          timeout: config.tableWaitMs,
        })
        .catch(() => {});
    }
  }

  if (config.settleMs > 0) {
    await page.waitForTimeout(config.settleMs);
  }
}
