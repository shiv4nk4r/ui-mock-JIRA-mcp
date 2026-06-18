# poc-mcp

Two-project workspace for the PM Jira orchestrator:

| Project | Purpose | Default URL |
|---------|---------|-------------|
| **pm-ui** | Next.js UI, chat API, Jira integration, visual mockup **skills** | http://localhost:3000 |
| **pm-mcp** | Standalone MCP server — context docs, design language, code-graph tools | http://127.0.0.1:3100/mcp |

## Quick start

```bash
# Install all dependencies (root + both workspaces)
npm install

# Copy env files
cp pm-ui/.env.example pm-ui/.env.local
cp pm-mcp/.env.example pm-mcp/.env

# Run both MCP server and UI together
npm run dev
```

Or run them separately:

```bash
npm run dev:mcp   # MCP server on :3100
npm run dev:ui    # Next.js UI on :3000
```

## Architecture

```
pm-ui (Next.js)
  ├── Visual mockup skills (templates, prompt engineering)
  ├── /api/chat  ──HTTP──▶  pm-mcp (Streamable HTTP MCP)
  ├── /api/jira
  └── /api/config

pm-mcp (Express + MCP SDK)
  ├── Context resources (architecture, design, sitemap)
  ├── PM tools (query-architecture, estimate-effort, …)
  └── Code-graph tools (search-code-symbols, get-vue-component, …)
```

The UI connects to MCP via `MCP_SERVER_URL` (default `http://127.0.0.1:3100/mcp`).
Skills stay in **pm-ui** only; all MCP resources and tools live in **pm-mcp**.

## Cursor / Claude Desktop MCP config

Point your MCP client at the standalone server:

```json
{
  "mcpServers": {
    "pm-context": {
      "url": "http://127.0.0.1:3100/mcp"
    }
  }
}
```

## Code index

Rebuild the code-graph index (scans `mdui/` and `mdbff/` in the parent monorepo):

```bash
npm run index -w pm-mcp
```

Set `REPO_ROOT` in `pm-mcp/.env` if the Manager Dashboard monorepo is not at `../../` relative to pm-mcp.
