/**
 * One-time interactive login for the crawler.
 *
 * Run: npm run crawl:login -w pm-mcp
 *
 * Launches a headed browser at CRAWL_BASE_URL, lets you complete the Keycloak
 * SSO flow manually, then persists cookies + localStorage to a storageState
 * file. Subsequent `npm run crawl` runs reuse that state headlessly. Auth is
 * only needed for the duration of a crawl; re-run this if the session expires.
 */

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { chromium } from "playwright";

import { loadCrawlConfig } from "./config";

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

  console.log(`[crawl:login] Opening ${config.baseUrl} in a headed browser…`);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: config.viewport });
  const page = await context.newPage();

  try {
    await page.goto(config.baseUrl, { waitUntil: "domcontentloaded" }).catch(() => {});
  } catch {
    /* user can still navigate manually */
  }

  console.log(
    "\n[crawl:login] Complete the login in the opened browser window.\n" +
      "When you can see the Manager Dashboard fully loaded, return here and press Enter."
  );
  await prompt("Press Enter once you are logged in… ");

  fs.mkdirSync(path.dirname(config.storageStatePath), { recursive: true });
  await context.storageState({ path: config.storageStatePath });
  console.log(`[crawl:login] Saved auth state → ${config.storageStatePath}`);

  await browser.close();
  console.log("[crawl:login] Done. Run `npm run crawl -w pm-mcp` to capture pages.");
}

main().catch((err) => {
  console.error(`[crawl:login] Fatal: ${(err as Error).message}`);
  process.exit(1);
});
