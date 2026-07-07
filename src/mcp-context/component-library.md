# Manager Dashboard — Component Library

This file contains two sections:

1. **BASE CSS BLOCK** — copy this verbatim into every mockup's `<style>` tag. Do not modify or re-derive.
2. **SNIPPETS** — named HTML fragments. Find the matching slug and use it as-is; only add ticket-specific column widths or data values.

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
- The `<head>` MUST include these CDN links (the real app self-hosts Source Sans Pro + uses Material Symbols icons):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet">
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

body {
  font-family: 'Source Sans Pro', 'DINNextLTPro-Regular', Arial, sans-serif;
  font-size: 14px;
  background: var(--page-bg);
  color: var(--body-text);
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
.topbar-logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
.topbar-wordmark { font-size: 13px; font-weight: 700; color: var(--primary); letter-spacing: 0.02em; }
.topbar-product { font-size: 11px; color: var(--dark); letter-spacing: 0.04em; }
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
/* CRITICAL — only true destructive/critical (solid red, white text) */
.chip-critical { background: #ED3324; color: #FFFFFF; }

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
  <a class="topbar-logo" href="#">
    <!-- GreyOrange G-mark (orange) -->
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#FE8400"/>
      <path d="M12 6v6l4 2-1 1.8L11 14V6h1z" fill="#FE8400"/>
    </svg>
    <span class="topbar-wordmark">GreyOrange</span>
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
  <!-- Filter button: no record count here — only the filter pill -->
  <button class="filter-toggle-btn" style="position:relative">
    <span class="material-symbols-outlined" style="font-size:18px">filter_list</span>
    Filter
    <!-- Badge only when filters are applied: -->
    <span style="display:inline-flex; align-items:center; justify-content:center; height:16px; min-width:18px; padding:0 4px; margin-left:4px; background:#ffe0b2; color:#4D5055; font-size:11px; font-weight:600; border-radius:8px">2</span>
  </button>

  <!-- Segmented search: field dropdown joined to search input -->
  <select class="custom-dropdown" aria-label="Search field">
    <option>Order ID</option>
    <option>SKU ID</option>
    <option>Route ID</option>
    <option>Shipping ID</option>
  </select>
  <input type="text" class="smaller-input smaller-input-joined" placeholder="Search...">

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

### SNIPPET: table-header

```html
<!-- SNIPPET: table-header — REAL outbound v2 order-list columns.
     Col 1 = select+expand (sticky 75px), Col 2 = Order Info (sticky). Sort triangles on sortable cols.
     NOTE: when find-related-context returns the real :columns array for THIS ticket, use THOSE labels
     instead of these outbound defaults. -->
<thead>
  <tr>
    <th class="th-select-expand"><input type="checkbox"></th>
    <th>Order Info</th>
    <th>Status</th>
    <th>Station Info</th>
    <th>Priority
      <span class="sort-ico"><span class="up active"></span><span class="dn"></span></span>
    </th>
    <th>PAT
      <span class="sort-ico"><span class="up"></span><span class="dn"></span></span>
    </th>
    <th>PBT
      <span class="sort-ico"><span class="up"></span><span class="dn"></span></span>
    </th>
    <th>Order Type</th>
    <th>Shipping ID</th>
    <th class="th-actions">Action</th>
  </tr>
</thead>
```

---

### SNIPPET: table-row

```html
<!-- SNIPPET: table-row — REAL outbound v2 row. Col 1 = checkbox + expand arrow together.
     Status cell = chip + small progress label. Actions = flat round Material-icon buttons. -->
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
  <td>High</td>
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
     Pick the class whose bucket matches the ticket's status string:
       GREEN  #ebf5e8 → Completed, Released, Completed - Short Picked
       AMBER  #ffeedc → In Progress (+ Staging/Picking/Put/Cancellation/On Hold/Staged Failed)
       RED    #ffd8d7 → Cancelled, Unfulfillable, Abandoned, Failed
       GREY   #ececec → Created (and Closed / N/A) -->
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
  <span class="chip chip-critical">Critical</span>
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
<!-- SNIPPET: pagination-row — REAL outbound bottom bar: results-found (left), Results per page [50/100/200]
     + page buttons (right). Bottom bar border-top #e0e0e0, max 6 page buttons, active = secondary. -->
<div class="custom-pagination">
  <span class="text-custom-grey" style="font-weight:600">184 results found</span>
  <div class="pg-spacer"></div>
  <span class="pagination-label">Results per page:</span>
  <select class="pg-rows-select">
    <option>50</option>
    <option>100</option>
    <option>200</option>
  </select>
  <button class="pg-btn">&#8249;</button><!-- < -->
  <button class="pg-btn active">1</button>
  <button class="pg-btn">2</button>
  <button class="pg-btn">3</button>
  <button class="pg-btn">4</button>
  <button class="pg-btn">&#8250;</button><!-- > -->
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
