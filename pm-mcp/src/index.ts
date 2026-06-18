/**
 * Standalone MCP HTTP server with git sync and per-session branch support.
 *
 * Run: npm run dev  (default http://127.0.0.1:3100/mcp)
 */

import { randomUUID } from "node:crypto";
import express from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import { buildMcpServer } from "./build-server";
import {
  defaultFilesystemDirs,
  initFilesystemAccess,
} from "./filesystem-tools";
import { ensureLocalRepoRoot, mcpHttpUrl } from "./repo-env";
import { RepoManager } from "./repo-manager";
import { SessionManager } from "./session-manager";
import type { SessionContext } from "./session-manager";

const PORT = Number(process.env.MCP_PORT ?? 3100);
const HOST = process.env.MCP_HOST ?? "127.0.0.1";

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  context: SessionContext;
}

const repoManager = new RepoManager();
const sessionManager = new SessionManager(repoManager);
const sessions: Record<string, SessionEntry> = {};

const app = express();
app.use(express.json({ limit: "4mb" }));

let filesystemRootsCache: string[] = [];

app.get("/health", (_req, res) => {
  const repoState = repoManager.getCurrentState();
  res.json({
    status: "ok",
    service: "pm-mcp",
    version: "2.2.0",
    branch: repoState?.branch ?? null,
    commit: repoState?.commit?.slice(0, 7) ?? null,
    defaultBranch: repoManager.getDefaultBranch(),
    activeSessions: sessionManager.getActiveSessionCount(),
    repoRoot: repoManager.getRepoRoot(),
    filesystemRoots: filesystemRootsCache,
  });
});

async function mcpPostHandler(req: express.Request, res: express.Response) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    if (sessionId && sessions[sessionId]) {
      await sessions[sessionId].transport.handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const newSessionId = randomUUID();
      const context = sessionManager.createSession(newSessionId);
      const server = buildMcpServer(context, { repoManager, sessionManager });

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (id) => {
          sessions[id] = { transport, server, context };
          console.log(`[mcp] Session initialized: ${id} (branch: ${context.branch})`);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions[sid]) {
          console.log(`[mcp] Session closed: ${sid}`);
          sessionManager.removeSession(sid);
          delete sessions[sid];
        }
      };

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: {
        code: -32000,
        message: "Bad Request: No valid session ID provided",
      },
      id: null,
    });
  } catch (err) {
    console.error("[pm-mcp] POST /mcp error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}

async function mcpGetHandler(req: express.Request, res: express.Response) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await sessions[sessionId].transport.handleRequest(req, res);
}

async function mcpDeleteHandler(req: express.Request, res: express.Response) {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await sessions[sessionId].transport.handleRequest(req, res);
}

app.post("/mcp", mcpPostHandler);
app.get("/mcp", mcpGetHandler);
app.delete("/mcp", mcpDeleteHandler);

async function main() {
  const detectedRoot = ensureLocalRepoRoot();
  if (detectedRoot) {
    console.log(`[pm-mcp] Using manager-dashboard at ${detectedRoot}`);
  }

  console.log("[pm-mcp] Syncing repository…");
  const repoState = await repoManager.ensureReady();
  console.log(
    `[pm-mcp] Repository ready: ${repoState.branch} @ ${repoState.commit.slice(0, 7)}`
  );

  console.log("[pm-mcp] Initializing filesystem access…");
  filesystemRootsCache = await initFilesystemAccess(
    defaultFilesystemDirs(repoManager.getRepoRoot())
  );

  console.log("[pm-mcp] Warming code index cache…");
  await sessionManager.warmBranchCache(repoState.branch, repoState.commit);

  setInterval(() => sessionManager.cleanupIdleSessions(), 15 * 60 * 1000);

  app.listen(PORT, HOST, () => {
    console.log(`[pm-mcp] MCP server listening on ${mcpHttpUrl()}`);
    console.log(`[pm-mcp] Health check: http://${HOST}:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error("[pm-mcp] Fatal startup error:", err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  console.log("[pm-mcp] Shutting down…");
  for (const sessionId of Object.keys(sessions)) {
    try {
      await sessions[sessionId].transport.close();
    } catch {
      /* best effort */
    }
    delete sessions[sessionId];
  }
  process.exit(0);
});
