/**
 * Crawler configuration — resolves environment + route seeds for a crawl run.
 * Dev-only tool; loads .env files itself.
 */

import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";

import { safeLabel } from "./capture-store";

function loadEnvFiles(): void {
  const candidates = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
  ];
  const loader = (process as unknown as { loadEnvFile?: (p: string) => void }).loadEnvFile;
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      if (typeof loader === "function") {
        loader.call(process, file);
      } else {
        parseEnvInto(file);
      }
    } catch { /* ignore malformed env file */ }
  }
}

function parseEnvInto(file: string): void {
  const text = fs.readFileSync(file, "utf-8");
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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
  networkIdleMs: number;
  settleMs: number;
  modalSettleMs: number;
  tableWaitMs: number;
  captureModals: boolean;
  captureComponents: boolean;
  componentScreenshots: boolean;
  sanitize: boolean;
  spaNav: boolean;
  viewport: { width: number; height: number };
  appCommit?: string;
  username?: string;
  password?: string;
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  analyzeTemplates: boolean;
  maxModalClicks: number;
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

export function storageStatePathFor(label: string): string {
  return path.join(homedir(), ".pm-orchestrator", "crawl-auth", `${safeLabel(label)}.json`);
}

export function loadCrawlConfig(): CrawlConfig {
  loadEnvFiles();

  const baseUrl = (process.env.CRAWL_BASE_URL ?? "").replace(/\/+$/, "");
  const label = process.env.CRAWL_LABEL ?? "develop";
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
    networkIdleMs: envNum("CRAWL_NETWORK_IDLE_MS", 2_500),
    settleMs: envNum("CRAWL_SETTLE_MS", 400),
    modalSettleMs: envNum("CRAWL_MODAL_SETTLE_MS", 200),
    tableWaitMs: envNum("CRAWL_TABLE_WAIT_MS", 3_000),
    captureModals: envBool("CRAWL_CAPTURE_MODALS", true),
    captureComponents: envBool("CRAWL_CAPTURE_COMPONENTS", true),
    componentScreenshots: envBool("CRAWL_COMPONENT_SHOTS", false),
    sanitize: envBool("CRAWL_SANITIZE", false),
    spaNav: envBool("CRAWL_SPA_NAV", false),
    viewport: { width: envNum("CRAWL_VIEWPORT_W", 1440), height: envNum("CRAWL_VIEWPORT_H", 900) },
    appCommit: process.env.CRAWL_APP_COMMIT,
    username: process.env.CRAWL_USERNAME,
    password: process.env.CRAWL_PASSWORD,
    usernameSelector: process.env.CRAWL_USERNAME_SELECTOR,
    passwordSelector: process.env.CRAWL_PASSWORD_SELECTOR,
    submitSelector: process.env.CRAWL_SUBMIT_SELECTOR,
    analyzeTemplates: envBool("CRAWL_ANALYZE_TEMPLATES", true),
    maxModalClicks: envNum("CRAWL_MAX_MODAL_CLICKS", 15),
  };
}

export function discoverRoutesFromRepo(): string[] {
  const repoRoot = process.env.MD_REPO_ROOT;
  if (!repoRoot) return [];

  const routerDir = path.join(repoRoot, "mdui", "src", "router");
  if (!fs.existsSync(routerDir)) return [];

  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(abs); continue; }
      if (!/\.(js|ts|mjs)$/.test(entry.name)) continue;
      const src = fs.readFileSync(abs, "utf-8");
      const re = /path\s*:\s*['"`]([^'"`]+)['"`]/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src))) {
        const p = m[1];
        if (!p || p === "*" || p.includes(":") || p.startsWith("http")) continue;
        const route = p.startsWith("/") ? p.replace(/\/+$/, "") || "/" : `/${p}`.replace(/\/+$/, "") || "/";
        if (["/login", "/v2/login", "/eula", "/maintenance-page"].includes(route)) continue;
        found.add(route);
      }
    }
  };
  try { walk(routerDir); } catch { /* ignore */ }
  return [...found];
}
