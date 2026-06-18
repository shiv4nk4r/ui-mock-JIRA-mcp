# UI Mockup Generator — Claude Session Instructions

## Purpose

This directory is the context workspace for generating high-fidelity HTML UI mockups for the Manager Dashboard from Jira tickets. When a user provides a Jira ticket ID in this session, follow the workflow below exactly.

---

## Workflow: Jira Ticket → HTML Mockup

### Step 1 — Load context (do this first, every session)

Read all four context files before doing anything else:

1. `context.md` — full app architecture, tech stack, data flows, color system
2. `design.md` — **strict design language** — the single source of truth for all UX decisions
3. `site-map.md` — page hierarchy and route structure
4. `component-library.md` — **pre-built HTML+CSS snippets** — copy the BASE CSS BLOCK verbatim into `<style>`; use named SNIPPETs as building blocks; never re-derive component styles from design.md when a snippet exists

These files are large but must be read in full. They make the output accurate.

### Step 2 — Authenticate with Atlassian

Call `mcp__claude_ai_Atlassian__authenticate`. If it returns "ask user to run /mcp", tell the user to run `/mcp` and wait for confirmation before continuing.

### Step 3 — Fetch the Jira ticket

1. Call `mcp__claude_ai_Atlassian__getAccessibleAtlassianResources` to resolve the cloud ID.
2. Call `mcp__claude_ai_Atlassian__getJiraIssue` with the ticket ID (e.g., `GM-294720`).
3. Extract and summarize:
   - Feature description and user story
   - All UI states / statuses
   - State-transition rules (what transitions are allowed from each state)
   - Field visibility rules (e.g., "show User ID only when status = Assigned")
   - Sort, filter, and pagination requirements
   - Any acceptance criteria that affect layout or behavior

### Step 4 — Generate the HTML mockup

Invoke the `frontend-design` skill with the extracted requirements and the full design context from `design.md`. The output must:

- Use the exact color tokens from `design.md` Section 2 (no invented colors)
- Match the typography scale from `design.md` (SourceSansPro, 4-size scale only)
- Follow the correct page pattern from `design.md` (Listing / Detail / Modal / etc.)
- Implement every status, state-transition, and field-visibility rule from the ticket
- Be a standalone HTML file (no external JS frameworks — inline CSS + vanilla JS only)

Save the output to `mockups/<TICKET-ID>-<feature-slug>.html`.

### Step 5 — Refine against product screenshots (if user asks)

Product screenshots are in this directory (PNGs). When refining:

1. Read relevant screenshots in parallel (listing pages, modals, headers).
2. Compare v1 output against actual product patterns.
3. Apply corrections for: logo treatment, avatar, filter bar text labels, sort indicators (CSS triangles, not Material Icons), row height, action button sizing, section banner dots, modal backdrop color, radio option styling, pagination format.
4. Save the refined version as `mockups/<TICKET-ID>-<feature-slug>-v2.html`.

---

## Key design rules (quick reference — full detail in design.md)

| Element | Rule |
|---|---|
| Colors | Only hex values from `design.md` Section 2 — never invent |
| Font | SourceSansPro only; 4-size scale |
| Logo | GreyOrange G-mark (orange SVG) + "GreyOrange" / "Manager Dashboard" wordmarks |
| Top bar | `#101a5c` background, 52px height, sticky |
| Primary nav tabs | `#101a5c` bg, orange underline on active, 42px height |
| Sub-tabs | white bg, orange underline on active, 38px height |
| Section banner | `#101a5c` bg, colored dot + label + value per stat |
| Filter bar | white bg, "≡ Filter" with text label, not icon-only |
| Table rows | 40px compact height; sort indicators = CSS triangles |
| Action buttons | 26×26px, 3px radius, outline style |
| Modal | navy header, white body, `rgba(16,26,92,0.38)` backdrop, radio options as bordered rows |
| Pagination | `< 1 2 3 … N >` with ellipsis |
| Component library | Copy BASE CSS BLOCK verbatim. Compose SNIPPETs. Never re-derive from design.md. |

---

## Output naming convention

```
mockups/<JIRA-ID>-<kebab-case-feature>.html      ← v1
mockups/<JIRA-ID>-<kebab-case-feature>-v2.html   ← refined with screenshots
mockups/session-log-<JIRA-ID>.md                 ← optional cost/step log
```

---

## Permissions

Atlassian MCP tools are pre-allowed in `.claude/settings.local.json`:
- `mcp__claude_ai_Atlassian__getAccessibleAtlassianResources`
- `mcp__claude_ai_Atlassian__getJiraIssue`

If you need additional tools (e.g., `searchJiraIssuesUsingJql`), they will prompt for approval.

---

## What to say when the user gives a ticket ID

"Reading context files and fetching ticket — one moment."

Then proceed with Steps 1–4 without further prompting. Only pause at Step 2 (auth) if authentication is needed.
