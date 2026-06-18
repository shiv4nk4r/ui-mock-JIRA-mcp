import fs from "node:fs";
import path from "node:path";

import { PM_MCP_ROOT } from "./paths";

/** Manager Dashboard monorepo marker directories */
const MONOREPO_MARKERS = ["mdui", "mdbff"] as const;

function isMonorepoRoot(dir: string): boolean {
  return MONOREPO_MARKERS.every((name) => fs.existsSync(path.join(dir, name)));
}

/**
 * Walk up from `startDir` to find the manager-dashboard monorepo root
 * (directory containing both mdui/ and mdbff/).
 */
export function findManagerDashboardRoot(startDir: string = PM_MCP_ROOT): string | null {
  let current = path.resolve(startDir);
  const fsRoot = path.parse(current).root;

  while (true) {
    if (isMonorepoRoot(current)) return current;
    if (current === fsRoot) break;
    current = path.dirname(current);
  }

  return null;
}

/**
 * Resolve REPO_ROOT for MCP git + filesystem operations.
 *
 * Priority:
 * 1. Explicit REPO_ROOT env
 * 2. Dedicated MCP clone at pm-mcp/.repos/manager-dashboard (preferred — isolated from dev checkout)
 * 3. Live monorepo only when REPO_USE_LOCAL=true
 *
 * When nothing matches, returns null and RepoManager clones on first startup.
 */
export function ensureLocalRepoRoot(): string | null {
  if (process.env.REPO_ROOT) {
    return path.resolve(process.env.REPO_ROOT);
  }

  const cloneDir = process.env.REPO_CLONE_DIR ?? ".repos/manager-dashboard";
  const cloned = path.resolve(PM_MCP_ROOT, cloneDir);
  if (fs.existsSync(path.join(cloned, ".git")) && isMonorepoRoot(cloned)) {
    process.env.REPO_ROOT = cloned;
    if (process.env.REPO_AUTO_PULL === undefined) {
      process.env.REPO_AUTO_PULL = "true";
    }
    return cloned;
  }

  if (process.env.REPO_USE_LOCAL === "true") {
    const monorepoRoot = findManagerDashboardRoot();
    if (monorepoRoot) {
      process.env.REPO_ROOT = monorepoRoot;
      if (process.env.REPO_AUTO_PULL === undefined) {
        process.env.REPO_AUTO_PULL = "false";
      }
      return monorepoRoot;
    }
  }

  return null;
}

export function mcpHttpUrl(): string {
  const host = process.env.MCP_HOST ?? "127.0.0.1";
  const port = process.env.MCP_PORT ?? "3100";
  return `http://${host}:${port}/mcp`;
}
