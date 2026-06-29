/**
 * Stdio MCP server entry point.
 *
 * Run manually:  npx tsx src/md-mcp-server.ts
 * Via Claude CLI: set in --mcp-config JSON (legacy mode)
 *
 * For the persistent HTTP server, use src/mcp-http-server.ts instead.
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMdMcpServer, ensureIndexed } from "./md-server-tools.js";

ensureIndexed();

const server    = createMdMcpServer();
const transport = new StdioServerTransport();
await server.connect(transport);
