/**
 * Persistent HTTP MCP server for the manager-dashboard codebase.
 *
 * Runs as a long-lived Express process alongside `next dev`.
 * The Next.js API route connects to it via HTTP instead of spawning a new
 * stdio subprocess per request — avoiding cold-start latency and keeping the
 * code graph warm between requests.
 *
 * Start:  npx tsx src/mcp-http-server.ts
 * Or via: npm run dev:mcp
 *
 * Health check: GET http://127.0.0.1:3100/health
 * MCP endpoint: POST/GET/DELETE http://127.0.0.1:3100/mcp
 */

import { randomUUID } from "node:crypto";
import http from "node:http";
import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  createMdMcpServer,
  ensureIndexed,
  indexReady,
  indexStatus,
} from "./md-server-tools.js";

const PORT = Number(process.env.MCP_PORT ?? 3100);
const HOST = process.env.MCP_HOST ?? "127.0.0.1";

// ── Session registry ──────────────────────────────────────────────────────────

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  createdAt: number;
}

const sessions = new Map<string, SessionEntry>();

// Prune sessions older than 2 hours (safety valve — the transport onclose
// handler removes them on clean disconnects).
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
      console.log(`[mcp] Session expired (TTL): ${id}`);
    }
  }
}, 10 * 60 * 1000).unref();

// ── Express app ───────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: "4mb" }));

// ── Health endpoint ───────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "md-mcp",
    version: "1.0.0",
    activeSessions: sessions.size,
    indexReady,
    indexStatus,
    repoRoot: process.env.MD_REPO_ROOT ?? "(default)",
  });
});

// ── MCP POST — initialize new session or route to existing ───────────────────

app.post("/mcp", async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    // Route to existing session
    if (sessionId && sessions.has(sessionId)) {
      await sessions.get(sessionId)!.transport.handleRequest(req, res, req.body);
      return;
    }

    // Create new session on initialize request
    if (!sessionId && isInitializeRequest(req.body)) {
      const newId = randomUUID();

      const server = createMdMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newId,
        onsessioninitialized: (id) => {
          sessions.set(id, { transport, server, createdAt: Date.now() });
          console.log(`[mcp] Session opened: ${id}  (active: ${sessions.size})`);
        },
        onsessionclosed: (id) => {
          sessions.delete(id);
          console.log(`[mcp] Session closed: ${id}  (active: ${sessions.size})`);
        },
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: missing or unknown session ID" },
      id: null,
    });
  } catch (err) {
    console.error("[mcp] POST /mcp error:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// ── MCP GET — SSE stream for an existing session ─────────────────────────────

app.get("/mcp", async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({ error: "Invalid or missing session ID" });
    return;
  }

  try {
    await sessions.get(sessionId)!.transport.handleRequest(req, res);
  } catch (err) {
    console.error("[mcp] GET /mcp error:", err);
    if (!res.headersSent) res.status(500).end();
  }
});

// ── MCP DELETE — close a session ─────────────────────────────────────────────

app.delete("/mcp", async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (!sessionId || !sessions.has(sessionId)) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  try {
    await sessions.get(sessionId)!.transport.handleRequest(req, res);
  } catch (err) {
    console.error("[mcp] DELETE /mcp error:", err);
    if (!res.headersSent) res.status(500).end();
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

ensureIndexed();

const httpServer = http.createServer(app);
httpServer.listen(PORT, HOST, () => {
  console.log(`[mcp] HTTP MCP server listening on http://${HOST}:${PORT}`);
  console.log(`[mcp] Health: http://${HOST}:${PORT}/health`);
  console.log(`[mcp] MCP:    http://${HOST}:${PORT}/mcp`);
});

process.on("SIGTERM", () => {
  console.log("[mcp] SIGTERM — shutting down");
  httpServer.close(() => process.exit(0));
});
