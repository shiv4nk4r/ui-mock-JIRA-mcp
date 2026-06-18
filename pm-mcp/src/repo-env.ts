import fs from "node:fs";
import path from "node:path";

import { PM_MCP_ROOT } from "./paths";

/**
 * When poc-mcp lives inside manager-dashboard, use the parent checkout as REPO_ROOT
 * unless already set (e.g. via pm-mcp/.env).
 */
export function ensureLocalRepoRoot(): void {
  if (process.env.REPO_ROOT) return;

  const candidate = path.resolve(PM_MCP_ROOT, "..");
  if (fs.existsSync(path.join(candidate, ".git"))) {
    process.env.REPO_ROOT = candidate;
    if (process.env.REPO_AUTO_PULL === undefined) {
      process.env.REPO_AUTO_PULL = "false";
    }
  }
}

export function mcpHttpUrl(): string {
  const host = process.env.MCP_HOST ?? "127.0.0.1";
  const port = process.env.MCP_PORT ?? "3100";
  return `http://${host}:${port}/mcp`;
}
