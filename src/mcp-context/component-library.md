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
  border-radius: 3px; cursor: pointer;
}
.smaller-input {
  height: 35px;
  border: 1px solid var(--border);  /* #E7E7E7 — NOT #d4d3d3 */
  border-radius: 3px;
  padding: 0 10px;
  font-size: 13px;
  color: var(--body-text);
  background: #fff;
  outline: none;
  min-width: 180px;
}
.smaller-input:focus { border-color: var(--secondary); }
.smaller-input::placeholder { color: #aaa; }
.custom-dropdown {
  height: 35px;
  min-width: 130px;
  border: 1px solid var(--border);  /* #E7E7E7 — NOT #d4d3d3 */
  border-radius: 3px;
  padding: 0 28px 0 10px;
  font-size: 13px;
  color: var(--body-text);
  background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23636f83'/%3E%3C/svg%3E") no-repeat right 10px center;
  -webkit-appearance: none; appearance: none;
  outline: none; cursor: pointer;
}
.custom-dropdown:focus { border-color: var(--secondary); }
.filter-spacer { flex: 1; }
.filter-action-btn {
  height: 35px; padding: 0 14px;
  border: 1px solid var(--border);
  background: #fff; border-radius: 3px;
  font-size: 13px; color: var(--primary); font-weight: 600;
  cursor: pointer;
}
.filter-action-btn.primary-action {
  background: var(--primary); color: #fff; border-color: var(--primary);
}
.filter-refresh-btn {
  width: 35px; height: 35px;
  border: 1px solid var(--border); background: #fff; border-radius: 3px;
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
  color: var(--dark);        /* #636f83 */
  font-size: 13px; font-weight: 600;
  height: 38px;
  padding: 0 12px;
  text-align: left;
  border-bottom: 1px solid var(--border);
  border-right: 0.5px solid lightgrey;
  white-space: nowrap;
  position: sticky; top: 56px; z-index: 10;
}
.md-v2-table thead th:last-child { border-right: none; }
.md-v2-table tbody td {
  padding: 0 12px;
  height: 40px;
  font-size: 13px;
  color: var(--body-text);   /* #4D5055 — NOT --primary */
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

/* Checkbox */
.th-check, .td-check { width: 40px; text-align: center; padding: 0 8px; }
.th-check input, .td-check input { cursor: pointer; }

/* Actions column */
.th-actions { width: 80px; text-align: center; }
.td-actions { text-align: center; }

/* --- EXPANDABLE ROWS --- */
.row-expanded td { background: #FFF6ED; }
.expanded-td     { background: #FFFCF8; padding: 12px 16px !important; height: auto !important; }
.expand-btn {
  width: 20px; height: 20px; border: none; background: none;
  cursor: pointer; font-size: 11px; color: var(--primary);
  display: inline-flex; align-items: center; justify-content: center;
}

/* --- STATUS CHIPS --- */
.chip {
  display: inline-flex; align-items: center;
  height: 20px; border-radius: 10px;
  padding: 0 8px;
  font-size: 12px; font-weight: 600;
  color: #4D5055;                 /* NOT white — use #4D5055 */
  white-space: nowrap;
}
.chip-completed, .chip-active, .chip-open      { background: #ebf5e8; }
.chip-created,   .chip-inprogress              { background: #e8f4fb; }
.chip-pending                                   { background: #fef9e7; }
.chip-offline,   .chip-failed                  { background: #ffd8d7; }
.chip-cancelled, .chip-closed                  { background: #f0f0f0; }
.chip-breached                                  { background: #fdecea; }
.chip-critical { background: #ED3324; color: #FFFFFF; } /* exception: white text */
.chip-na       { background: #f0f0f0; }

/* --- ACTION BUTTONS --- */
.act-btn {
  width: 26px; height: 26px;  /* 26×26 — not 28×28 */
  border: 1px solid var(--light-grey);
  border-radius: 3px;
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
  height: 30px; border: 1px solid var(--border); border-radius: 3px;
  padding: 0 6px; font-size: 12px; color: var(--body-text);
  background: #fff; cursor: pointer;
}
.pg-btn {
  min-width: 30px; height: 30px;
  border: 1px solid var(--border); border-radius: 3px;
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
  border: 1px solid var(--border); background: #fff; border-radius: 3px;
  font-size: 13px; font-weight: 600; color: var(--dark); cursor: pointer;
}
.modal-proceed-btn {
  height: 36px; padding: 0 20px;
  border: none; background: var(--primary); border-radius: 3px;
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
  border: 1px solid var(--border); border-radius: 3px;
  padding: 0 10px; font-size: 13px; color: var(--body-text);
  background: #fff; outline: none;
}
.form-input:focus { border-color: var(--secondary); }
.radio-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px;
  border: 1px solid var(--border); border-radius: 3px;
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

### SNIPPET: filter-bar

```html
<!-- SNIPPET: filter-bar — toggle, search, dropdowns, spacer, action buttons -->
<div class="filter-bar">
  <button class="filter-toggle-btn">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
    Filter
  </button>
  <input type="text" class="smaller-input" placeholder="Search by Order ID, SKU…">
  <select class="custom-dropdown">
    <option value="">Status: All</option>
    <option>Completed</option>
    <option>In Progress</option>
    <option>Pending</option>
    <option>Failed</option>
  </select>
  <select class="custom-dropdown">
    <option value="">Zone: All</option>
    <option>Zone A</option>
    <option>Zone B</option>
    <option>Zone C</option>
  </select>
  <div class="filter-spacer"></div>
  <button class="filter-action-btn">Save Filter</button>
  <button class="filter-action-btn">Export</button>
  <button class="filter-refresh-btn" title="Refresh">&#8635;</button>
</div>
```

---

### SNIPPET: table-header

```html
<!-- SNIPPET: table-header — <thead> with checkbox, 5 data cols, actions; CSS sort triangles -->
<thead>
  <tr>
    <th class="th-check"><input type="checkbox"></th>
    <th>
      Order ID
      <span class="sort-ico"><span class="up active"></span><span class="dn"></span></span>
    </th>
    <th>
      SKU / Item
      <span class="sort-ico"><span class="up"></span><span class="dn"></span></span>
    </th>
    <th>
      Zone
      <span class="sort-ico"><span class="up"></span><span class="dn"></span></span>
    </th>
    <th>
      Status
      <span class="sort-ico"><span class="up"></span><span class="dn"></span></span>
    </th>
    <th>
      Updated At
      <span class="sort-ico"><span class="up"></span><span class="dn"></span></span>
    </th>
    <th class="th-actions">Actions</th>
  </tr>
</thead>
```

---

### SNIPPET: table-row

```html
<!-- SNIPPET: table-row — standard data row, body text uses var(--body-text) = #4D5055 -->
<tr>
  <td class="td-check"><input type="checkbox"></td>
  <td style="font-weight:600; color:var(--primary)">ORD-00124</td>
  <td>SKU-7821 — Widget A</td>
  <td>Zone B</td>
  <td><span class="chip chip-completed">Completed</span></td>
  <td>2024-01-15 14:32</td>
  <td class="td-actions">
    <button class="act-btn" title="View detail">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
    <button class="act-btn" title="Edit">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
    <button class="act-btn" title="Delete" style="color:#ED3324">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4h6v2"/>
      </svg>
    </button>
  </td>
</tr>
```

---

### SNIPPET: expandable-parent-row

```html
<!-- SNIPPET: expandable-parent-row — row-expanded bg #FFF6ED, toggle arrow -->
<!-- JS: toggle 'row-expanded' on parent tr; show/hide child tr with class 'child-row' -->
<tr class="row-expanded" data-id="ORD-00125">
  <td class="td-check"><input type="checkbox"></td>
  <td>
    <button class="expand-btn" onclick="toggleExpand(this)" title="Expand">&#9654;</button>
    <span style="font-weight:600; color:var(--primary); margin-left:4px">ORD-00125</span>
  </td>
  <td>SKU-4412 — Widget B (3 sub-orders)</td>
  <td>Zone A</td>
  <td><span class="chip chip-inprogress">In Progress</span></td>
  <td>2024-01-15 13:10</td>
  <td class="td-actions">
    <button class="act-btn" title="View detail">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </button>
  </td>
</tr>
<!-- SNIPPET: expanded-child-row — expanded-td bg #FFFCF8 -->
<tr class="child-row" style="display:none">
  <td class="expanded-td" colspan="7">
    <!-- Nested table for sub-orders -->
    <table style="width:100%; border-collapse:collapse; font-size:12px">
      <thead>
        <tr>
          <th style="padding:6px 12px; color:var(--dark); font-weight:600; border-bottom:1px solid var(--border); text-align:left">Sub-Order ID</th>
          <th style="padding:6px 12px; color:var(--dark); font-weight:600; border-bottom:1px solid var(--border); text-align:left">SKU</th>
          <th style="padding:6px 12px; color:var(--dark); font-weight:600; border-bottom:1px solid var(--border); text-align:left">Qty</th>
          <th style="padding:6px 12px; color:var(--dark); font-weight:600; border-bottom:1px solid var(--border); text-align:left">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 12px; color:var(--body-text); border-bottom:1px solid var(--border)">SUB-001</td>
          <td style="padding:6px 12px; color:var(--body-text); border-bottom:1px solid var(--border)">SKU-4412-A</td>
          <td style="padding:6px 12px; color:var(--body-text); border-bottom:1px solid var(--border)">12</td>
          <td style="padding:6px 12px; border-bottom:1px solid var(--border)"><span class="chip chip-completed">Completed</span></td>
        </tr>
        <tr>
          <td style="padding:6px 12px; color:var(--body-text); border-bottom:1px solid var(--border)">SUB-002</td>
          <td style="padding:6px 12px; color:var(--body-text); border-bottom:1px solid var(--border)">SKU-4412-B</td>
          <td style="padding:6px 12px; color:var(--body-text); border-bottom:1px solid var(--border)">8</td>
          <td style="padding:6px 12px; border-bottom:1px solid var(--border)"><span class="chip chip-pending">Pending</span></td>
        </tr>
      </tbody>
    </table>
  </td>
</tr>
<script>
function toggleExpand(btn) {
  var parentRow = btn.closest('tr');
  var childRow = parentRow.nextElementSibling;
  var expanded = childRow.style.display !== 'none';
  childRow.style.display = expanded ? 'none' : 'table-row';
  btn.innerHTML = expanded ? '&#9654;' : '&#9660;';
  if (!expanded) { parentRow.classList.add('row-expanded'); }
  else { parentRow.classList.remove('row-expanded'); }
}
</script>
```

---

### SNIPPET: expanded-child-row

```html
<!-- SNIPPET: expanded-child-row — standalone child row (use inside expandable-parent-row context) -->
<tr class="child-row">
  <td class="expanded-td" colspan="7">
    <!-- Replace inner content with ticket-specific nested table or detail panel -->
    <table style="width:100%; border-collapse:collapse; font-size:12px">
      <thead>
        <tr>
          <th style="padding:6px 12px; color:var(--dark); font-weight:600; border-bottom:1px solid var(--border); text-align:left">Field 1</th>
          <th style="padding:6px 12px; color:var(--dark); font-weight:600; border-bottom:1px solid var(--border); text-align:left">Field 2</th>
          <th style="padding:6px 12px; color:var(--dark); font-weight:600; border-bottom:1px solid var(--border); text-align:left">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 12px; color:var(--body-text)">Value A</td>
          <td style="padding:6px 12px; color:var(--body-text)">Value B</td>
          <td style="padding:6px 12px"><span class="chip chip-active">Active</span></td>
        </tr>
      </tbody>
    </table>
  </td>
</tr>
```

---

### SNIPPET: status-chips

```html
<!-- SNIPPET: status-chips — all chip variants for reference; text is #4D5055 except chip-critical -->
<div style="display:flex; flex-wrap:wrap; gap:8px; padding:8px">
  <span class="chip chip-completed">Completed</span>
  <span class="chip chip-active">Active</span>
  <span class="chip chip-open">Open</span>
  <span class="chip chip-created">Created</span>
  <span class="chip chip-inprogress">In Progress</span>
  <span class="chip chip-pending">Pending</span>
  <span class="chip chip-offline">Offline</span>
  <span class="chip chip-failed">Failed</span>
  <span class="chip chip-cancelled">Cancelled</span>
  <span class="chip chip-closed">Closed</span>
  <span class="chip chip-breached">Breached</span>
  <span class="chip chip-critical">Critical</span>
  <span class="chip chip-na">N/A</span>
</div>
```

---

### SNIPPET: action-buttons

```html
<!-- SNIPPET: action-buttons — 3 standard 26×26px act-btn buttons -->
<div class="td-actions">
  <!-- View detail -->
  <button class="act-btn" title="View detail">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  </button>
  <!-- Edit -->
  <button class="act-btn" title="Edit">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  </button>
  <!-- Delete -->
  <button class="act-btn" title="Delete" style="color:#ED3324">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4h6v2"/>
    </svg>
  </button>
</div>
```

---

### SNIPPET: pagination-row

```html
<!-- SNIPPET: pagination-row — rows-per-page, < numbered pages … N > -->
<div class="custom-pagination">
  <span class="pagination-label">Rows per page:</span>
  <select class="pg-rows-select">
    <option>10</option>
    <option>25</option>
    <option>50</option>
    <option>100</option>
  </select>
  <div class="pg-spacer"></div>
  <span class="pagination-label">1 – 10 of 184</span>
  <button class="pg-btn">&#8249;</button><!-- < -->
  <button class="pg-btn active">1</button>
  <button class="pg-btn">2</button>
  <button class="pg-btn">3</button>
  <span style="padding:0 4px; color:var(--dark)">…</span>
  <button class="pg-btn">19</button>
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
