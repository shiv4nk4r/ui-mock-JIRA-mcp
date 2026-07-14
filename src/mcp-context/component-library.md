# Manager Dashboard — Component Library

This file contains two sections:

1. **BASE CSS BLOCK** — copy this verbatim into every mockup's `<style>` tag. Do not modify or re-derive.
2. **SNIPPETS** — named HTML fragments. Find the matching slug and use it as-is; only add ticket-specific column widths or data values.

**LOGO — MANDATORY:**
- ALWAYS use the official GreyOrange logo `<img class="topbar-logo-img">` from the topbar SNIPPET below.
- NEVER use a styled "G" div, generic circle SVG, placeholder icon, or text-only "GreyOrange" wordmark without the official logo image.
- The logo image is embedded as a data URI in the SNIPPET — copy it exactly; do not substitute.

**MANDATORY RULES:**
- COPY the BASE CSS BLOCK verbatim. No edits, no removals.
- For each page section, use the matching SNIPPET. Never re-derive structural HTML.
- Only write NEW CSS for ticket-specific layout (column widths, grid counts, etc.).
- Sort indicators MUST use the CSS triangle pattern from the BASE CSS BLOCK — never Unicode ▲▼.
- Status chip colors come from the chip classes below — never invent hex values for chips.
- **TOOLBAR LAYOUT — TWO ROWS, strictly separated:**
  - **Row 1 (toolbar-top SNIPPET):** Stats summary line — `"[Domain] | Results: N | [Stat]: N"` + refresh/fullscreen icon buttons on the right. This is the ONLY place the record count appears in the toolbar area.
  - **Row 2 (filter-bar SNIPPET):** Filter pill + segmented search (field dropdown + input) + spacer + tune + export. **NEVER put "N results found" text here.**
  - **Footer (pagination-row SNIPPET):** `"N results found"` (left) + rows-per-page select + page buttons (right).
  - The record count appears in TWO places only: toolbar-top stats line AND pagination-row footer. It must NOT appear as standalone text inside the filter-bar row.
- **LIST/TABLE PAGES — FILTERS ARE MANDATORY:**
  - **Side filters (filters-sidebar SNIPPET):** ALWAYS include for any list/table page. The Filter button in `filter-bar` MUST call `toggleFilterPanel()`. Show the sidebar open by default (add `.open` class). The sidebar is an **overlay** — it slides over the **full main view under the navbar** (toolbar + filter bar + table), via `position: absolute` inside `.content-with-filters { position: relative }`. It must NOT be limited to the table card alone. The navbar/topbar stay uncovered. Adapt filter field names to the ticket's domain.
  - **Top summary filters (top-summary-filters SNIPPET):** Include when the domain has meaningful status categories (e.g., Created / In Progress / Completed). Shows quick-toggle count buttons above the table — sourced from `TopSummaryFilter.vue` pattern. Omit only when the ticket explicitly has no status groupings.
  - **Filter types to use in filters-sidebar:** CHECKBOX (multi-select from known values — most common), RADIO (single-select), INPUT (text/number free entry), DATE_TIME_RANGE (date range picker pair), RANGE (min/max numeric). Pick types that match the field semantics.
- **WORKING INTERACTIONS — ALL LIST/TABLE PAGES (non-negotiable):**
  - **Data in JS, never hardcoded HTML rows.** Declare `const ALL_ROWS = [...]` with **15–25 objects** covering every combination of filter values (all statuses, all priorities, all categories) so every filter option returns at least 2 non-empty rows. Never write `<tr>` elements directly in HTML for table data.
  - **Single render pipeline.** Every interaction (filter, sort, page, search, top-filter) must update a shared state object and call `render()`. `render()` derives `filtered → sorted → paged` from `ALL_ROWS` each time and rebuilds the `<tbody>`, pagination, summary counts, and toolbar stats in one pass.
  - **Side filters are live.** Each checkbox/radio `onchange` → `onCheckFilter(field, value, checked)` → `render()`. Active filter count badge on the Filter button updates automatically.
  - **Top summary filters are live.** Each button `onclick` → `setTopFilter(label)` → `render()`. Button counts recompute from `ALL_ROWS` each render so they reflect current sidebar-filter state.
  - **Column sorting is live.** Sortable `<th>` elements carry `data-sort="fieldKey"` and `onclick="sortBy('fieldKey')"`. Sort triangles toggle active class. Clicking the same column reverses direction.
  - **Pagination is live.** `renderPagination(totalCount)` builds page buttons dynamically. Prev/next buttons respect bounds. Rows-per-page select updates `S.pageSize` and re-renders.
  - **Search is live.** Search input + field dropdown trigger `onSearch()` → `render()` on every `input` event.
  - **Action buttons perform their actions.** Every action button mentioned in the JIRA ticket must DO something in the mockup:
    - "View details" → open a detail side-panel or navigate to `#detail`
    - "Cancel / Reject" → call `cancelRow(id)` which sets `row.status = 'Cancelled'` and re-renders
    - "Approve / Release" → `approveRow(id)` → status transition → re-render
    - "Hold / Unhold" → toggle status → re-render
    - "Change priority" → open a small inline modal with radio options → on confirm update row → re-render
    - Any other ticket-specific action → implement the correct state change or modal
  - **Use `data-table-engine` SNIPPET as the base.** Copy it, then fill in: `ALL_ROWS` data, `rowHtml(r)` template function, filter group HTML, and any action modals required by the ticket.
- The `<head>` MUST include these CDN links (the real app self-hosts Source Sans Pro + uses Material Symbols icons):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- Source Sans Pro — matches the self-hosted SourceSansPro OTF the real app uses.
     DO NOT use Source+Sans+3 — that is a different family name and will fall back to Arial. -->
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet">
```

Icon usage: `<span class="material-symbols-outlined">keyboard_arrow_right</span>` (or `material-icons`).

---

## SECTION 1: BASE CSS BLOCK

```css
/* ============================================================
   MANAGER DASHBOARD — BASE CSS BLOCK
   Copy this block verbatim. Do not modify.
   ============================================================ */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Brand palette */
  --primary:     #101a5c;
  --secondary:   #FE8400;
  --positive:    #66bb6a;
  --negative:    #ED3324;
  --info:        #2982cc;
  --warning:     #f9b115;
  --dark:        #636f83;
  --grey:        #696969;
  --light-grey:  #d4d3d3;

  /* Semantic tokens (use these in components) */
  --body-text:   #4D5055;   /* table cell text — NOT --primary */
  --border:      #E7E7E7;   /* filter/input border — NOT --light-grey */
  --page-bg:     #F5F5F5;
  --card-bg:     #FFFFFF;
}

/* Font stack matches quasar.variables.scss: $typography-font-family: 'SourceSansPro','DINNextLTPro'
   CDN equivalent: 'Source Sans Pro' (NOT 'Source Sans 3' — different family) */
