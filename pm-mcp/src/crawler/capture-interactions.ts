/**
 * Interactive capture: open modals / menus / drawers by clicking likely
 * triggers, snapshot the rendered overlay, then close it. Destructive actions
 * are skipped via a text denylist, and clicks are bounded per page.
 */

import type { Page } from "playwright";

import type { CrawlConfig } from "./config";

/** Triggers whose label matches these are skipped (mutating / destructive). */
const DESTRUCTIVE_RE =
  /\b(delete|remove|discard|archive|deactivate|disable|logout|sign\s*out|submit|save|confirm|apply|create|update|cancel\s*order|reset|clear\s*all|export|download|print)\b/i;

const TRIGGER_SELECTORS = [
  ".q-btn",
  "[role='button']",
  ".q-item.q-item--clickable",
  ".q-fab",
];

const OVERLAY_SELECTORS = ".q-dialog, .q-menu, .q-drawer";

const MAX_CLICKS_PER_PAGE = 10;

export interface ModalSnapshot {
  componentKey: string;
  trigger: string;
  html: string;
  signature: string;
  screenshot?: Buffer;
}

interface VisibleOverlay {
  html: string;
  signature: string;
  componentKey: string;
}

async function topVisibleOverlay(page: Page): Promise<VisibleOverlay | null> {
  return page.evaluate((overlaySel) => {
    const isVisible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect();
      const style = getComputedStyle(el as HTMLElement);
      return (
        r.width > 0 &&
        r.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none"
      );
    };
    const signatureOf = (el: Element): string => {
      const parts: string[] = [];
      const visit = (node: Element, depth: number) => {
        if (depth > 2) return;
        const cls = Array.from(node.classList).sort().join(".");
        parts.push(`${node.tagName.toLowerCase()}${cls ? "." + cls : ""}`);
        if (depth < 2) for (const c of Array.from(node.children)) visit(c, depth + 1);
      };
      visit(el, 0);
      return parts.join(">");
    };

    const overlays = Array.from(document.querySelectorAll(overlaySel)).filter(isVisible);
    if (overlays.length === 0) return null;
    const el = overlays[overlays.length - 1];
    const key = el.classList.contains("q-menu")
      ? "q-menu"
      : el.classList.contains("q-drawer")
        ? "q-drawer"
        : "q-dialog";
    return { html: (el as HTMLElement).outerHTML, signature: signatureOf(el), componentKey: key };
  }, OVERLAY_SELECTORS);
}

async function closeOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    const overlay = await topVisibleOverlay(page);
    if (!overlay) return;
    await page.keyboard.press("Escape").catch(() => {});
    await page.waitForTimeout(200);
    const backdrop = page.locator(".q-dialog__backdrop").first();
    if (await backdrop.isVisible().catch(() => false)) {
      await backdrop.click({ force: true, timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(200);
    }
  }
}

export async function captureInteractions(
  page: Page,
  config: CrawlConfig,
  originUrl: string
): Promise<ModalSnapshot[]> {
  const out: ModalSnapshot[] = [];
  const seenSignatures = new Set<string>();

  const handles = await page.$$(TRIGGER_SELECTORS.join(", "));
  let clicks = 0;

  for (const handle of handles) {
    if (clicks >= MAX_CLICKS_PER_PAGE) break;
    try {
      if (!(await handle.isVisible().catch(() => false))) continue;
      const label = ((await handle.innerText().catch(() => "")) || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 60);
      const aria = (await handle.getAttribute("aria-label").catch(() => null)) ?? "";
      const triggerText = label || aria;
      if (!triggerText) continue;
      if (DESTRUCTIVE_RE.test(triggerText) || DESTRUCTIVE_RE.test(aria)) continue;

      clicks++;
      await handle.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);

      // Bail out (and recover) if the click navigated away.
      if (page.url() !== originUrl) {
        await page.goto(originUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
        await page.waitForTimeout(config.settleMs);
        continue;
      }

      const overlay = await topVisibleOverlay(page);
      if (overlay && !seenSignatures.has(overlay.signature)) {
        seenSignatures.add(overlay.signature);
        let screenshot: Buffer | undefined;
        if (config.componentScreenshots) {
          const loc = page.locator(OVERLAY_SELECTORS).last();
          screenshot = await loc.screenshot().catch(() => undefined);
        }
        out.push({
          componentKey: overlay.componentKey,
          trigger: triggerText,
          html: overlay.html,
          signature: overlay.signature,
          screenshot,
        });
      }
      await closeOverlays(page);
    } catch {
      // Stale handle or detached node after a re-render — recover and continue.
      await closeOverlays(page).catch(() => {});
    }
  }

  return out;
}
