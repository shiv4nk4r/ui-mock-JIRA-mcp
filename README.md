# GCC Studio (poc-mcp)

Next.js app that generates Manager Dashboard HTML mockups from JIRA tickets (Claude Code + MCP), runs internal review workflows, and can **Build** a GitHub PR against `greyorange/manager-dashboard`.

For architecture details, see [DEVELOPER.md](./DEVELOPER.md).

---

## Prerequisites

Install these **before** running the app. macOS with Homebrew is assumed; adapt paths for Linux/Windows.

### 1. Node.js 18+

```bash
node -v   # should print v18.x or newer (v20/v22 fine)
```

Install via [nodejs.org](https://nodejs.org/), nvm, or:

```bash
brew install node
```

### 2. Git

```bash
git --version
```

```bash
brew install git
```

Configure identity (used when the Build job commits):

```bash
git config --global user.name "Your Name"
git config --global user.email "you@greyorange.com"
```

You also need **SSH or HTTPS access** to push to `greyorange/manager-dashboard` (GitHub org permissions).

### 3. Claude Code CLI

Used for mockup generation **and** Build (code implementation).

```bash
npm install -g @anthropic-ai/claude-code
claude --version
claude login
```

Confirm:

```bash
which claude
claude --print -p "say ok"
```

### 4. GitHub CLI (`gh`) — required for Build → PR

Builds open PRs with `gh`. (If `gh` is missing, you can set `GH_TOKEN` instead; see env below.)

```bash
brew install gh
gh auth login
```

Use a GitHub account that can create PRs on `greyorange/manager-dashboard`. Prefer SSH if your git remotes use SSH.

Verify:

```bash
which gh                    # often /opt/homebrew/bin/gh
gh --version
gh auth status              # must succeed (not “token invalid”)
gh repo view greyorange/manager-dashboard
```

If auth fails:

```bash
gh auth refresh -h github.com
# or
gh auth login
```

### 5. Manager Dashboard checkout (`MD_REPO_ROOT`)

MCP tools and Build worktrees need a local clone of the product repo.

```bash
# Option A — use the bundled clone in this project (if present)
ls pm-mcp/.repos/manager-dashboard

# Option B — clone yourself
git clone git@github.com:greyorange/manager-dashboard.git ~/workplace/manager-dashboard
```

Set in `.env.local`:

```bash
MD_REPO_ROOT="/absolute/path/to/manager-dashboard"
```

If unset, the app tries `pm-mcp/.repos/manager-dashboard` under this project.

### 6. Optional but recommended

| Tool / config | Why |
|---------------|-----|
| **Jira API** (`JIRA_USER_EMAIL`, `JIRA_API_TOKEN`) | Live ticket fetch; mock data works without it |
| **Firebase** | Cloud auth/storage; otherwise local demo auth |
| **`GH_TOKEN`** | PAT fallback if `gh` is unavailable in the Next.js process |
| **Playwright** | Only for the capture crawler (`npm run crawl:login`) |

---

## Quick start

```bash
git clone <this-repo-url>
cd poc-mcp
npm install

cp .env.example .env.local
# Edit .env.local — at minimum set MD_REPO_ROOT
# Optional: JIRA_*, GH_TOKEN, Firebase

npm run dev
```

- App: [http://localhost:3000](http://localhost:3000)
- MCP: [http://127.0.0.1:3100](http://127.0.0.1:3100) (started by `npm run dev`)

Restart `npm run dev` after installing `gh` or changing `.env.local` so the server picks up PATH and env.

---

## Build → GitHub PR (internal)

After a review is **approved**, internal users can click **Build PR**:

1. Fresh git worktree from `develop`
2. Claude Code implements from the handoff prompt
3. Commit + push branch `{ticketId}-gcc-studio`
4. Open a PR against `develop`
5. Status and agent logs: **Builds** in the nav (`/builds`)

### Checklist before first Build

- [ ] `claude` on PATH and logged in
- [ ] `git` can `fetch` / `push` to `origin` for manager-dashboard
- [ ] `gh auth status` succeeds **or** `GH_TOKEN` is set in `.env.local`
- [ ] `MD_REPO_ROOT` points at a real clone
- [ ] Dev server restarted after installing tools

### Useful env vars (Build)

See [`.env.example`](./.env.example):

```bash
MD_REPO_ROOT=...
# Optional if gh CLI works:
# GH_TOKEN=ghp_...
# GH_PATH=/opt/homebrew/bin/gh
# GITHUB_REPO=greyorange/manager-dashboard
# PR_BASE_BRANCH=develop
# BUILD_WORKTREE_ROOT=~/.pm-orchestrator/build-worktrees
```

If a build fails only at PR creation (`spawn gh ENOENT` or auth errors), fix `gh`/`GH_TOKEN`, then use **Retry PR step** on the build page — it resumes without re-running Claude.

---

## Sanity commands

```bash
node -v && git --version && which claude && which gh
gh auth status
test -d "$MD_REPO_ROOT" || test -d pm-mcp/.repos/manager-dashboard && echo "MD repo OK"
```

---

## More docs

- [DEVELOPER.md](./DEVELOPER.md) — architecture, MCP, crawler, API routes
- [`.env.example`](./.env.example) — full environment reference
