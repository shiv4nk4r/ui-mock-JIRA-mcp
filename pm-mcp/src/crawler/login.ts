/**
 * Automated credential login, shared by `crawl:login` (save state) and the
 * crawler itself (in-context login).
 *
 * Note: some SPAs keep their auth token in sessionStorage / memory, which
 * Playwright's storageState does NOT persist. For those apps the crawler logs
 * in inside the same browser context right before crawling, so the live token
 * survives for the whole run.
 */

import fs from "node:fs";
import path from "node:path";

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

async function clickFirst(
  page: Page,
  selectors: string[],
  override?: string
): Promise<boolean> {
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

/** True if a login form (visible password field) is currently on screen. */
export async function isOnLoginPage(page: Page): Promise<boolean> {
  return page
    .locator(PASSWORD_SELECTORS.join(", "))
    .first()
    .isVisible()
    .catch(() => false);
}

/** Automated credential login. Returns true if the login form was submitted away. */
export async function automatedLogin(
  page: Page,
  _context: BrowserContext,
  config: CrawlConfig
): Promise<boolean> {
  const debugDir = path.dirname(config.storageStatePath);
  fs.mkdirSync(debugDir, { recursive: true });

  await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);

  await page
    .waitForSelector(PASSWORD_SELECTORS.join(", "), { timeout: 20_000 })
    .catch(() => {});
  await page.screenshot({ path: path.join(debugDir, "login-1-form.png") }).catch(() => {});

  const userFilled = await fillFirst(
    page,
    USERNAME_SELECTORS,
    config.username!,
    config.usernameSelector
  );
  const passFilled = await fillFirst(
    page,
    PASSWORD_SELECTORS,
    config.password!,
    config.passwordSelector
  );

  if (!userFilled || !passFilled) {
    console.warn(
      `[login] Could not locate login fields (user=${userFilled}, pass=${passFilled}). ` +
        `See ${path.join(debugDir, "login-1-form.png")}.`
    );
    return false;
  }

  await page.screenshot({ path: path.join(debugDir, "login-1b-filled.png") }).catch(() => {});

  const passwordSel = config.passwordSelector ?? PASSWORD_SELECTORS.join(", ");
  const passwordGone = async (): Promise<boolean> =>
    !(await page.locator(passwordSel).first().isVisible().catch(() => false));

  const submitAttempts: Array<() => Promise<void>> = [
    async () => {
      await clickFirst(page, SUBMIT_SELECTORS, config.submitSelector);
    },
    async () => {
      await page.locator(passwordSel).first().press("Enter").catch(() => {});
    },
    async () => {
      await page
        .getByRole("button", { name: /log\s*in|sign\s*in/i })
        .first()
        .click({ timeout: 3_000 })
        .catch(() => {});
    },
  ];

  for (const attempt of submitAttempts) {
    await attempt();
    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    const ok = await page
      .waitForFunction(
        (sel) => {
          const el = document.querySelector(sel as string);
          if (!el) return true;
          const r = (el as HTMLElement).getBoundingClientRect();
          return r.width === 0 && r.height === 0;
        },
        passwordSel,
        { timeout: 8_000 }
      )
      .then(() => true)
      .catch(() => false);
    if (ok || (await passwordGone())) break;
  }

  await page.waitForTimeout(3_000);
  await page.screenshot({ path: path.join(debugDir, "login-2-after.png") }).catch(() => {});

  const onAppOrigin = page.url().startsWith(new URL(config.baseUrl).origin);
  return onAppOrigin && (await passwordGone());
}
