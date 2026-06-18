/**
 * Crawler configuration — resolves environment + route seeds for a crawl run.
 *
 * The crawler is an offline, dev-only tool, so it loads .env files itself
 * (the MCP server reads process.env directly and is started separately).
 */

import fs from "node:fs";
import path from "node:path";

import { PM_MCP_ROOT } from "../paths";
import { safeLabel } from "./capture-store";

/** Best-effort .env loading without adding a dependency (Node >= 20.12). */
function loadEnvFiles(): void {
  const candidates = [
    path.join(PM_MCP_ROOT, ".env.local"),
    path.join(PM_MCP_ROOT, ".env"),
    path.join(PM_MCP_ROOT, "..", ".env.local"),
    path.join(PM_MCP_ROOT, "..", ".env"),
  ];
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void })
    .loadEnvFile;
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      if (typeof loader === "function") {
        loader.call(process, file);
      } else {
        parseEnvInto(file);
      }
    } catch {
      /* ignore malformed env file */
    }
  }
}

/** Minimal KEY=VALUE parser fallback for older runtimes. */
function parseEnvInto(file: string): void {
  const text = fs.readFileSync(file, "utf-8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

export interface CrawlConfig {
  baseUrl: string;
  label: string;
  storageStatePath: string;
  routes: string[];
  maxDepth: number;
  maxPages: number;
  headless: boolean;
  navTimeoutMs: number;
  settleMs: number;
  captureModals: boolean;
  captureComponents: boolean;
  componentScreenshots: boolean;
  sanitize: boolean;
  /** Navigate routes client-side via the SPA router (for servers w/o history fallback). */
  spaNav: boolean;
  viewport: { width: number; height: number };
  appCommit?: string;
  /** Optional credentials for automated (non-interactive) login. */
  username?: string;
  password?: string;
  /** Optional selector overrides for the login form. */
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(v.trim());
}

function envNum(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Path to the persisted Playwright storage state (cookies/localStorage). */
export function storageStatePathFor(label: string): string {
  return path.join(PM_MCP_ROOT, ".cache", "crawl-auth", `${safeLabel(label)}.json`);
}

export function loadCrawlConfig(): CrawlConfig {
  loadEnvFiles();

  const baseUrl = (process.env.CRAWL_BASE_URL ?? "").replace(/\/+$/, "");
  const label =
    process.env.CRAWL_LABEL ?? process.env.REPO_DEFAULT_BRANCH ?? "develop";

  const routes = (process.env.CRAWL_ROUTES ?? "/")
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);

  return {
    baseUrl,
    label,
    storageStatePath: process.env.CRAWL_STORAGE_STATE ?? storageStatePathFor(label),
    routes,
    maxDepth: envNum("CRAWL_MAX_DEPTH", 1),
    maxPages: envNum("CRAWL_MAX_PAGES", 40),
    headless: envBool("CRAWL_HEADLESS", true),
    navTimeoutMs: envNum("CRAWL_NAV_TIMEOUT_MS", 30_000),
    settleMs: envNum("CRAWL_SETTLE_MS", 1_200),
    captureModals: envBool("CRAWL_CAPTURE_MODALS", true),
    captureComponents: envBool("CRAWL_CAPTURE_COMPONENTS", true),
    componentScreenshots: envBool("CRAWL_COMPONENT_SHOTS", false),
    sanitize: envBool("CRAWL_SANITIZE", false),
    spaNav: envBool("CRAWL_SPA_NAV", false),
    viewport: {
      width: envNum("CRAWL_VIEWPORT_W", 1440),
      height: envNum("CRAWL_VIEWPORT_H", 900),
    },
    appCommit: process.env.CRAWL_APP_COMMIT,
    username: process.env.CRAWL_USERNAME,
    password: process.env.CRAWL_PASSWORD,
    usernameSelector: process.env.CRAWL_USERNAME_SELECTOR,
    passwordSelector: process.env.CRAWL_PASSWORD_SELECTOR,
    submitSelector: process.env.CRAWL_SUBMIT_SELECTOR,
  };
}

/**
 * Best-effort route discovery from the repo's Vue router source. Returns static
 * path strings (skips params like :id). Used as additional seeds when present.
 */
export function discoverRoutesFromRepo(): string[] {
  const repoRoot = process.env.REPO_ROOT;
  if (!repoRoot) return [];
  const routerDir = path.join(repoRoot, "mdui", "src", "router");
  if (!fs.existsSync(routerDir)) return [];

  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!/\.(js|ts|mjs)$/.test(entry.name)) continue;
      const src = fs.readFileSync(abs, "utf-8");
      const re = /path\s*:\s*['"`]([^'"`]+)['"`]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const p = m[1];
        if (!p || p === "*" || p.includes(":") || p.startsWith("http")) continue;
        found.add(p.startsWith("/") ? p : `/${p}`);
      }
    }
  };
  try {
    walk(routerDir);
  } catch {
    /* ignore */
  }
  return [...found];
}