body, * {
  font-family: 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body {
  background: var(--page-bg);
  color: var(--body-text);
  line-height: 1.5;
}

/* --- TOP BAR --- */
.topbar {
  height: 56px;          /* 56px — NOT 52px */
  background: #FFFFFF;
  border-bottom: 1px solid var(--light-grey);
  display: flex;
  align-items: center;
  padding: 0 16px;
  position: sticky;
  top: 0;
  z-index: 100;
  gap: 12px;
}
.topbar-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
.topbar-logo-img { height: 28px; width: auto; display: block; flex-shrink: 0; }
.topbar-wordmark { font-size: 13px; font-weight: 700; color: var(--primary); letter-spacing: 0.02em; }
.topbar-product { font-size: 11px; color: var(--dark); letter-spacing: 0.04em; white-space: nowrap; }
.topbar-spacer { flex: 1; }
.topbar-action {
  width: 32px; height: 32px; border: none; background: none;
  cursor: pointer; color: var(--primary); display: flex; align-items: center; justify-content: center;
  border-radius: 4px;
}
.topbar-action:hover { background: var(--page-bg); }
.topbar-meta { font-size: 11px; color: var(--dark); }
.topbar-avatar {
  width: 28px; height: 28px; border-radius: 50%;
  background: var(--primary); color: #fff; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}

/* --- PRIMARY NAV --- */
.primary-nav {
  height: 44px;          /* 44px — NOT 42px */
  background: var(--primary);
  display: flex;
  align-items: stretch;
  padding: 0 8px;
  overflow-x: auto;
}
.nav-tab {
  display: flex; align-items: center;
  padding: 0 14px;
  font-size: 13px; font-weight: 600;
  color: rgba(255,255,255,0.72);
  cursor: pointer; white-space: nowrap;
  border-bottom: 3px solid transparent;
  text-decoration: none;
  transition: color 0.15s, border-color 0.15s;
}
.nav-tab:hover { color: #fff; }
.nav-tab.active { color: #fff; border-bottom-color: var(--secondary); }

/* --- SUB-TABS --- */
.sub-nav {
  height: 38px;
  background: #FFFFFF;
  border-bottom: 1px solid var(--light-grey);
  display: flex;
  align-items: stretch;
  padding: 0 16px;
}
.sub-tab {
  display: flex; align-items: center;
  padding: 0 16px;
  font-size: 13px; font-weight: 600;
  color: var(--dark);
  cursor: pointer; white-space: nowrap;
  border-bottom: 2px solid transparent;  /* 2px — NOT 3px */
  text-decoration: none;
  transition: color 0.15s, border-color 0.15s;
}
.sub-tab:hover { color: var(--primary); }
.sub-tab.active { color: var(--primary); border-bottom-color: var(--secondary); }

/* --- SECTION BANNER --- */
.section-banner {
  height: 40px;          /* 40px — NOT 38px */
  background: var(--primary);
  display: flex;
  align-items: center;
  padding: 0 16px;
  gap: 20px;
}
.section-banner-title { font-size: 13px; font-weight: 700; color: #fff; }
.banner-stat { display: flex; align-items: center; gap: 6px; font-size: 12px; color: rgba(255,255,255,0.85); }
.banner-dot { width: 8px; height: 8px; border-radius: 50%; }
.banner-sep { color: rgba(255,255,255,0.3); padding: 0 4px; }

/* --- FILTER BAR --- */
.filter-bar {
  background: #FFFFFF;
  border-bottom: 1px solid var(--border);
  padding: 6px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.filter-toggle-btn {
  height: 35px;
  display: flex; align-items: center; gap: 6px;
  padding: 0 12px;
  border: 1px solid var(--border);
  background: #fff;
  font-size: 13px; color: var(--primary); font-weight: 600;
  border-radius: 2px; cursor: pointer;
}
.smaller-input {
  height: 35px;
  border: 1px solid var(--border);  /* #E7E7E7 — NOT #d4d3d3 */
  border-radius: 2px;
  padding: 0 8px;
  font-size: 14px;                  /* REAL: input font-size 14px */
  color: var(--body-text);
  background: #fff;
  outline: none;
  min-width: 175px;                 /* REAL: input width 175px */
}
.smaller-input:focus { border-color: var(--secondary); }
.smaller-input::placeholder { color: #C0C0C0; font-size: 12px; }  /* REAL placeholder */
.custom-dropdown {
  height: 35px;
  min-width: 130px;
  border: 1px solid var(--border);  /* #E7E7E7 — NOT #d4d3d3 */
  border-radius: 2px;
  padding: 0 28px 0 10px;
  font-size: 13px;
  color: var(--body-text);
  background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23636f83'/%3E%3C/svg%3E") no-repeat right 10px center;
  -webkit-appearance: none; appearance: none;
  outline: none; cursor: pointer;
}
.custom-dropdown:focus { border-color: var(--secondary); }
/* Segmented search: dropdown joined to the search input (REAL outbound pattern).
   Dropdown loses its right edge/radius; the joined input loses its left radius. */
.filter-bar .custom-dropdown { border-right: none; border-top-right-radius: 0; border-bottom-right-radius: 0; min-width: 130px; width: 130px; }
.smaller-input-joined { border-top-left-radius: 0; border-bottom-left-radius: 0; min-width: 0; width: 220px; }
.filter-spacer { flex: 1; }
.filter-action-btn {
  height: 35px; padding: 0 14px;
  border: 1px solid var(--border);
  background: #fff; border-radius: 2px;
  font-size: 13px; color: var(--primary); font-weight: 600;
  cursor: pointer;
}
.filter-action-btn.primary-action {
  background: var(--primary); color: #fff; border-color: var(--primary);
}
.filter-refresh-btn {
  width: 35px; height: 35px;
  border: 1px solid var(--border); background: #fff; border-radius: 2px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; font-size: 16px; color: var(--dark);
}

/* --- DATA TABLE --- */
.md-v2-table {
  width: 100%; border-collapse: collapse;
  background: var(--card-bg);
}
.md-v2-table thead th {
  background: #F6F6F6;
  color: #4D5055;            /* REAL value — NOT #636f83 */
  font-size: 13px; font-weight: 600;
  height: 40px;              /* REAL: thead tr height 40px */
  padding: 8px;              /* REAL: padding 8px */
  text-align: left;
  border-bottom: 1px solid var(--border);
  border-right: 0.5px solid lightgrey;
  white-space: nowrap;
  position: sticky; top: 0; z-index: 10;
}
.md-v2-table thead th:last-child { border-right: none; }
.md-v2-table tbody td {
  padding: 0 8px;
  height: 40px;              /* REAL: tbody td height 40px */
  font-size: 13px;
  font-weight: 600;          /* REAL: tbody/.q-td font-weight 600 */
  color: #4D5055;            /* REAL: tbody color #4D5055 */
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
  /* Force left-alignment on ALL data cells.
     Right-aligned text wider than the cell clips from the LEFT (shows "nal" not "Normal").
     Only .td-actions overrides this to center. Never set text-align:right on data cells. */
  text-align: left !important;
  overflow: hidden;
}
.md-v2-table tbody tr:hover td { background: #fafafa; }

/* Sort indicators — CSS triangles, never Unicode */
.sort-ico {
  display: inline-flex; flex-direction: column;
  gap: 1px; margin-left: 4px; vertical-align: middle;
}
.sort-ico .up  { width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-bottom:4px solid #ccc; }
.sort-ico .dn  { width:0; height:0; border-left:4px solid transparent; border-right:4px solid transparent; border-top:4px solid #ccc;  }
.sort-ico .up.active  { border-bottom-color: var(--secondary); }
.sort-ico .dn.active  { border-top-color:    var(--secondary); }

/* Column 1 in the REAL outbound table = checkbox + expand toggle together,
   max-width 75px. Columns 1 & 2 are sticky-left (.my-sticky-column-table). */
.td-select-expand, .th-select-expand {
  width: 75px; max-width: 75px; padding: 0 4px;
}
.select-expand-wrap { display: inline-flex; align-items: center; gap: 4px; }

/* Sticky first two columns for wide tables (REAL: .my-sticky-column-table) */
.sticky-cols th:nth-child(1), .sticky-cols td:nth-child(1) {
  position: sticky; left: 0; z-index: 2; background: inherit;
}
.sticky-cols th:nth-child(2), .sticky-cols td:nth-child(2) {
  position: sticky; left: 75px; z-index: 2; background: inherit;
}
.sticky-cols tbody td:nth-child(1), .sticky-cols tbody td:nth-child(2) { background: #fff; }
.sticky-cols thead th:nth-child(1), .sticky-cols thead th:nth-child(2) { z-index: 11; }

/* Checkbox */
.th-check, .td-check { width: 40px; text-align: center; padding: 0 8px; }
.th-check input, .td-check input { cursor: pointer; }

/* Actions column */
.th-actions { width: 120px; text-align: left; }
.td-actions { text-align: left; }

/* Status cell — chip + small progress label + optional on-hold marker (REAL pattern) */
.status-cell { display: inline-flex; align-items: center; gap: 6px; }
.status-progress { font-size: 11px; color: var(--dark); }
.status-onhold { color: var(--warning); font-size: 16px; line-height: 1; }

/* Expand toggle — REAL uses keyboard_arrow_right / keyboard_arrow_down,
   secondary (#FE8400) when expanded. */
.expand-btn {
  width: 22px; height: 22px; border: none; background: none;
  cursor: pointer; color: var(--dark); padding: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.expand-btn .material-symbols-outlined,
.expand-btn .material-icons { font-size: 20px; line-height: 1; }
.expand-btn.expanded { color: var(--secondary); }

/* --- EXPANDABLE ROWS --- */
.row-expanded td { background: #FFF6ED !important; }   /* REAL: parent expanded */
.expanded-td     { background: #FFFCF8 !important; padding: 0 0 0 12px !important; height: auto !important; }
.expanded-table .q-td, .expanded-table td { background: #FFFCF8; }

/* --- STATUS CHIPS ---
   Backgrounds copied verbatim from STATUS_COLOR_MAP in
   mdui/src/constants/order.js. Text is the Quasar default dark (#4D5055).
   Four real buckets: neutral grey, green (done), amber (in-progress), red (failed). */
.chip {
  display: inline-flex; align-items: center;
  height: 20px; border-radius: 4px;
  padding: 0 8px;
  font-size: 12px; font-weight: 600;
  color: #4D5055;                 /* Quasar default chip text — never white */
  white-space: nowrap;
}
/* GREEN — done states (#ebf5e8) */
.chip-completed, .chip-released, .chip-active, .chip-open,
.chip-short-picked                              { background: #ebf5e8; }
/* AMBER — in-progress states (#ffeedc) */
.chip-inprogress, .chip-staging, .chip-picking,
.chip-put, .chip-cancellation, .chip-onhold,
.chip-pending, .chip-staged-failed              { background: #ffeedc; }
/* RED — failed / cancelled states (#ffd8d7) */
.chip-cancelled, .chip-unfulfillable,
.chip-abandoned, .chip-failed, .chip-breached,
.chip-offline                                   { background: #ffd8d7; }
/* NEUTRAL GREY — created / closed / n-a (#ececec) */
.chip-created, .chip-closed, .chip-na           { background: #ececec; }
/* CRITICAL STATUS chip — solid red background, white text (for status use only) */
.chip-critical { background: #ED3324; color: #FFFFFF; }

/* PRIORITY — plain text only, NO chip, NO background.
   Critical priority = red text. Normal/other = inherit.
   NEVER use .chip-critical or any chip class for priority. */
.priority-critical { color: #ED3324; font-weight: 400; }
.priority-normal    { color: inherit;  font-weight: 400; }

/* --- ROW ACTION BUTTONS ---
   REAL outbound v2 row actions are FLAT ROUND icon buttons (no border),
   primary-colored, dense, size sm — rendered with Material Symbols icons.
   Use .row-action-btn for in-table row actions. */
.row-action-btn {
  width: 28px; height: 28px;
  border: none; border-radius: 50%;
  background: none;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--primary);
  padding: 0; margin: 0;
}
.row-action-btn:hover { background: rgba(16,26,92,0.06); }
.row-action-btn .material-symbols-outlined,
.row-action-btn .material-icons { font-size: 20px; line-height: 1; }
.row-actions-cell { display: inline-flex; align-items: center; gap: 2px; }
.row-actions-sep { width: 1px; height: 18px; background: var(--border); margin: 0 4px; }

/* Outline action button (toolbar/non-row use only) */
.act-btn {
  width: 26px; height: 26px;
  border: 1px solid var(--light-grey);
  border-radius: 2px;
  background: #fff;
  cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 13px; color: var(--dark);
  margin: 0 1px;
}
.act-btn:hover { background: var(--page-bg); border-color: var(--dark); }

/* --- PAGINATION --- */
.custom-pagination {
  display: flex; align-items: center; gap: 4px;
  padding: 8px 16px;
  background: #fff;
  border-top: 1px solid var(--border);
  font-size: 12px;
  color: var(--body-text);
}
.pagination-label { font-size: 12px; color: var(--body-text); margin-right: 8px; }
.pg-rows-select {
  height: 30px; border: 1px solid var(--border); border-radius: 2px;
  padding: 0 6px; font-size: 12px; color: var(--body-text);
  background: #fff; cursor: pointer;
}
.pg-btn {
  min-width: 30px; height: 30px;
  border: 1px solid var(--border); border-radius: 2px;
  background: #fff;
  font-size: 12px; color: var(--body-text); font-weight: 600;
  cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
}
.pg-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.pg-btn:hover:not(.active) { background: var(--page-bg); }
.pg-spacer { flex: 1; }

/* --- MODAL --- */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(16,26,92,0.38);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
}
.modal-card {
  background: #fff; border-radius: 4px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.22);
  min-width: 480px; max-width: 640px; width: 100%;
  overflow: hidden;
}
.modal-hdr {
  background: var(--primary);  /* navy header */
  padding: 14px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.modal-title { font-size: 15px; font-weight: 700; color: #fff; }
.modal-close {
  width: 24px; height: 24px; border: none; background: none;
  color: rgba(255,255,255,0.7); font-size: 18px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.modal-body { padding: 20px; }
.modal-footer {
  padding: 12px 20px;
  display: flex; justify-content: flex-end; gap: 8px;
  border-top: 1px solid var(--border);
}
.modal-cancel-btn {
  height: 36px; padding: 0 20px;
  border: 1px solid var(--border); background: #fff; border-radius: 2px;
  font-size: 13px; font-weight: 600; color: var(--dark); cursor: pointer;
}
.modal-proceed-btn {
  height: 36px; padding: 0 20px;
  border: none; background: var(--primary); border-radius: 2px;
  font-size: 13px; font-weight: 600; color: #fff; cursor: pointer;
}
.modal-proceed-btn:hover { background: #0d1648; }

/* --- FILTERS SIDEBAR PANEL ---
   Overlay drawer — absolutely positioned inside .content-with-filters.
   .content-with-filters wraps the FULL main view under the navbar (toolbar + filter bar +
   summary filters + table). Height fills remaining viewport so the panel is not table-only.
   Navbar / topbar / primary-nav stay outside this wrapper and stay uncovered. */
.content-with-filters {
  position: relative;
  background: var(--page-bg);
  /* Fill remaining viewport under chrome (~topbar 56 + primary-nav 44; sub-nav optional) */
  min-height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
}
.page-main {
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.table-section {
  width: 100%;
  overflow: hidden;
  display: flex; flex-direction: column;
  flex: 1;
  min-height: 0;
}
.filters-sidebar {
  position: absolute; top: 0; left: 0; bottom: 0;
  width: 280px;
  height: 100%;
  background: #fff;
  box-shadow: 2px 0 12px rgba(0,0,0,0.13);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  z-index: 50;
  transform: translateX(-100%);
  transition: transform 0.22s ease;
}
.filters-sidebar.open { transform: translateX(0); }
.filters-sidebar-hdr {
  /* REAL: bg-grey-3 header — light grey, NOT navy */
  display: flex; align-items: center;
  padding: 6px 8px;                  /* q-py-sm q-px-sm */
  background: #F5F5F5;               /* bg-grey-3 — matches real app */
  border-bottom: 1px solid var(--border);
}
.filters-sidebar-title {
  font-size: 14px; font-weight: 700;
  color: var(--body-text);           /* #4D5055 — text-custom-grey */
  flex: 1;
}
.filters-sidebar-close {
  /* REAL: q-icon chevron_left, color="primary" */
  background: none; border: none; cursor: pointer;
  color: var(--primary);             /* #101a5c */
  display: flex; align-items: center;
  padding: 2px;
}
/* Clear Filters — separate row below header, right-aligned orange outlined button */
.filters-clear-row {
  display: flex; justify-content: flex-end;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  background: #fff;
}
.filters-clear-btn {
  /* REAL: q-btn flat no-caps size="xs" color="secondary" */
  background: none;
  border: 1px solid var(--secondary);
  border-radius: 2px;
  color: var(--secondary);           /* #FE8400 */
  font-size: 12px; font-weight: 600;
  padding: 2px 8px; cursor: pointer;
  line-height: 1.5;
}
.filters-clear-btn:hover { background: rgba(254,132,0,0.06); }
.filters-sidebar-body { flex: 1; overflow-y: auto; }

/* Thin custom scrollbar — matches thumbStyle in FiltersSidebar.vue */
.filters-sidebar-body::-webkit-scrollbar { width: 5px; }
.filters-sidebar-body::-webkit-scrollbar-thumb {
  background: #d3d3d3; border-radius: 5px;
}

.filter-group { border-bottom: 1px solid var(--border); }
.filter-group-hdr {
  /* REAL: q-expansion-item header-class="text-weight-bold q-pa-sm" */
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px;                      /* q-pa-sm = 0.5rem */
  cursor: pointer; background: #fff; user-select: none;
}
.filter-group-hdr:hover { background: #fafafa; }
.filter-group-label { font-size: 13px; font-weight: 700; color: var(--body-text); }
.filter-group-arrow {
  font-size: 18px; color: var(--dark); transition: transform 0.15s;
}
.filter-group-arrow.expanded { transform: rotate(180deg); }
.filter-group-body { padding: 0 0 4px; display: none; }
.filter-group-body.open { display: block; }

/* REAL: CheckFilter uses row flex with min-width:50% — 2-column grid */
.filter-check-grid { display: flex; flex-wrap: wrap; }
.filter-check-cell {
  min-width: 50%;                    /* 2-column layout — matches real app */
  padding: 4px 8px;                  /* q-pa-xs + q-px-sm */
  display: flex; align-items: center; gap: 6px;
  cursor: pointer; font-size: 13px; color: var(--body-text);
}
.filter-check-cell input[type="checkbox"] {
  cursor: pointer; accent-color: var(--primary);
  width: 14px; height: 14px;        /* q-checkbox size="sm" */
  flex-shrink: 0;
}
/* Full-width cell — for labels too long for 2-col (e.g. "Staging In Progress") */
.filter-check-cell.full { min-width: 100%; }

/* Radio items (single-select groups) — also 2-col where appropriate */
.filter-radio-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 8px; cursor: pointer; font-size: 13px; color: var(--body-text);
}
.filter-radio-item input[type="radio"] {
  cursor: pointer; accent-color: var(--primary);
  width: 14px; height: 14px; flex-shrink: 0;
}

/* INPUT filter inside sidebar */
.filter-sidebar-input {
  height: 32px; width: 100%;
  border: 1px solid var(--border); border-radius: 2px;
  padding: 0 8px; font-size: 13px; color: var(--body-text);
  background: #fff; outline: none; margin: 4px 8px; width: calc(100% - 16px);
}
.filter-sidebar-input:focus { border-color: var(--secondary); }
.filter-date-pair { display: flex; gap: 6px; padding: 4px 8px; }
.filter-date-pair input[type="date"] {
  flex: 1; height: 32px;
  border: 1px solid var(--border); border-radius: 2px;
  padding: 0 6px; font-size: 12px; color: var(--body-text);
  background: #fff; outline: none;
}
.filter-group-badge {
  display: inline-flex; align-items: center; justify-content: center;
  height: 16px; min-width: 18px; padding: 0 4px;
  background: #ffe0b2; color: #4D5055;
  font-size: 11px; font-weight: 600; border-radius: 8px;
}

/* --- TOP SUMMARY FILTERS ---
   Status-count quick-filter bar (TopSummaryFilter.vue). Shows above the table on list pages. */
.top-summary-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; background: #fff;
  border-bottom: 1px solid var(--border); flex-wrap: wrap;
}
.summary-filter-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 12px;
  border: 1px solid var(--border); border-radius: 2px;
  background: #fff; cursor: pointer;
  font-size: 13px; color: var(--body-text); font-weight: 600;
}
.summary-filter-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
.summary-count {
  font-size: 12px; font-weight: 700;
  padding: 1px 6px; border-radius: 10px;
  background: #ffe0b2; color: #4D5055;
}
.summary-filter-btn.active .summary-count { background: rgba(255,255,255,0.25); color: #fff; }

/* --- CARD / CONTENT AREA --- */
.content-area { padding: 16px; }
.card { background: var(--card-bg); border-radius: 4px; overflow: hidden; }

/* --- FORM ELEMENTS (detail/edit panels) --- */
.form-label { font-size: 12px; font-weight: 600; color: var(--dark); margin-bottom: 4px; display: block; }
.form-input {
  height: 40px; width: 100%;
  border: 1px solid var(--border); border-radius: 2px;
  padding: 0 10px; font-size: 13px; color: var(--body-text);
  background: #fff; outline: none;
}
.form-input:focus { border-color: var(--secondary); }
.radio-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border); border-radius: 2px;
  margin-bottom: 6px; cursor: pointer;
}
.radio-row.selected { border-color: var(--primary); background: #f0f2f8; }
```

---

## SECTION 2: HTML SNIPPETS

---

### SNIPPET: topbar

```html
<!-- SNIPPET: topbar — sticky 56px top bar -->
<header class="topbar">
  <a class="topbar-logo" href="#" aria-label="GreyOrange Manager Dashboard">
    <!-- OFFICIAL GreyOrange logo — copy this img tag exactly; never replace with SVG G-mark or text -->
    <img src="GREYORANGE_LOGO_DATA_URI" alt="GreyOrange" class="topbar-logo-img" height="28" />
    <span class="topbar-product">Manager Dashboard</span>
  </a>
  <div class="topbar-spacer"></div>
  <!-- Bell -->
  <button class="topbar-action" title="Notifications">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  </button>
  <span class="topbar-meta">UTC+05:30</span>
  <span class="topbar-meta">EN</span>
  <div class="topbar-avatar">JD</div>
</header>
```

---

### SNIPPET: primary-nav

```html
<!-- SNIPPET: primary-nav — 44px navy nav bar, one active tab -->
<nav class="primary-nav">
  <a class="nav-tab" href="#">Outbound</a>
  <a class="nav-tab" href="#">Inbound</a>
  <a class="nav-tab active" href="#">Inventory</a>
  <a class="nav-tab" href="#">Audit</a>
  <a class="nav-tab" href="#">System</a>
  <a class="nav-tab" href="#">Analytics</a>
  <a class="nav-tab" href="#">Resources</a>
  <a class="nav-tab" href="#">Shift</a>
  <a class="nav-tab" href="#">Notifications</a>
  <a class="nav-tab" href="#">Process</a>
  <a class="nav-tab" href="#">Exceptions</a>
</nav>
```

---

### SNIPPET: sub-nav

```html
<!-- SNIPPET: sub-nav — 38px white sub-tab bar, 2px orange underline on active -->
<div class="sub-nav">
  <a class="sub-tab active" href="#">All Orders</a>
  <a class="sub-tab" href="#">Pending</a>
  <a class="sub-tab" href="#">Completed</a>
  <a class="sub-tab" href="#">Exceptions</a>
</div>
```

---

### SNIPPET: section-banner

```html
<!-- SNIPPET: section-banner — 40px navy banner with colored-dot stats -->
<div class="section-banner">
  <span class="section-banner-title">Outbound Orders</span>
  <span class="banner-sep">|</span>
  <span class="banner-stat">
    <span class="banner-dot" style="background:#66bb6a"></span>
    Completed <strong>124</strong>
  </span>
  <span class="banner-sep">|</span>
  <span class="banner-stat">
    <span class="banner-dot" style="background:#2982cc"></span>
    In Progress <strong>38</strong>
  </span>
  <span class="banner-sep">|</span>
  <span class="banner-stat">
    <span class="banner-dot" style="background:#f9b115"></span>
    Pending <strong>17</strong>
  </span>
  <span class="banner-sep">|</span>
  <span class="banner-stat">
    <span class="banner-dot" style="background:#ED3324"></span>
    Failed <strong>5</strong>
  </span>
</div>
```

---

### SNIPPET: toolbar-top

```html
<!-- SNIPPET: toolbar-top — Row 1 of the table toolbar.
     Summary stats line: "[Domain] | Results: N | [Stat1]: N | [Stat2]: N"
     Right: refresh + fullscreen icon buttons.
     ⚠ RULE: This row shows the stats summary. "N results found" plain text goes ONLY in pagination-row, NEVER here. -->
<div style="display:flex; align-items:center; width:100%; padding:4px 8px; gap:8px;">
  <!-- Stats summary: domain label + result count + optional breakdowns -->
  <span style="font-size:13px; color:#4D5055;">
    Outbound Listing
    <span style="color:#636f83; font-weight:400;"> | Results: </span><strong>184</strong>
    <span style="color:#636f83; font-weight:400;"> | In Progress: </span><strong>42</strong>
    <span style="color:#636f83; font-weight:400;"> | Created: </span><strong>65</strong>
  </span>
  <div style="flex:1"></div>
  <!-- Utility icon buttons: flat round, no border, primary colour -->
  <button class="action-btn" title="Refresh">
    <span class="material-symbols-outlined" style="font-size:18px">refresh</span>
  </button>
  <button class="action-btn" title="Full screen">
    <span class="material-symbols-outlined" style="font-size:18px">fullscreen</span>
  </button>
</div>
<hr style="border:none; border-top:1px solid #e0e0e0; margin:0 0 6px 0;">
```

---

### SNIPPET: filter-bar

```html
<!-- SNIPPET: filter-bar — Row 2 of the table toolbar (appears below toolbar-top + separator).
     Left: Filter pill (with orange badge when filters active) · segmented [field-dropdown | search input].
     Right (after spacer): column-config gear (tune) · export (file_download).
     ⚠ RULE: NO record count here. "N results found" belongs ONLY in pagination-row (footer). -->
<div class="filter-bar">
  <!-- Filter button: opens filters-sidebar panel; no record count here -->
  <button class="filter-toggle-btn" style="position:relative" onclick="toggleFilterPanel()">
    <span class="material-symbols-outlined" style="font-size:18px">filter_list</span>
    Filter
    <!-- Badge only when filters are applied: -->
    <span style="display:inline-flex; align-items:center; justify-content:center; height:16px; min-width:18px; padding:0 4px; margin-left:4px; background:#ffe0b2; color:#4D5055; font-size:11px; font-weight:600; border-radius:8px">2</span>
  </button>

  <!-- Segmented search: field dropdown + input wired to onSearch() from data-table-engine -->
  <select class="custom-dropdown" id="searchField" aria-label="Search field" onchange="onSearch()">
    <option value="id">Order ID</option>
    <option value="station">Station</option>
    <option value="type">Order Type</option>
  </select>
  <input type="text" class="smaller-input smaller-input-joined" id="searchInput"
         placeholder="Search..." oninput="onSearch()">

  <div class="filter-spacer"></div>

  <!-- Configure columns -->
  <button class="filter-refresh-btn" title="Configure columns">
    <span class="material-symbols-outlined" style="font-size:18px">tune</span>
  </button>
  <!-- Export -->
  <button class="filter-refresh-btn" title="Export data">
    <span class="material-symbols-outlined" style="font-size:18px">file_download</span>
  </button>
</div>
```

---

### SNIPPET: top-summary-filters

```html
<!-- SNIPPET: top-summary-filters — Status-count quick-filter bar (TopSummaryFilter.vue pattern).
     Appears between section-banner and toolbar-top on list pages.
     ⚠ RULES:
       - Add data-filter="<StatusLabel>" to every button (used by renderSummaryCounts()).
       - onclick calls setTopFilter() from data-table-engine — do NOT inline onclick logic here.
       - "All" is always the first button and starts active.
       - Counts are recomputed by renderSummaryCounts() on every render(); do not hardcode them. -->
<div class="top-summary-bar">
  <button class="summary-filter-btn active" data-filter="All"         onclick="setTopFilter(this.dataset.filter)">
    All <span class="summary-count">20</span>
  </button>
  <button class="summary-filter-btn" data-filter="Created"            onclick="setTopFilter(this.dataset.filter)">
    Created <span class="summary-count">5</span>
  </button>
  <button class="summary-filter-btn" data-filter="In Progress"        onclick="setTopFilter(this.dataset.filter)">
    In Progress <span class="summary-count">6</span>
  </button>
  <button class="summary-filter-btn" data-filter="Completed"          onclick="setTopFilter(this.dataset.filter)">
    Completed <span class="summary-count">5</span>
  </button>
  <button class="summary-filter-btn" data-filter="Cancelled"          onclick="setTopFilter(this.dataset.filter)">
    Cancelled <span class="summary-count">4</span>
  </button>
</div>
```

---

### SNIPPET: data-table-engine

```html
<!-- SNIPPET: data-table-engine — Complete JS engine for every list/table mockup.
     Copy this block, then customise the three labelled zones:
       ZONE 1: ALL_ROWS — fill with 15-25 domain objects covering every filter value
       ZONE 2: rowHtml(r) — one <tr> per row using the ticket's real columns
       ZONE 3: Filter group checkboxes — match fields and values to the domain
     The engine wires side filters, top summary filters, column sort, pagination,
     search, and action buttons through a single render() call.
     ⚠ NEVER write <tr> elements directly in HTML for table body data. -->

<!-- Place just before </body> -->
<script>
// ═══════════════════════════════════════════════════
// ZONE 1 — DATASET  (customise for the ticket domain)
// Rules: 15-25 rows · every status value appears ≥3 times
//        every priority/type/category value appears ≥2 times
//        use realistic IDs, timestamps, and field values
// ═══════════════════════════════════════════════════
const ALL_ROWS = [
  { id:'ORD-0001', status:'In Progress', type:'B2B',          priority:'Critical', station:'PPS-01', qty:8,  pat:'14:30', pbt:'18:00', created:'2024-07-01' },
  { id:'ORD-0002', status:'Created',     type:'B2C',          priority:'Normal',   station:'PPS-02', qty:3,  pat:'10:00', pbt:'14:00', created:'2024-07-01' },
  { id:'ORD-0003', status:'Completed',   type:'B2B',          priority:'High',     station:'PPS-03', qty:15, pat:'09:00', pbt:'12:00', created:'2024-06-30' },
  { id:'ORD-0004', status:'Cancelled',   type:'Multi-Channel',priority:'Normal',   station:'PPS-04', qty:1,  pat:'11:30', pbt:'15:30', created:'2024-06-30' },
  { id:'ORD-0005', status:'In Progress', type:'B2C',          priority:'High',     station:'PPS-01', qty:22, pat:'13:00', pbt:'17:00', created:'2024-06-29' },
  { id:'ORD-0006', status:'Created',     type:'B2B',          priority:'Critical', station:'PPS-05', qty:5,  pat:'16:00', pbt:'20:00', created:'2024-06-29' },
  { id:'ORD-0007', status:'Completed',   type:'B2C',          priority:'Normal',   station:'PPS-02', qty:9,  pat:'08:00', pbt:'11:00', created:'2024-06-28' },
  { id:'ORD-0008', status:'In Progress', type:'B2B',          priority:'High',     station:'PPS-03', qty:14, pat:'12:00', pbt:'16:00', created:'2024-06-28' },
  { id:'ORD-0009', status:'Created',     type:'Multi-Channel',priority:'Normal',   station:'PPS-06', qty:7,  pat:'15:00', pbt:'19:00', created:'2024-06-27' },
  { id:'ORD-0010', status:'Completed',   type:'B2B',          priority:'Critical', station:'PPS-01', qty:20, pat:'07:30', pbt:'10:30', created:'2024-06-27' },
  { id:'ORD-0011', status:'Cancelled',   type:'B2C',          priority:'High',     station:'PPS-04', qty:2,  pat:'14:00', pbt:'18:00', created:'2024-06-26' },
  { id:'ORD-0012', status:'In Progress', type:'Multi-Channel',priority:'Normal',   station:'PPS-02', qty:11, pat:'10:30', pbt:'14:30', created:'2024-06-26' },
  { id:'ORD-0013', status:'Created',     type:'B2B',          priority:'High',     station:'PPS-05', qty:6,  pat:'09:30', pbt:'13:30', created:'2024-06-25' },
  { id:'ORD-0014', status:'Completed',   type:'B2C',          priority:'Normal',   station:'PPS-03', qty:18, pat:'11:00', pbt:'15:00', created:'2024-06-25' },
  { id:'ORD-0015', status:'In Progress', type:'B2B',          priority:'Critical', station:'PPS-06', qty:4,  pat:'16:30', pbt:'20:30', created:'2024-06-24' },
  { id:'ORD-0016', status:'Created',     type:'B2C',          priority:'Normal',   station:'PPS-01', qty:13, pat:'08:30', pbt:'12:30', created:'2024-06-24' },
  { id:'ORD-0017', status:'Cancelled',   type:'B2B',          priority:'High',     station:'PPS-02', qty:3,  pat:'13:30', pbt:'17:30', created:'2024-06-23' },
  { id:'ORD-0018', status:'Completed',   type:'Multi-Channel',priority:'Critical', station:'PPS-04', qty:25, pat:'10:00', pbt:'14:00', created:'2024-06-23' },
  { id:'ORD-0019', status:'In Progress', type:'B2C',          priority:'Normal',   station:'PPS-05', qty:10, pat:'15:30', pbt:'19:30', created:'2024-06-22' },
  { id:'ORD-0020', status:'Created',     type:'B2B',          priority:'High',     station:'PPS-03', qty:8,  pat:'12:30', pbt:'16:30', created:'2024-06-22' },
];

// ═══════════════════════════════════════════════════
// STATE — shared across all interactions
// ═══════════════════════════════════════════════════
const S = {
  // side filter state — field → Set of selected values (empty Set = show all)
  checkFilters: { status: new Set(), type: new Set(), priority: new Set() },
  inputFilters: {},     // field → string value (for INPUT-type sidebar filters)
  dateFilters:  {},     // field → { from: string, to: string }
  topFilter:    'All',  // active top-summary label ('All' | status value)
  searchField:  'id',
  searchValue:  '',
  sortCol:      null,
  sortDir:      'asc',
  page:         1,
  pageSize:     10,
};

// ═══════════════════════════════════════════════════
// PIPELINE — filter → sort → page
// ═══════════════════════════════════════════════════
function getFiltered() {
  return ALL_ROWS.filter(function(r) {
    // top summary filter
    if (S.topFilter !== 'All' && r.status !== S.topFilter) return false;
    // side checkbox filters (each Set: empty = no restriction)
    for (var f in S.checkFilters) {
      if (S.checkFilters[f].size > 0 && !S.checkFilters[f].has(r[f])) return false;
    }
    // side input filters (substring match)
    for (var fi in S.inputFilters) {
      var fv = S.inputFilters[fi];
      if (fv && !String(r[fi] || '').toLowerCase().includes(fv.toLowerCase())) return false;
    }
    // search bar
    if (S.searchValue) {
      var hay = String(r[S.searchField] || '').toLowerCase();
      if (!hay.includes(S.searchValue.toLowerCase())) return false;
    }
    return true;
  });
}

function getSorted(rows) {
  if (!S.sortCol) return rows;
  return rows.slice().sort(function(a, b) {
    var av = a[S.sortCol], bv = b[S.sortCol];
    if (av < bv) return S.sortDir === 'asc' ? -1 :  1;
    if (av > bv) return S.sortDir === 'asc' ?  1 : -1;
    return 0;
  });
}

// ═══════════════════════════════════════════════════
// RENDER — single entry point for all state changes
// ═══════════════════════════════════════════════════
function render() {
  var filtered = getFiltered();
  var sorted   = getSorted(filtered);
  var start    = (S.page - 1) * S.pageSize;
  var paged    = sorted.slice(start, start + S.pageSize);

  // 1. table body
  var tbody = document.getElementById('tableBody');
  tbody.innerHTML = paged.length === 0
    ? '<tr><td colspan="100" style="text-align:center;padding:32px;color:#888">No records match the current filters.</td></tr>'
    : paged.map(rowHtml).join('');

  // 2. pagination
  renderPagination(sorted.length);

  // 3. toolbar stats line (toolbar-top)
  var statsEl = document.getElementById('toolbarStats');
  if (statsEl) statsEl.textContent = sorted.length;

  // 4. top summary filter counts
  renderSummaryCounts();

  // 5. filter badge on Filter button
  var anyActive = Object.values(S.checkFilters).some(function(s) { return s.size > 0; })
               || Object.values(S.inputFilters).some(function(v) { return v; })
               || Object.values(S.dateFilters).some(function(v) { return v && (v.from || v.to); });
  var badge = document.getElementById('filterBadge');
  if (badge) {
    badge.style.display = anyActive ? 'inline-flex' : 'none';
    var totalActive = 0;
    Object.values(S.checkFilters).forEach(function(s){ totalActive += s.size; });
    badge.textContent = totalActive || '';
  }
}

function renderPagination(total) {
  var totalPages = Math.max(1, Math.ceil(total / S.pageSize));
  if (S.page > totalPages) S.page = totalPages;

  var el = document.getElementById('resultsCount');
  if (el) el.textContent = total + ' results found';

  var container = document.getElementById('pageButtons');
  if (!container) return;
  var html = '<button class="pg-btn" onclick="goToPage(' + (S.page-1) + ')">&#8249;</button>';
  var max = Math.min(totalPages, 6);
  for (var i = 1; i <= max; i++) {
    html += '<button class="pg-btn' + (i === S.page ? ' active' : '') + '" onclick="goToPage(' + i + ')">' + i + '</button>';
  }
  if (totalPages > 6) html += '<span style="padding:0 4px">…</span>'
    + '<button class="pg-btn" onclick="goToPage(' + totalPages + ')">' + totalPages + '</button>';
  html += '<button class="pg-btn" onclick="goToPage(' + (S.page+1) + ')">&#8250;</button>';
  container.innerHTML = html;
}

function renderSummaryCounts() {
  // count by status across ALL_ROWS (unfiltered by top-filter, but apply side filters)
  var sideFiltered = ALL_ROWS.filter(function(r) {
    for (var f in S.checkFilters) {
      if (S.checkFilters[f].size > 0 && !S.checkFilters[f].has(r[f])) return false;
    }
    return true;
  });
  var counts = { All: sideFiltered.length };
  sideFiltered.forEach(function(r) { counts[r.status] = (counts[r.status] || 0) + 1; });

  document.querySelectorAll('.summary-filter-btn[data-filter]').forEach(function(btn) {
    var lbl = btn.dataset.filter;
    var cnt = btn.querySelector('.summary-count');
    if (cnt) cnt.textContent = counts[lbl] || 0;
    btn.classList.toggle('active', S.topFilter === lbl);
  });
}

// ═══════════════════════════════════════════════════
// ZONE 2 — ROW TEMPLATE  (customise for the ticket's columns)
// Return a <tr> string for one data row.
// Use chip classes for status, priority-* for priority text.
// Wire each action button to its handler function below.
// ═══════════════════════════════════════════════════
function rowHtml(r) {
  var statusClass = {
    'In Progress': 'chip-inprogress', 'Created': 'chip-created',
    'Completed': 'chip-completed',    'Cancelled': 'chip-cancelled',
  }[r.status] || 'chip-created';

  return '<tr data-id="' + r.id + '">'
    + '<td><input type="checkbox"></td>'
    + '<td style="font-weight:600;color:var(--primary)">' + r.id + '</td>'
    + '<td><span class="chip ' + statusClass + '">' + r.status + '</span></td>'
    + '<td>' + r.type + '</td>'
    + (r.priority === 'Critical'
        ? '<td><span class="priority-critical">Critical</span></td>'
        : '<td><span class="priority-normal">' + r.priority + '</span></td>')
    + '<td>' + r.station + '</td>'
    + '<td>' + r.qty + '</td>'
    + '<td>' + r.pat + '</td>'
    + '<td>' + r.pbt + '</td>'
    + '<td class="td-actions"><span class="row-actions-cell">'
    +   '<button class="row-action-btn" title="View details" onclick="viewDetails(\'' + r.id + '\')">'
    +     '<span class="material-symbols-outlined">description</span></button>'
    +   (r.status !== 'Cancelled' && r.status !== 'Completed'
        ? '<button class="row-action-btn" title="Cancel" onclick="cancelRow(\'' + r.id + '\')">'
          + '<span class="material-symbols-outlined">cancel</span></button>'
        : '')
    +   (r.status === 'Created'
        ? '<button class="row-action-btn" title="Release" onclick="releaseRow(\'' + r.id + '\')">'
          + '<span class="material-symbols-outlined">play_arrow</span></button>'
        : '')
    + '</span></td>'
    + '</tr>';
}

// ═══════════════════════════════════════════════════
// INTERACTION HANDLERS
// ═══════════════════════════════════════════════════

// Top summary filter
function setTopFilter(label) { S.topFilter = label; S.page = 1; render(); }

// Column sort
function sortBy(col) {
  S.sortDir = (S.sortCol === col && S.sortDir === 'asc') ? 'desc' : 'asc';
  S.sortCol = col;
  document.querySelectorAll('[data-sort]').forEach(function(th) {
    var c = th.dataset.sort;
    th.querySelector && th.querySelectorAll('.sort-ico .up,.sort-ico .dn').forEach(function(span) {
      var isUp = span.classList.contains('up');
      span.classList.toggle('active', c === col && (isUp ? S.sortDir === 'asc' : S.sortDir === 'desc'));
    });
  });
  render();
}

// Pagination
function goToPage(n) {
  var total = Math.max(1, Math.ceil(getFiltered().length / S.pageSize));
  if (n < 1 || n > total) return;
  S.page = n; render();
}

// Rows-per-page
function setPageSize(n) { S.pageSize = parseInt(n); S.page = 1; render(); }

// Search bar
function onSearch() {
  S.searchValue = (document.getElementById('searchInput') || {}).value || '';
  S.searchField = (document.getElementById('searchField') || {}).value || S.searchField;
  S.page = 1; render();
}

// Side checkbox filter
function onCheckFilter(field, value, checked) {
  if (!S.checkFilters[field]) S.checkFilters[field] = new Set();
  if (checked) S.checkFilters[field].add(value);
  else S.checkFilters[field].delete(value);
  S.page = 1; render();
}

// Side input filter
function onInputFilter(field, value) {
  S.inputFilters[field] = value; S.page = 1; render();
}

// ═══════════════════════════════════════════════════
// ACTION BUTTON HANDLERS
// Implement every action from the JIRA ticket here.
// Each handler should: find the row in ALL_ROWS by id,
// mutate the relevant field(s), then call render().
// For destructive actions, confirm with the action modal first.
// ═══════════════════════════════════════════════════
function viewDetails(id) {
  var r = ALL_ROWS.find(function(x){ return x.id === id; });
  if (!r) return;
  document.getElementById('detailTitle').textContent = 'Order Details — ' + r.id;
  document.getElementById('detailBody').innerHTML =
    '<table style="width:100%;border-collapse:collapse;font-size:13px">'
    + Object.entries(r).map(function(kv) {
        return '<tr><td style="padding:6px 8px;font-weight:600;color:var(--dark);width:140px">'
          + kv[0] + '</td><td style="padding:6px 8px;color:var(--body-text)">' + kv[1] + '</td></tr>';
      }).join('')
    + '</table>';
  document.getElementById('detailPanel').style.display = 'flex';
}

function cancelRow(id) {
  openActionModal('Cancel Order', 'Are you sure you want to cancel order <strong>' + id + '</strong>?',
    function() {
      var r = ALL_ROWS.find(function(x){ return x.id === id; });
      if (r) r.status = 'Cancelled';
      render();
    });
}

function releaseRow(id) {
  openActionModal('Release Order', 'Release order <strong>' + id + '</strong> to picking?',
    function() {
      var r = ALL_ROWS.find(function(x){ return x.id === id; });
      if (r) r.status = 'In Progress';
      render();
    });
}

// Generic confirmation modal
var _pendingAction = null;
function openActionModal(title, body, onConfirm) {
  _pendingAction = onConfirm;
  document.getElementById('actionModalTitle').textContent = title;
  document.getElementById('actionModalBody').innerHTML = body;
  document.getElementById('actionModal').style.display = 'flex';
}
function confirmAction() {
  document.getElementById('actionModal').style.display = 'none';
  if (_pendingAction) { _pendingAction(); _pendingAction = null; }
}
function cancelAction() {
  document.getElementById('actionModal').style.display = 'none';
  _pendingAction = null;
}

// ═══════════════════════════════════════════════════
// FILTER PANEL CONTROLS
// Sidebar overlays .content-with-filters (full main view under navbar).
// ═══════════════════════════════════════════════════
function toggleFilterPanel() {
  var s = document.getElementById('filterSidebar');
  if (s) s.classList.toggle('open');
}
function closeFilterPanel() {
  var s = document.getElementById('filterSidebar');
  if (s) s.classList.remove('open');
}
function clearAllFilters() {
  Object.keys(S.checkFilters).forEach(function(f){ S.checkFilters[f].clear(); });
  S.inputFilters = {}; S.dateFilters = {}; S.page = 1;
  var panel = document.getElementById('filterSidebar');
  if (panel) {
    panel.querySelectorAll('input[type="checkbox"],input[type="radio"]').forEach(function(el){ el.checked = false; });
    panel.querySelectorAll('input[type="text"],input[type="number"],input[type="date"]').forEach(function(el){ el.value=''; });
  }
  render();
}
function toggleFilterGroup(hdr) {
  var body  = hdr.nextElementSibling;
  var arrow = hdr.querySelector('.filter-group-arrow');
  var open  = body && body.classList.contains('open');
  if (body)  body.classList.toggle('open', !open);
  if (arrow) arrow.classList.toggle('expanded', !open);
}

// ═══════════════════════════════════════════════════
// DETAIL PANEL
// ═══════════════════════════════════════════════════
function closeDetailPanel() {
  document.getElementById('detailPanel').style.display = 'none';
}

// ══════════════════
// BOOT
// ══════════════════
render();
</script>

<!-- Action confirmation modal (always present) -->
<div class="modal-backdrop" id="actionModal" style="display:none">
  <div class="modal-card">
    <div class="modal-hdr">
      <span class="modal-title" id="actionModalTitle">Confirm</span>
      <button class="modal-close" onclick="cancelAction()">&#215;</button>
    </div>
    <div class="modal-body" id="actionModalBody" style="font-size:14px;color:var(--body-text)"></div>
    <div class="modal-footer">
      <button class="modal-cancel-btn" onclick="cancelAction()">CANCEL</button>
      <button class="modal-proceed-btn" onclick="confirmAction()">PROCEED</button>
    </div>
  </div>
</div>

<!-- Detail side-panel (always present; shown on View Details) -->
<div id="detailPanel" style="display:none;position:fixed;inset:0;z-index:180;justify-content:flex-end">
  <div style="background:rgba(0,0,0,0.18);flex:1" onclick="closeDetailPanel()"></div>
  <div style="width:480px;background:#fff;box-shadow:-4px 0 20px rgba(0,0,0,0.14);display:flex;flex-direction:column">
    <div class="modal-hdr">
      <span class="modal-title" id="detailTitle">Details</span>
      <button class="modal-close" onclick="closeDetailPanel()">&#215;</button>
    </div>
    <div id="detailBody" style="flex:1;overflow-y:auto;padding:16px"></div>
  </div>
</div>
```

> **How to customise for a ticket:**
> 1. **ZONE 1** — Replace `ALL_ROWS` objects with the ticket's domain fields. Keep ≥15 rows with full value coverage.
> 2. **ZONE 2** — Rewrite `rowHtml(r)` to match the ticket's columns. Wire each action `<button>` to its handler.
> 3. **Filter groups** (in `filters-sidebar` SNIPPET) — Add `onchange="onCheckFilter('field','value',this.checked)"` to each checkbox. Add `oninput="onInputFilter('field',this.value)"` to INPUT filters.
> 4. **Action handlers** — Add one function per ticket action (approve, hold, reassign, etc.) following the `cancelRow`/`releaseRow` pattern.
> 5. **`data-sort` attributes** — Add `data-sort="fieldKey" onclick="sortBy('fieldKey')"` to every sortable `<th>`.
> 6. **Pagination wiring** — Use `id="pageButtons"` on the page-buttons container, `id="resultsCount"` on the count span, `onchange="setPageSize(this.value)"` on the rows-per-page select.
> 7. **Top summary buttons** — Add `data-filter="StatusLabel"` to every `.summary-filter-btn` and `onclick="setTopFilter(this.dataset.filter)"`.

---

### SNIPPET: filters-sidebar

```html
<!-- SNIPPET: filters-sidebar — Overlay drawer inside .content-with-filters (position:relative).
     Slides over the FULL main view under the navbar (toolbar + filter bar + table), not the table only.
     Height is bounded by .content-with-filters which fills the remaining viewport under chrome.
     REAL look sourced from FiltersSidebar.vue (v2) + screenshot analysis:
       - Header: light grey (#F5F5F5 = bg-grey-3), "Filters" bold dark text, chevron_left to close
       - Clear Filters: separate row below header, small orange outlined button (right-aligned)
       - Checkboxes: 2-column grid (min-width:50% per cell), size sm (14px), padding 4px
       - Labels too long for 2-col get class="full" (min-width:100%)
       - Filter group header: bold, padding 8px, white bg
       - Thin custom scrollbar (5px wide, #d3d3d3)
     ⚠ RULES:
       - Place .content-with-filters IMMEDIATELY after topbar + primary-nav (+ optional sub-nav / section-banner).
       - Put toolbar-top, filter-bar, top-summary-filters, AND table INSIDE .page-main (sibling of sidebar).
       - Show open by default: class="open" on .filters-sidebar.
       - All logic (clearAllFilters, toggleFilterGroup, onCheckFilter, onInputFilter, toggleFilterPanel)
         lives in data-table-engine SNIPPET — do NOT redefine those functions here.
       - Every checkbox: onchange="onCheckFilter('fieldKey','value',this.checked)"
       - Every INPUT:    oninput="onInputFilter('fieldKey',this.value)"
       - Replace field names/values with the ticket's actual domain. Use find-related-context results.
       - Add class="full" to .filter-check-cell when the label is too long for 2-col layout.

     PAGE LAYOUT (required — navbar ABOVE; everything else INSIDE the wrapper):
     [topbar]
     [primary-nav]
     [optional sub-nav / section-banner]
     <div class="content-with-filters">
       [filters-sidebar here — overlays full main view]
       <div class="page-main">
         [toolbar-top]
         [filter-bar]
         [optional top-summary-filters]
         <div class="table-section">
           <div class="card" style="overflow-x:auto"><table>…</table></div>
           [pagination-row here]
         </div>
       </div>
     </div>  -->

<div class="filters-sidebar open" id="filterSidebar">

  <!-- Header: light grey bg, "Filters" bold dark text, chevron_left close -->
  <div class="filters-sidebar-hdr">
    <span class="filters-sidebar-title">Filters</span>
    <button class="filters-sidebar-close" onclick="closeFilterPanel()" title="Close">
      <span class="material-symbols-outlined" style="font-size:18px">chevron_left</span>
    </button>
  </div>

  <!-- Clear Filters row — shown always; button triggers clearAllFilters() -->
  <div class="filters-clear-row">
    <button class="filters-clear-btn" onclick="clearAllFilters()">Clear Filters</button>
  </div>

  <div class="filters-sidebar-body">

    <!-- CHECKBOX group — Status (2-column grid) -->
    <div class="filter-group">
      <div class="filter-group-hdr" onclick="toggleFilterGroup(this)">
        <span class="filter-group-label">Order Status</span>
        <span class="material-symbols-outlined filter-group-arrow expanded">expand_more</span>
      </div>
      <div class="filter-group-body open">
        <div class="filter-check-grid">
          <label class="filter-check-cell">
            <input type="checkbox" onchange="onCheckFilter('status','Created',this.checked)"> Created
          </label>
          <label class="filter-check-cell">
            <input type="checkbox" onchange="onCheckFilter('status','Completed',this.checked)"> Completed
          </label>
          <label class="filter-check-cell full">
            <input type="checkbox" onchange="onCheckFilter('status','Staging In Progress',this.checked)"> Staging In Progress
          </label>
          <label class="filter-check-cell">
            <input type="checkbox" onchange="onCheckFilter('status','In Progress',this.checked)"> In Progress
          </label>
          <label class="filter-check-cell">
            <input type="checkbox" onchange="onCheckFilter('status','Cancelled',this.checked)"> Cancelled
          </label>
        </div>
      </div>
    </div>

    <!-- CHECKBOX group — Type (2-column grid) -->
    <div class="filter-group">
      <div class="filter-group-hdr" onclick="toggleFilterGroup(this)">
        <span class="filter-group-label">Order Type</span>
        <span class="material-symbols-outlined filter-group-arrow expanded">expand_more</span>
      </div>
      <div class="filter-group-body open">
        <div class="filter-check-grid">
          <label class="filter-check-cell">
            <input type="checkbox" onchange="onCheckFilter('type','B2B',this.checked)"> B2B
          </label>
          <label class="filter-check-cell">
            <input type="checkbox" onchange="onCheckFilter('type','B2C',this.checked)"> B2C
          </label>
          <label class="filter-check-cell full">
            <input type="checkbox" onchange="onCheckFilter('type','Multi-Channel',this.checked)"> Multi-Channel
          </label>
        </div>
      </div>
    </div>

    <!-- CHECKBOX group — Priority (2-column grid) -->
    <div class="filter-group">
      <div class="filter-group-hdr" onclick="toggleFilterGroup(this)">
        <span class="filter-group-label">Priority</span>
        <span class="material-symbols-outlined filter-group-arrow">expand_more</span>
      </div>
      <div class="filter-group-body">
        <div class="filter-check-grid">
          <label class="filter-check-cell">
            <input type="checkbox" onchange="onCheckFilter('priority','Critical',this.checked)"> Critical
          </label>
          <label class="filter-check-cell">
            <input type="checkbox" onchange="onCheckFilter('priority','High',this.checked)"> High
          </label>
          <label class="filter-check-cell">
            <input type="checkbox" onchange="onCheckFilter('priority','Normal',this.checked)"> Normal
          </label>
        </div>
      </div>
    </div>

    <!-- INPUT group — numeric (full width) -->
    <div class="filter-group">
      <div class="filter-group-hdr" onclick="toggleFilterGroup(this)">
        <span class="filter-group-label">Order Quantity</span>
        <span class="material-symbols-outlined filter-group-arrow">expand_more</span>
      </div>
      <div class="filter-group-body">
        <input type="number" class="filter-sidebar-input" placeholder="Enter quantity"
               oninput="onInputFilter('qty',this.value)">
      </div>
    </div>

    <!-- DATE_TIME_RANGE group -->
    <div class="filter-group">
      <div class="filter-group-hdr" onclick="toggleFilterGroup(this)">
        <span class="filter-group-label">Created Date &amp; Time</span>
        <span class="material-symbols-outlined filter-group-arrow">expand_more</span>
      </div>
      <div class="filter-group-body">
        <div class="filter-date-pair">
          <input type="date" placeholder="From">
          <input type="date" placeholder="To">
        </div>
      </div>
    </div>

  </div><!-- /filters-sidebar-body -->
</div><!-- /filters-sidebar -->
```

---

### SNIPPET: table-header

```html
<!-- SNIPPET: table-header — REAL outbound v2 order-list columns.
     Col 1 = select+expand (sticky 75px), Col 2 = Order Info (sticky). Sort triangles on sortable cols.
     ⚠ WORKING SORT: every sortable <th> needs data-sort="fieldKey" + onclick="sortBy('fieldKey')".
        The sort triangle active class is managed by sortBy() from data-table-engine.
     NOTE: when find-related-context returns the real :columns array for THIS ticket, use THOSE labels
     instead of these outbound defaults. -->
<thead>
  <tr>
    <th class="th-select-expand"><input type="checkbox"></th>
    <th data-sort="id" onclick="sortBy('id')" style="cursor:pointer">
      Order Info
      <span class="sort-ico"><span class="up"></span><span class="dn"></span></span>
    </th>
    <th>Status</th>
    <th>Station Info</th>
    <th data-sort="priority" onclick="sortBy('priority')" style="cursor:pointer">
      Priority
      <span class="sort-ico"><span class="up"></span><span class="dn"></span></span>
    </th>
    <th data-sort="pat" onclick="sortBy('pat')" style="cursor:pointer">
      PAT
      <span class="sort-ico"><span class="up"></span><span class="dn"></span></span>
    </th>
    <th data-sort="pbt" onclick="sortBy('pbt')" style="cursor:pointer">
      PBT
      <span class="sort-ico"><span class="up"></span><span class="dn"></span></span>
    </th>
    <th>Order Type</th>
    <th data-sort="qty" onclick="sortBy('qty')" style="cursor:pointer">
      Qty
      <span class="sort-ico"><span class="up"></span><span class="dn"></span></span>
    </th>
    <th class="th-actions">Action</th>
  </tr>
</thead>
```

---

### SNIPPET: table-row

```html
<!-- SNIPPET: table-row — REAL outbound v2 row. Col 1 = checkbox + expand arrow together.
     Status cell = chip + small progress label. Actions = flat round Material-icon buttons.
     ⚠ PRIORITY RULE: Priority is NEVER a chip. Always plain <span> text.
       Critical → <span class="priority-critical">Critical</span>  (red text, NO background)
       Normal   → <span class="priority-normal">Normal</span>       (plain text)
     Using .chip-critical or any chip/badge for priority causes left-side text clipping. -->
<tr>
  <td class="td-select-expand">
    <span class="select-expand-wrap">
      <input type="checkbox">
      <button class="expand-btn" onclick="toggleExpand(this)" title="Expand">
        <span class="material-symbols-outlined">keyboard_arrow_right</span>
      </button>
    </span>
  </td>
  <td style="font-weight:600; color:var(--primary)">ORD-00124</td>
  <td>
    <span class="status-cell">
      <span class="chip chip-completed">Completed</span>
      <span class="status-progress">12/12</span>
    </span>
  </td>
  <td>PPS-07</td>
  <!-- Priority: plain text, never a chip -->
  <td><span class="priority-critical">Critical</span></td>
  <td>14:32</td>
  <td>18:00</td>
  <td>B2C</td>
  <td>SHIP-7821</td>
  <td class="td-actions">
    <span class="row-actions-cell">
      <button class="row-action-btn" title="View details">
        <span class="material-symbols-outlined">description</span>
      </button>
      <button class="row-action-btn" title="Change priority">
        <span class="material-symbols-outlined">swap_vert</span>
      </button>
      <button class="row-action-btn" title="Hold order">
        <span class="material-symbols-outlined">pause</span>
      </button>
      <button class="row-action-btn" title="Cancel order">
        <span class="material-symbols-outlined">cancel</span>
      </button>
    </span>
  </td>
</tr>
```

---

### SNIPPET: expandable-parent-row

```html
<!-- SNIPPET: expandable-parent-row — REAL pattern. Parent row gets .row-expanded (bg #FFF6ED) when open;
     child row .expanded-td (bg #FFFCF8) holds a sub-orders / order-lines nested table.
     JS toggles the arrow icon (keyboard_arrow_right ⇄ keyboard_arrow_down) and the classes. -->
<tr class="row-expanded" data-id="ORD-00125">
  <td class="td-select-expand">
    <span class="select-expand-wrap">
      <input type="checkbox">
      <button class="expand-btn expanded" onclick="toggleExpand(this)" title="Collapse">
        <span class="material-symbols-outlined">keyboard_arrow_down</span>
      </button>
    </span>
  </td>
  <td style="font-weight:600; color:var(--primary)">ORD-00125</td>
  <td>
    <span class="status-cell">
      <span class="chip chip-inprogress">In Progress</span>
      <span class="status-progress">5/12</span>
    </span>
  </td>
  <td>PPS-03</td>
  <td>High</td>
  <td>13:10</td>
  <td>17:30</td>
  <td>B2B</td>
  <td>SHIP-4412</td>
  <td class="td-actions">
    <span class="row-actions-cell">
      <button class="row-action-btn" title="View details"><span class="material-symbols-outlined">description</span></button>
      <button class="row-action-btn" title="Hold order"><span class="material-symbols-outlined">pause</span></button>
    </span>
  </td>
</tr>
<!-- expanded child row — nested detail with Sub-Orders / Order Lines tabs (REAL OrderListDetail) -->
<tr class="child-row">
  <td class="expanded-td" colspan="10">
    <div class="sub-nav" style="border-bottom:1px solid var(--border); padding-left:0">
      <a class="sub-tab active" href="#">Sub-Orders</a>
      <a class="sub-tab" href="#">Order Lines</a>
    </div>
    <table class="expanded-table" style="width:100%; border-collapse:collapse; font-size:13px">
      <thead>
        <tr>
          <th style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border); text-align:left">Sub-Order ID</th>
          <th style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border); text-align:left">Status</th>
          <th style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border); text-align:left">SKU ID</th>
          <th style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border); text-align:left">UOM</th>
          <th style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border); text-align:left">Action</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border)">SUB-001</td>
          <td style="padding:8px; border-bottom:1px solid var(--border)"><span class="chip chip-completed">Completed</span></td>
          <td style="padding:8px; color:var(--info); font-weight:600; border-bottom:1px solid var(--border)">SKU-4412-A</td>
          <td style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border)">EA</td>
          <td style="padding:8px; border-bottom:1px solid var(--border)">
            <button class="row-action-btn" title="View details"><span class="material-symbols-outlined">description</span></button>
          </td>
        </tr>
        <tr>
          <td style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border)">SUB-002</td>
          <td style="padding:8px; border-bottom:1px solid var(--border)"><span class="chip chip-inprogress">In Progress</span></td>
          <td style="padding:8px; color:var(--info); font-weight:600; border-bottom:1px solid var(--border)">SKU-4412-B</td>
          <td style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border)">EA</td>
          <td style="padding:8px; border-bottom:1px solid var(--border)">
            <button class="row-action-btn" title="View details"><span class="material-symbols-outlined">description</span></button>
          </td>
        </tr>
      </tbody>
    </table>
  </td>
</tr>
<script>
function toggleExpand(btn) {
  var parentRow = btn.closest('tr');
  var childRow = parentRow.nextElementSibling;
  var icon = btn.querySelector('.material-symbols-outlined');
  var willExpand = !parentRow.classList.contains('row-expanded');
  parentRow.classList.toggle('row-expanded', willExpand);
  btn.classList.toggle('expanded', willExpand);
  if (icon) icon.textContent = willExpand ? 'keyboard_arrow_down' : 'keyboard_arrow_right';
  if (childRow && childRow.classList.contains('child-row')) {
    childRow.style.display = willExpand ? 'table-row' : 'none';
  }
}
</script>
```

---

### SNIPPET: expanded-child-row

```html
<!-- SNIPPET: expanded-child-row — standalone child row (use inside expandable-parent-row context).
     colspan must equal the parent table's column count. Headers #4D5055, cells #4D5055 weight 600. -->
<tr class="child-row">
  <td class="expanded-td" colspan="10">
    <!-- Replace inner content with ticket-specific nested table or detail panel -->
    <table class="expanded-table" style="width:100%; border-collapse:collapse; font-size:13px">
      <thead>
        <tr>
          <th style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border); text-align:left">Field 1</th>
          <th style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border); text-align:left">Field 2</th>
          <th style="padding:8px; color:#4D5055; font-weight:600; border-bottom:1px solid var(--border); text-align:left">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:8px; color:#4D5055; font-weight:600">Value A</td>
          <td style="padding:8px; color:#4D5055; font-weight:600">Value B</td>
          <td style="padding:8px"><span class="chip chip-active">Active</span></td>
        </tr>
      </tbody>
    </table>
  </td>
</tr>
```

---

### SNIPPET: status-chips

```html
<!-- SNIPPET: status-chips — real status buckets from STATUS_COLOR_MAP; text #4D5055 except chip-critical.
     For ORDER/ENTITY STATUS only. Pick the class whose bucket matches the ticket's status string:
       GREEN  #ebf5e8 → Completed, Released, Completed - Short Picked
       AMBER  #ffeedc → In Progress (+ Staging/Picking/Put/Cancellation/On Hold/Staged Failed)
       RED    #ffd8d7 → Cancelled, Unfulfillable, Abandoned, Failed
       GREY   #ececec → Created (and Closed / N/A)
     ⚠ chip-critical is for error/failed STATUS only (e.g., system critical alert status).
       For PRIORITY "Critical" use .priority-critical (plain red text, NO chip background). -->
<div style="display:flex; flex-wrap:wrap; gap:8px; padding:8px">
  <span class="chip chip-completed">Completed</span>
  <span class="chip chip-released">Released</span>
  <span class="chip chip-created">Created</span>
  <span class="chip chip-inprogress">In Progress</span>
  <span class="chip chip-staging">Staging In Progress</span>
  <span class="chip chip-onhold">On Hold - Pending Inventory</span>
  <span class="chip chip-cancelled">Cancelled</span>
  <span class="chip chip-unfulfillable">Unfulfillable</span>
  <span class="chip chip-failed">Failed</span>
  <span class="chip chip-abandoned">Abandoned</span>
</div>
<!-- Priority display (NOT a chip): -->
<div style="display:flex; gap:12px; padding:8px; align-items:center;">
  <span class="priority-critical">Critical</span>  <!-- red text, no background -->
  <span class="priority-normal">Normal</span>        <!-- plain text -->
</div>
```

---

### SNIPPET: action-buttons

```html
<!-- SNIPPET: action-buttons — REAL outbound row actions: flat round Material-icon buttons (primary, no border).
     Pick icons matching the ticket's available actions. Common outbound actions + icons:
       view details = description · cancel = cancel · change PBT = history · change PAT = update
       change priority = swap_vert · hold = pause · unhold = play_arrow · force release = flash_on -->
<div class="td-actions">
  <span class="row-actions-cell">
    <button class="row-action-btn" title="View details"><span class="material-symbols-outlined">description</span></button>
    <button class="row-action-btn" title="Change priority"><span class="material-symbols-outlined">swap_vert</span></button>
    <button class="row-action-btn" title="Hold order"><span class="material-symbols-outlined">pause</span></button>
    <span class="row-actions-sep"></span>
    <button class="row-action-btn" title="Cancel order"><span class="material-symbols-outlined">cancel</span></button>
  </span>
</div>
```

---

### SNIPPET: pagination-row

```html
<!-- SNIPPET: pagination-row — REAL outbound bottom bar: results-found (left), Results per page + page buttons (right).
     ⚠ WORKING PAGINATION: use id="resultsCount", id="pageButtons", onchange="setPageSize(this.value)".
        renderPagination() from data-table-engine rebuilds page buttons dynamically every render(). -->
<div class="custom-pagination">
  <span class="text-custom-grey" style="font-weight:600" id="resultsCount">20 results found</span>
  <div class="pg-spacer"></div>
  <span class="pagination-label">Results per page:</span>
  <select class="pg-rows-select" onchange="setPageSize(this.value)">
    <option value="10">10</option>
    <option value="25">25</option>
    <option value="50">50</option>
    <option value="100">100</option>
  </select>
  <!-- page buttons injected here by renderPagination() -->
  <span id="pageButtons" style="display:contents"></span>
</div>
```

---

### SNIPPET: modal

```html
<!-- SNIPPET: modal — navy header, white body, CANCEL + PROCEED footer, backdrop rgba(16,26,92,0.38) -->
<div class="modal-backdrop" id="modal" style="display:none">
  <div class="modal-card">
    <div class="modal-hdr">
      <span class="modal-title">Confirm Action</span>
      <button class="modal-close" onclick="document.getElementById('modal').style.display='none'">&#215;</button>
    </div>
    <div class="modal-body">
      <!-- Modal content here — use .radio-row for radio options -->
      <p style="font-size:14px; color:var(--body-text); margin-bottom:12px">
        Please confirm the following action. This cannot be undone.
      </p>
      <!-- Example radio options as bordered rows -->
      <label class="radio-row selected">
        <input type="radio" name="modal-opt" checked style="margin-right:8px">
        <span style="font-size:13px; color:var(--body-text)">Option A — Recommended</span>
      </label>
      <label class="radio-row">
        <input type="radio" name="modal-opt" style="margin-right:8px">
        <span style="font-size:13px; color:var(--body-text)">Option B — Alternative</span>
      </label>
    </div>
    <div class="modal-footer">
      <button class="modal-cancel-btn" onclick="document.getElementById('modal').style.display='none'">CANCEL</button>
      <button class="modal-proceed-btn">PROCEED</button>
    </div>
  </div>
</div>
<!-- Trigger: <button onclick="document.getElementById('modal').style.display='flex'">Open Modal</button> -->
```

---

*End of component-library.md*
