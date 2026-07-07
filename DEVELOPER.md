# Developer Guide

A Next.js application that generates Quasar-style HTML mockups from JIRA tickets using Claude Code CLI and a persistent MCP server.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Setup & Running Locally](#setup--running-locally)
4. [Directory Structure](#directory-structure)
5. [Key Concepts](#key-concepts)
6. [Data Flow — Mockup Generation](#data-flow--mockup-generation)
7. [API Routes](#api-routes)
8. [MCP HTTP Server (port 3100)](#mcp-http-server-port-3100)
9. [Capture Crawler](#capture-crawler)
10. [Frontend](#frontend)
11. [Code Indexing](#code-indexing)
12. [Environment Variables](#environment-variables)
13. [Contributing](#contributing)

---

## Project Overview

Given a JIRA ticket, the tool generates a pixel-accurate Quasar HTML mockup by:

1. Pre-loading context docs (architecture, design rules, sitemap) into the system prompt
2. Grounding the generation with real captured page templates from the live Manager Dashboard
3. Having Claude Code CLI call a persistent MCP server (port 3100) to read actual source code at inference time
4. Injecting the real compiled Quasar CSS into the output HTML so it renders accurately in an iframe

**Tech stack:** Next.js 14 (App Router), TypeScript, Claude Code CLI, Express, MCP SDK, Playwright.

---

## Architecture

There are **two separate processes** running side by side:

```
┌─────────────────────────────────────┐     ┌──────────────────────────────────────┐
│   Next.js  (port 3000)              │     │   MCP HTTP Server  (port 3100)        │
│   app/api/chat/route.ts             │     │   src/mcp-http-server.ts              │
│                                     │     │                                        │
│  1. Read context docs into strings  │     │  • 17 codebase tools (mcp__md__*)     │
│     via mcp-bridge.ts               │     │  • Shared AST code graph (warm)        │
│                                     │     │  • Per-session McpServer instances     │
│  2. Inject captured Quasar CSS +    │     │  • GET /health                         │
│     page template survey into       │     │  • POST/GET/DELETE /mcp                │
│     system prompt                   │     │                                        │
│                                     │     └──────────────────────────────────────┘
│  3. Ping :3100/health               │                     ▲
│     ├── UP   → --mcp-config HTTP ───│─────────────────────┘
│     └── DOWN → --mcp-config stdio   │   Claude Code CLI connects here at inference time
│                (fallback)           │
│                                     │
│  4. spawn("claude", [...args])      │
│     streams SSE back to browser     │
└─────────────────────────────────────┘
```

**Key distinction:**  
`mcp-bridge.ts` is a **server-side helper** — it reads context documents into strings that get embedded in the system prompt *before* Claude is called. Claude never calls any tool from `mcp-bridge.ts`.  
The **actual MCP tools** Claude calls at inference time are served by `src/mcp-http-server.ts` on port 3100.

---

## Setup & Running Locally

### Prerequisites

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/claude-code) installed and authenticated:
  ```bash
  npm install -g @anthropic-ai/claude-code
  claude login
  ```

### Steps

```bash
# 1. Clone and install
git clone <repo-url>
cd ui-mock-JIRA-mcp
npm install

# 2. Configure environment
cp .env.example .env.local
# Required: MD_REPO_ROOT — path to your local manager-dashboard checkout
# Optional: JIRA_* vars (mock data is used if absent)

# 3. Start both processes
npm run dev
```

`npm run dev` uses `concurrently` to start:
- **MCP server** → `http://127.0.0.1:3100` (begins code graph indexing in background)
- **Next.js** → `http://localhost:3000`

The first request works immediately — if the code graph isn't indexed yet, tools that need it return a "not ready" message and Claude falls back to filesystem tools.

### Optional: Capture Crawler

Captures real rendered HTML/CSS from the live Manager Dashboard for visual grounding.

```bash
npm run crawl:login      # one-time: save browser auth state interactively
npm run crawl            # BFS-crawl live app → ~/.pm-orchestrator/captures/<label>/
npm run analyze-captures # strip templates from captures for use in system prompt
```

Re-run only when the live app UI changes significantly.

### Scripts Reference

| Script | What it does |
|--------|-------------|
| `npm run dev` | Start MCP server + Next.js together (concurrently) |
| `npm run dev:mcp` | Start only the HTTP MCP server on port 3100 |
| `npm run dev:next` | Start only Next.js |
| `npm run build` | Production Next.js build |
| `npm start` | Run production Next.js server |
| `npm run start:mcp` | Run MCP server (production) |
| `npm run type-check` | `tsc --noEmit` |
| `npm run crawl:login` | Interactive login → saves Playwright auth state |
| `npm run crawl` | Run BFS crawler |
| `npm run analyze-captures` | Build page templates from captures |

---

## Directory Structure

```
.
├── app/
│   ├── layout.tsx              # Root layout, fonts
│   ├── page.tsx                # Main UI — gateway / generating / workspace phases
│   ├── globals.css             # Tailwind base + global styles
│   └── api/
│       ├── chat/route.ts       # SSE stream: builds prompt, spawns Claude CLI
│       ├── jira/route.ts       # Fetch Jira ticket + scrape linked URLs
│       └── config/route.ts     # Available models + Claude CLI status
│
├── src/
│   │
│   │   ── MCP server (runs on port 3100) ──────────────────────────────────────
│   ├── mcp-http-server.ts      # Express HTTP server — serves all 17 MCP tools
│   ├── md-server-tools.ts      # createMdMcpServer() factory — all 17 tool defs
│   ├── md-mcp-server.ts        # Stdio fallback entry point (used if port 3100 is down)
│   │
│   │   ── Context pre-loading (server-side only, not Claude-facing MCP) ──────
│   ├── mcp-bridge.ts           # Reads context docs via InMemoryTransport → strings for system prompt
│   │
│   │   ── Capture grounding pipeline ──────────────────────────────────────────
│   ├── capture-catalog.ts      # Formats captured page templates for system prompt
│   ├── capture-grounding.ts    # Reads captured Quasar CSS → injects inline into mockup HTML
│   ├── lean-mockup-run.ts      # LEAN_MOCKUP_RUN protocol + route-hint patterns
│   ├── mockup-assets.ts        # CDN link tags (Material Icons, Font Awesome)
│   │
│   ├── parser/                 # AST code graph (used by MCP tools)
│   │   ├── types.ts            # CodeNode, CodeEdge structures
│   │   ├── parser.ts           # .ts/.js → AST nodes via Babel
│   │   ├── vue-extractor.ts    # .vue SFC → component API surface
│   │   ├── graph-store.ts      # In-memory graph with search/query API
│   │   └── indexer.ts          # Batch file scanner + disk cache
│   │
│   ├── crawler/                # Playwright crawler — captures live app pages
│   │   ├── crawl.ts            # BFS entry point
│   │   ├── auth.ts             # Login flow + auth state persistence
│   │   ├── config.ts           # CrawlConfig from env vars
│   │   ├── capture-store.ts    # Filesystem types + read/write helpers
│   │   ├── analyze-captures.ts # Strips + analyzes captures into page templates
│   │   ├── browser.ts          # Playwright session helpers
│   │   ├── capture-page.ts     # Captures one page (HTML, CSS, screenshot)
│   │   ├── capture-interactions.ts  # Clicks UI triggers to capture modals/menus
│   │   ├── extract-components.ts    # Detects Quasar components on a page
│   │   ├── login.ts            # Automated login
│   │   ├── sanitize.ts         # Optional PII stripping
│   │   ├── template-styles.ts  # Extracts critical CSS
│   │   └── wait-for-page.ts    # Network-idle + SPA settle helpers
│   │
│   ├── templates/              # Static HTML mockup template examples
│   └── mcp-context/            # Context documents injected into system prompt
│       ├── context.md          # GreyOrange system architecture
│       ├── design.md           # Quasar design language guide
│       ├── site-map.md         # Application navigation structure
│       └── component-library.md
│
├── .env.example
├── package.json
├── next.config.ts              # Marks MCP SDK as server-only package
└── tsconfig.json               # @/* → src/*
```

---

## Key Concepts

### Separate MCP Process (port 3100)

`src/mcp-http-server.ts` is a standalone Express process — not part of Next.js. It:

- Starts independently (`npm run dev:mcp`)
- Keeps the AST code graph warm across all requests
- Serves per-session `McpServer` instances via `StreamableHTTPServerTransport`
- Exposes `GET /health` for readiness checks

Claude Code CLI is told to connect to it via `--mcp-config`:
```json
{ "mcpServers": { "md": { "type": "http", "url": "http://127.0.0.1:3100/mcp" } } }
```

### Stdio Fallback

Before each generation, `app/api/chat/route.ts` pings `/health` on port 3100:
- **Server up** → `--mcp-config` points to HTTP (`http://127.0.0.1:3100/mcp`)
- **Server down** → `--mcp-config` spawns `src/md-mcp-server.ts` as a stdio subprocess

This means the app works even if you only run `npm run dev:next` — it's just slower (cold start per request) and the code graph isn't cached.

### Context Injection (mcp-bridge.ts)

`mcp-bridge.ts` is a server-side helper that reads context documents — architecture, design rules, sitemap, component library — and returns them as plain strings. These strings are embedded in Claude's **system prompt** before the CLI is spawned. Claude reads them as text, not as MCP tool responses.

It uses `InMemoryTransport` internally (which is why it imports from `@modelcontextprotocol/sdk`), but this transport runs entirely within the Next.js process and is invisible to Claude.

### Capture Grounding

Before generation the API route:
1. Reads captured Quasar CSS from `~/.pm-orchestrator/captures/<label>/` (`capture-grounding.ts`)
2. Embeds the full page template catalog in the system prompt (`capture-catalog.ts`)
3. After Claude's response, injects the CSS inline via `<style data-md-capture-css>` (`injectGroundingIntoHtml`)

This makes mockups render accurately in `srcDoc` iframes without CDN dependencies.

### LEAN_MOCKUP_RUN Protocol

The system prompt contains a strict workflow contract (`src/lean-mockup-run.ts`) that caps Claude at 3 MCP rounds before it must write the HTML:

| Round | Allowed calls |
|-------|--------------|
| 1 | `get-page-template` (visual) **or** `find-related-context` (code) |
| 2 | `find-related-context` or `read-source-file` for truncated files |
| 3 | Any remaining lookup — then build |

---

## Data Flow — Mockup Generation

```
POST /api/chat
  │
  ├─ 1. fetchContextResources()        [mcp-bridge.ts]
  │      reads context.md, design.md, site-map.md, component-library.md → strings
  │
  ├─ 2. buildMockupGrounding()         [capture-grounding.ts]
  │      reads ~/.pm-orchestrator/captures/<label>/manifest.json + CSS bundle
  │
  ├─ 3. surveyPageTemplates(label)     [capture-catalog.ts]
  │      formats page template catalog for system prompt embedding
  │
  ├─ 4. buildSystemPrompt()
  │      assembles: arch + design + sitemap + component library
  │               + LEAN_MOCKUP_RUN protocol
  │               + page template catalog (if captures available)
  │               + grounding prompt block
  │      → written to temp file (avoids CLI arg-length limits)
  │
  ├─ 5. isMcpServerReady()             [pings :3100/health, 2s timeout]
  │      ├── UP   → mcpConfig = { type: "http", url: "http://127.0.0.1:3100/mcp" }
  │      └── DOWN → mcpConfig = { command: "npx tsx src/md-mcp-server.ts" }
  │      → written to temp JSON file
  │
  ├─ 6. spawn("claude", [
  │        "--print", "--output-format", "stream-json",
  │        "--model", model,
  │        "--system-prompt-file", tmpFile,
  │        "--mcp-config", mcpConfigFile,
  │        "--allowedTools", "Write,Read,mcp__md__*"
  │      ])
  │      stdin ← user message (ticket data + FIRST ACTION directive)
  │
  ├─ 7. Claude calls MCP tools (max 3 rounds):
  │      mcp__md__get-page-template      → stripped DOM template HTML
  │      mcp__md__find-related-context   → scored Vue components + source
  │      mcp__md__read-source-file       → file content
  │      [... any of the 17 tools]
  │
  ├─ 8. Extract HTML between RAW_HTML_COMPONENT_START / RAW_HTML_COMPONENT_END
  │
  ├─ 9. injectGroundingIntoHtml(html, cssText)
  │      → inlines Quasar CSS into <style data-md-capture-css>
  │
  └─ 10. SSE → browser: { html: finalHtml }
```

---

## API Routes

### `GET /api/jira?id=<ticketId>`

Fetches a Jira ticket (summary, description, metadata, comments, subtasks, linked issues, attachments, scraped URLs). Returns mock data if `JIRA_API_TOKEN` is absent.

### `POST /api/chat`

**Request:**
```typescript
{
  jiraTicketId: string;
  jiraData: JiraTicket;
  model: string;               // "claude-haiku-4-5-20251001" | "claude-sonnet-4-6" | ...
  enableVisualSkill: boolean;  // enables grounding + MCP tools
  additionalPmContext?: string;
  isRefinement?: boolean;
  currentHtml?: string;        // required when isRefinement=true
  attachedFiles?: Array<{ name: string; content: string; mimeType: string }>;
}
```

**SSE events:**

| Event | Payload |
|-------|---------|
| `thinking` | `{ thinking: string }` — status while building prompt |
| `delta` | `{ text: string }` — Claude's streaming text |
| `html` | `{ html: string }` — final CSS-injected mockup |
| `done` | `{ inputTokens, outputTokens, costUsd, logFile }` |
| `error` | `{ error: string }` |

### `GET /api/config`

Returns available model list, default model, and Claude Code CLI installation status.

---

## MCP HTTP Server (port 3100)

`src/mcp-http-server.ts` — standalone Express process. Start with `npm run dev:mcp`.

All 17 tool implementations are in `src/md-server-tools.ts` (`createMdMcpServer()` factory). The factory is also imported by the stdio fallback (`src/md-mcp-server.ts`), so both modes share the same tool definitions.

### Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Readiness check — returns `{ status, indexReady, indexStatus, activeSessions }` |
| `POST` | `/mcp` | Initialize session (first request) or route to existing session |
| `GET` | `/mcp` | SSE stream for an open session |
| `DELETE` | `/mcp` | Close a session |

### Tool Reference

| Tool | Input | Purpose |
|------|-------|---------|
| `list-routes` | `filter?` | Full Vue Router route tree |
| `find-components` | `query`, `type?` | Search Vue SFCs by name/path |
| `read-source-file` | `path` | Read any repo file (12k char cap) |
| `list-graphql` | `domain`, `kind?` | GraphQL query/mutation/subscription files |
| `find-usages` | `symbol`, `scope?` | Files that reference a symbol |
| `list-store-modules` | `domain?` | Vuex store module structure |
| `list-resolvers` | `domain?` | BFF GraphQL resolver files |
| `rebuild-code-index` | — | Force full re-index, returns stats |
| `search-code-symbols` | `query`, `kind?`, `limit?` | AST symbol search |
| `get-file-structure` | `filePath` | Symbols + imports/importedBy for a file |
| `find-callers` | `functionName`, `exact?` | What calls a given function |
| `get-vue-component` | `name` | Vue SFC API (props, computed, methods, apollo) |
| `get-resolver-info` | `name` | BFF resolver metadata |
| `find-related-context` | `keywords[]`, `maxComponents?` | Top-scored components by keyword + source snippets |
| `list-captured-pages` | `branch?` | Pages in the capture store |
| `survey-page-templates` | `branch?` | Full page template catalog |
| `get-page-template` | `route?`, `routes[]?`, `archetype?`, `branch?` | Stripped DOM template for 1–6 routes |

### Session Lifecycle

Each Claude Code CLI invocation opens a new MCP session on first `POST /mcp` (`initialize` request). Sessions are tracked in a `Map<id, { transport, server }>`. They are cleaned up on `DELETE /mcp` or after a 2-hour TTL.

---

## Capture Crawler

Captures real rendered pages from the live Manager Dashboard and stores them at:

```
~/.pm-orchestrator/
├── captures/
│   └── <label>/              # e.g. "develop"
│       ├── manifest.json     # page list + CSS bundle IDs
│       ├── css/              # compiled Quasar CSS bundles
│       ├── pages/
│       │   └── <slug>/
│       │       ├── page.json       # metadata + detected components
│       │       ├── template.html   # stripped DOM template
│       │       └── screenshot.png
│       ├── archetypes/       # archetype-level template fallbacks
│       ├── template-index.json
│       └── analysis.json
└── crawl-auth/
    └── <label>.json          # Playwright browser auth state
```

### Page Archetypes

| Archetype | Detected when |
|-----------|--------------|
| `listing-table` | `q-table` present |
| `dashboard-tabs` | `q-tabs` + `q-tab-panel` present |
| `form` | `q-form` / `q-input` + `q-btn` present |
| `other` | anything else |

Claude can call `get-page-template(archetype: "listing-table")` as a fallback when no specific route matches a ticket.

---

## Frontend

`app/page.tsx` — single React client component with three phases:

| Phase | Description |
|-------|-------------|
| `gateway` | Ticket ID input + model picker |
| `generating` | Animated loading screen |
| `workspace` | Chat panel + iframe mockup viewer |

Sessions are persisted to `localStorage` under `poc-mcp-v2-{ticketId}`. Every generation appends to the `messages` array — clicking any message jumps back to that mockup version.

---

## Code Indexing

`src/parser/` scans the manager-dashboard repo and builds an in-memory AST graph. Used by `search-code-symbols`, `get-file-structure`, `find-callers`, `get-vue-component`, and `get-resolver-info`.

**Cache:** `~/.pm-orchestrator/manager-dashboard-code-graph.json` (24-hour TTL)

Indexing runs in the background when the MCP server starts. Tools that need the graph check `indexReady` and return a status message if still building. To force a re-index: call `mcp__md__rebuild-code-index`, or delete the cache file and restart `dev:mcp`.

---

## Environment Variables

Copy `.env.example` to `.env.local`. Minimum for full functionality: `MD_REPO_ROOT`.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MD_REPO_ROOT` | **Yes** | — | Path to local manager-dashboard repo |
| `JIRA_USER_EMAIL` | No | — | Atlassian email — mock data used if absent |
| `JIRA_API_TOKEN` | No | — | Jira API token |
| `NEXT_PUBLIC_JIRA_BASE_URL` | No | `https://greyorange-work.atlassian.net` | Jira instance URL |
| `MCP_PORT` | No | `3100` | Port for the HTTP MCP server |
| `MCP_HOST` | No | `127.0.0.1` | Bind address for the HTTP MCP server |
| `MCP_SERVER_URL` | No | `http://127.0.0.1:3100/mcp` | Full MCP URL used by the Next.js API route |
| `CRAWL_BASE_URL` | For crawl | — | URL of the live Manager Dashboard to crawl |
| `CRAWL_LABEL` | No | `develop` | Capture set folder name |
| `CRAWL_ROUTES` | No | `/` | Comma-separated BFS seed routes |
| `CRAWL_USERNAME` | No | — | Automated login credentials |
| `CRAWL_PASSWORD` | No | — | Automated login credentials |
| `CRAWL_USERNAME_SELECTOR` | No | — | CSS selector for non-standard login input |
| `CRAWL_PASSWORD_SELECTOR` | No | — | CSS selector for non-standard login input |
| `CRAWL_SUBMIT_SELECTOR` | No | — | CSS selector for non-standard submit button |
| `CRAWL_STORAGE_STATE` | No | auto | Custom Playwright auth state file path |
| `CRAWL_SANITIZE` | No | `false` | Strip PII/IDs from captured HTML |
| `CRAWL_APP_COMMIT` | No | — | Git SHA to tag the capture set |
| `CRAWL_MAX_DEPTH` | No | `1` | BFS depth (0 = seeds only) |
| `CRAWL_MAX_PAGES` | No | `40` | Hard page cap per run |
| `CRAWL_SPA_NAV` | No | `false` | Use Vue Router navigation (SPA mode) |
| `CRAWL_ANALYZE_TEMPLATES` | No | `true` | Run template analysis after crawl |

---

## Contributing

### Adding a New MCP Tool

1. Open [src/md-server-tools.ts](src/md-server-tools.ts) and add a `server.tool(...)` call inside `createMdMcpServer()` before `return server`:
   ```typescript
   server.tool(
     "my-tool-name",
     { param: z.string().describe("What this does") },
     async ({ param }) => {
       return { content: [{ type: "text", text: doSomething(param) }] };
     }
   );
   ```
2. Add `"mcp__md__my-tool-name"` to the `MD_MCP_TOOLS` array in [app/api/chat/route.ts](app/api/chat/route.ts) so Claude Code CLI is permitted to call it.
3. Restart `npm run dev:mcp`.

### Updating Context Documents

Files in [src/mcp-context/](src/mcp-context/) are read at runtime — edits take effect on the next request:

| File | Content |
|------|---------|
| `context.md` | System architecture, modules, data flows |
| `design.md` | Quasar component patterns, design tokens |
| `site-map.md` | Navigation routes and page hierarchy |
| `component-library.md` | Quasar component usage reference |

### Refreshing Captures

After the live app UI changes:
```bash
npm run crawl
npm run analyze-captures
```

### Type Checking

```bash
npm run type-check   # must pass — no test suite
```
