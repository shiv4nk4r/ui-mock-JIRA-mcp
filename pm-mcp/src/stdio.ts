/**
 * Stdio MCP entry point — for Claude Code / Claude Desktop via .mcp.json.
 * Runs the same pm-context server over stdio (Claude spawns this process).
 */

import fs from "node:fs";
import path from "node:path";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { buildMcpServer } from "./build-server";
import {
  defaultFilesystemDirs,
  initFilesystemAccess,
} from "./filesystem-tools";
import { PM_MCP_ROOT } from "./paths";
import { RepoManager } from "./repo-manager";
import { SessionManager } from "./session-manager";

/** Use parent monorepo checkout when poc-mcp lives inside manager-dashboard. */
function ensureLocalRepoRoot(): void {
  if (process.env.REPO_ROOT) return;

  const candidate = path.resolve(PM_MCP_ROOT, "..");
  if (fs.existsSync(path.join(candidate, ".git"))) {
    process.env.REPO_ROOT = candidate;
    if (process.env.REPO_AUTO_PULL === undefined) {
      process.env.REPO_AUTO_PULL = "false";
    }
  }
}

async function main() {
  ensureLocalRepoRoot();

  const repoManager = new RepoManager();
  const sessionManager = new SessionManager(repoManager);

  process.stderr.write("[pm-mcp] Syncing repository (stdio)…\n");
  const repoState = await repoManager.ensureReady();
  process.stderr.write(
    `[pm-mcp] Repository ready: ${repoState.branch} @ ${repoState.commit.slice(0, 7)}\n`
  );

  await initFilesystemAccess(defaultFilesystemDirs(repoManager.getRepoRoot()));
  await sessionManager.warmBranchCache(repoState.branch, repoState.commit);

  const context = sessionManager.createSession("stdio");
  const server = buildMcpServer(context, { repoManager, sessionManager });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[pm-mcp] Stdio MCP server running\n");
}

main().catch((err) => {
  process.stderr.write(`[pm-mcp] Fatal: ${(err as Error).message}\n`);
  process.exit(1);
});
