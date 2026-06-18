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

# Verify SSH access to GitHub (required for pm-mcp repo sync)
ssh -T git@github.com

# Run both MCP server and UI together
npm run dev
```

Or run them separately:

```bash
npm run dev:mcp   # MCP server on :3100 (clones/pulls develop first)
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
  ├── Git sync → greyorange/manager-dashboard (develop by default)
  ├── Per-session branch switching + code-graph re-index
  ├── Filesystem tools (@modelcontextprotocol/server-filesystem)
  ├── Context resources (architecture, design, sitemap — bundled)
  └── Code-graph tools (search-code-symbols, get-vue-component, …)
```

The UI connects to MCP via `MCP_SERVER_URL` (default `http://127.0.0.1:3100/mcp`).
Skills stay in **pm-ui** only; all MCP resources and tools live in **pm-mcp**.

## pm-mcp: Repository sync

On startup, pm-mcp:

1. Clones `git@github.com:greyorange/manager-dashboard.git` into `pm-mcp/.repos/manager-dashboard/` (if missing)
2. Fetches and pulls the latest `develop` branch
3. Warms the code-graph cache for that branch before accepting MCP traffic

First run can take 30–60 seconds (clone + index). Subsequent starts use the branch cache when the commit SHA matches.

### Environment variables (pm-mcp/.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `REPO_URL` | `git@github.com:greyorange/manager-dashboard.git` | Git remote (SSH) |
| `REPO_DEFAULT_BRANCH` | `develop` | Branch to pull on startup |
| `REPO_AUTO_PULL` | `true` | Pull latest on startup |
| `REPO_CLONE_DIR` | `.repos/manager-dashboard` | Local clone path (relative to pm-mcp) |
| `REPO_ROOT` | _(unset)_ | Optional override — use existing checkout, skip clone |

### Branch switching (per MCP session)

From Cursor or Claude Desktop, use the MCP tools:

- **`get-repo-status`** — current branch, commit, index status for this session
- **`list-branches`** — remote branches on origin
- **`switch-branch`** — checkout a branch, pull, and re-index for this session only
- **`rebuild-code-index`** — force re-scan of mdui/ + mdbff/ for the session's branch

Example in Cursor chat: *"Use switch-branch to checkout feature/GM-123"*

Code-graph caches are stored per branch at `pm-mcp/.cache/{branch}/code-graph.json`.

## Filesystem access

pm-mcp integrates [`@modelcontextprotocol/server-filesystem`](https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem) so MCP clients can read and browse source files directly.

**Allowed directories (default):**
- The synced repo clone (`mdui/`, `mdbff/`, etc.)
- Bundled context docs + product screenshots (`pm-mcp/src/context/`)

**Tools available:** `read_text_file`, `read_multiple_files`, `read_media_file`, `list_directory`, `directory_tree`, `search_files`, `get_file_info`, `write_file`, `edit_file`, `move_file`, `create_directory`, `list_allowed_directories`, and more.

Use `list_allowed_directories` first to see exact paths, then `read_text_file` to read source:

```
read_text_file { "path": "/path/to/mdui/src/pages/..." }
```

Optional: add extra allowed paths via `FS_ALLOWED_DIRS` in `pm-mcp/.env` (comma-separated).

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

## Code index (manual rebuild)

```bash
npm run index -w pm-mcp
```

Uses `REPO_ROOT` or the cloned repo. Cache goes to `pm-mcp/.cache/develop/` by default.
