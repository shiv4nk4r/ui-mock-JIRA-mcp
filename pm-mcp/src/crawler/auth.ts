/**
 * One-time interactive (or automated) login that saves Playwright storageState.
 *
 * Run: npm run crawl:login -w pm-mcp
 *
 * IMPORTANT: storageState only persists cookies + localStorage. Apps that keep
 * their token in sessionStorage / memory will NOT stay logged in from a saved
 * state file — for those, the crawler logs in inline instead (set CRAWL_USERNAME
 * + CRAWL_PASSWORD and run `npm run crawl`).
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { chromium } from "playwright";

import { installEvaluateShim } from "./browser";
import { loadCrawlConfig } from "./config";
import { automatedLogin } from "./login";

function prompt(question: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, () => {
      rl.close();
      resolve();
    });
  });
}

async function main() {
  const config = loadCrawlConfig();
  if (!config.baseUrl) {
    console.error(
      "[crawl:login] CRAWL_BASE_URL is not set. Add it to pm-mcp/.env.local, e.g.\n" +
        "  CRAWL_BASE_URL=https://your-manager-dashboard.example.com"
    );
    process.exit(1);
  }

  const automated = Boolean(config.username && config.password);
  console.log(
    `[crawl:login] Opening ${config.baseUrl} (${automated ? "automated credential login" : "interactive login"})…`
  );

  const headless = automated ? config.headless : false;
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: config.viewport });
  await installEvaluateShim(context);
  const page = await context.newPage();

  if (automated) {
    const ok = await automatedLogin(page, context, config);
    console.log(
      ok
        ? "[crawl:login] Automated login succeeded."
        : "[crawl:login] Automated login unconfirmed — saving state anyway (inspect login-*.png)."
    );
  } else {
    await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
    console.log(
      "\n[crawl:login] Complete the login in the opened browser window.\n" +
        "When you can see the Manager Dashboard fully loaded, return here and press Enter."
    );
    await prompt("Press Enter once you are logged in… ");
  }

  fs.mkdirSync(path.dirname(config.storageStatePath), { recursive: true });
  await context.storageState({ path: config.storageStatePath });
  console.log(`[crawl:login] Saved auth state → ${config.storageStatePath}`);
  console.log(
    "[crawl:login] NOTE: if the app stores its token in sessionStorage, prefer inline login:\n" +
      "  set CRAWL_USERNAME + CRAWL_PASSWORD and run `npm run crawl -w pm-mcp`."
  );

  await browser.close();
}

main().catch((err) => {
  console.error(`[crawl:login] Fatal: ${(err as Error).message}`);
  process.exit(1);
});
