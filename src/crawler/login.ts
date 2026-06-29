/**
 * Automated credential login shared by the crawler and auth script.
 */

import type { BrowserContext, Page } from "playwright";

import type { CrawlConfig } from "./config";

const USERNAME_SELECTORS = [
  "input[name='username']",
  "#username",
  "input[autocomplete='username']",
  "input[type='email']",
  "input[name='email']",
  "input[type='text']:not([type='hidden'])",
];
const PASSWORD_SELECTORS = [
  "input[name='password']",
  "#password",
  "input[type='password']",
];
const SUBMIT_SELECTORS = [
  "#kc-login",
  "button[type='submit']",
  "input[type='submit']",
  "button:has-text('Log in')",
  "button:has-text('Login')",
  "button:has-text('Sign in')",
  ".q-btn[type='submit']",
];

async function fillFirst(
  page: Page,
  selectors: string[],
  value: string,
  override?: string
): Promise<boolean> {
  const list = override ? [override, ...selectors] : selectors;
  for (const sel of list) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) {
      await loc.fill(value).catch(() => {});
      return true;
    }
  }
  return false;
}

async function clickFirst(page: Page, selectors: string[], override?: string): Promise<boolean> {
  const list = override ? [override, ...selectors] : selectors;
  for (const sel of list) {
    const loc = page.locator(sel).first();
    if (await loc.isVisible().catch(() => false)) {
      await loc.click().catch(() => {});
      return true;
    }
  }
  return false;
}

export function isOnLoginPage(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    return Boolean(
      document.querySelector("input[type='password']") ||
      document.querySelector("input[name='username']") ||
      document.querySelector("#kc-login")
    );
  });
}

export async function automatedLogin(
  page: Page,
  context: BrowserContext,
  config: CrawlConfig
): Promise<boolean> {
  if (!config.username || !config.password) return false;
  if (!config.baseUrl) return false;

  try {
    await page.goto(config.baseUrl, { waitUntil: "domcontentloaded", timeout: config.navTimeoutMs });
    await page.waitForTimeout(500);
  } catch { /* navigate errors are non-fatal */ }

  const onLogin = await isOnLoginPage(page);
  if (!onLogin) return true;

  await fillFirst(page, USERNAME_SELECTORS, config.username, config.usernameSelector);
  await page.waitForTimeout(200);
  await fillFirst(page, PASSWORD_SELECTORS, config.password, config.passwordSelector);
  await page.waitForTimeout(200);
  await clickFirst(page, SUBMIT_SELECTORS, config.submitSelector);

  try {
    await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 10_000 });
  } catch { /* timeout is ok — SPA may not full-navigate */ }

  return !(await isOnLoginPage(page));
}
