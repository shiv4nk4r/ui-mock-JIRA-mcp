/**
 * Standalone MCP HTTP server for the PM context + code-graph tools.
 *
 * Run: npm run dev  (default http://127.0.0.1:3100/mcp)
 * Connect from pm-ui via MCP_SERVER_URL env var.
 */

import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { buildMcpServer } from "./build-server";

const PORT = Number(process.env.MCP_PORT ?? 3100);
const HOST = process.env.MCP_HOST ?? "127.0.0.1";

const app = express();
app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "pm-mcp", version: "2.0.0" });
});

const server = buildMcpServer();

async function handleMcp(req: express.Request, res: express.Response) {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

app.get("/mcp", (req, res) => {
  handleMcp(req, res).catch((err) => {
    console.error("[pm-mcp] GET /mcp error:", err);
    if (!res.headersSent) res.status(500).json({ error: String(err) });
  });
});

app.post("/mcp", (req, res) => {
  handleMcp(req, res).catch((err) => {
    console.error("[pm-mcp] POST /mcp error:", err);
    if (!res.headersSent) res.status(500).json({ error: String(err) });
  });
});

app.listen(PORT, HOST, () => {
  console.log(`[pm-mcp] MCP server listening on http://${HOST}:${PORT}/mcp`);
  console.log(`[pm-mcp] Health check: http://${HOST}:${PORT}/health`);
  console.log(`[pm-mcp] REPO_ROOT: ${process.env.REPO_ROOT ?? "(auto-detected)"}`);
});
