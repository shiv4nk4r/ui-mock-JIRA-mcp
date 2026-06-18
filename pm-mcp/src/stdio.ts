/**
 * Stdio MCP entry point — for Claude Code via .mcp.json (pm-context).
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { buildMcpServer } from "./build-server";
import {
  defaultFilesystemDirs,
  initFilesystemAccess,
} from "./filesystem-tools";
import { ensureLocalRepoRoot } from "./repo-env";
import { RepoManager } from "./repo-manager";
import { SessionManager } from "./session-manager";

async function main() {
  const detectedRoot = ensureLocalRepoRoot();
  if (detectedRoot) {
    process.stderr.write(`[pm-mcp] Using manager-dashboard at ${detectedRoot}\n`);
  }

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
