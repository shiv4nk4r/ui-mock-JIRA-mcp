# GreyOrange Manager Dashboard — Strict Design Language

> **AGENT INSTRUCTION:** This document is the single source of truth for all UX generation in the Manager Dashboard. Do NOT deviate from any rule defined here. Do NOT invent colors, spacing, components, or patterns not listed. When in doubt, refer back to this document.
>
> **UI LIBRARY:** All components MUST be implemented using **Quasar Framework v1.20.1** (`@quasar/app 2.4.3`) with **Vue 2**. Never use raw HTML elements (`<button>`, `<input>`, `<select>`) when a Quasar equivalent exists. Every section below names the exact Quasar component to use. Section 27 is a full quick-lookup table of all Quasar components used in this product.

---

## 1. Brand Identity

- **Product name:** Grey Matter Manager Dashboard
- **Brand:** GreyOrange
- **Logo:** GreyOrange "G" mark in orange, wordmark in dark grey — always top-left of every screen
- **Tagline (login only):** "Moving goods flexibly and efficiently"
- **Domain:** Warehouse operations — robotics, inventory, orders, audits, shifts

---

## 2. Color System

### Primary Palette — Use ONLY these hex values

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#101a5c` | Dark navy — top navigation bar, section header banners, active tab bg, modal headers |
| `secondary` | `#FE8400` | Orange — primary CTA buttons, active sub-tab underline, logo accent, save/export buttons |
| `positive` | `#66bb6a` | Green — success status (Completed, Open), positive metrics |
| `negative` | `#ED3324` | Red — error states, critical priority, destructive action buttons (delete), validation errors |
| `info` | `#2982cc` | Blue — "Created" status badge, informational chips, links |
| `warning` | `#f9b115` | Yellow — warning states, caution indicators, pending items |
| `accent` | `#9C27B0` | Purple — rare highlight only; never use as primary color |
| `dark` | `#636f83` | Dark grey — secondary text, disabled icon buttons, muted labels |
| `grey` | `#696969` | Grey — disabled states, placeholder text, muted content |
| `text-on-dark` | `#FFFFFF` | White — text on `primary` backgrounds |
| `light-grey` | `#d4d3d3` | Light grey — table row dividers, borders, inactive backgrounds |
| `page-bg` | `#F5F5F5` | Off-white — page body background |
| `card-bg` | `#FFFFFF` | White — table backgrounds, card surfaces, modals |

### Forbidden Colors
- Do NOT use any color not in the table above.
- Do NOT use gradients.
- Do NOT use transparency/opacity-based color blending for UI surfaces.

---

## 3. Typography

### Typefaces

| Role | Font | Format |
|---|---|---|
| Primary UI | SourceSansPro | OTF — body, tables, labels, inputs |
| Brand / Headlines | DINNextLTPro | OTF — page titles, login hero text only |

### Type Scale

| Role | Size | Weight | Line Height | Color |
|---|---|---|---|---|
| Nav tab label | 13px | 600 (SemiBold) | 16px | `#FFFFFF` (on dark) |
| Sub-tab label | 13px | 400 | 16px | `#636f83` |
| Section banner title | 14px | 600 | 17px | `#FFFFFF` |
| Page title (login) | 28px | 700 | 34px | `#FFFFFF` |
| Sub-heading / card label | 13px | 600 | 16px | `#101a5c` |
| Body / table cell | 13px | 400 | 17px | `#101a5c` |
| Table header | 13px | 600 | 16px | `#636f83` |
| Caption / secondary | 12px | 400 | 15px | `#636f83` |
| Stat value (large) | 20px | 700 | 24px | `#101a5c` |
| Placeholder text | 13px | 400 | 17px | `#696969` italic |
| Error text | 12px | 400 | 15px | `#ED3324` |
| Link / clickable ID | 13px | 400 | 17px | `#2982cc` underline on hover |

### Rules
- Never exceed 700 font weight.
- Never use italic except for empty state messages and placeholder text.
- All tab labels are UPPERCASE.
- Section banner text is sentence case.
- Table column headers are sentence case, not all-caps.

---

## 4. Layout & Page Structure

### Full-Page Shell

**Quasar layout declaration:** `q-layout` with view `"hHh Lpr lfr"` (fixed header, left-side content, right-side footer — standard Quasar view string)

```
┌─────────────────────────────────────────────────────────────┐
│  q-header (fixed, 56px height)                              │
│  q-toolbar: [Logo] [App Name]       [Bell] [TZ] [Lang] [User]│
├─────────────────────────────────────────────────────────────┤
│  q-tabs (primary, bg: #101a5c, 44px)                        │
│  q-tab × N  |  active q-tab (indicator-color: #FE8400)      │
├─────────────────────────────────────────────────────────────┤
│  q-tabs (sub, bg: #FFFFFF, 40px, align: left)               │
│  q-tab × N  |  active: orange bottom indicator              │
├─────────────────────────────────────────────────────────────┤
│  Custom SectionBanner div (full-width, bg: #101a5c, 40px)   │
│  Page Title | Stat: Value | Stat: Value                     │
├─────────────────────────────────────────────────────────────┤
│  q-page-container → q-page (bg: #F5F5F5, padding: 16px)     │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  q-card (SummarySection, collapsible)               │   │
│   │  Charts + KPI metrics                               │   │
│   └─────────────────────────────────────────────────────┘   │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  FilterBar + ActionBar                              │   │
│   │  q-table                                            │   │
│   │  q-pagination                                       │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

```vue
<!-- Skeleton — every authenticated page -->
<q-layout view="hHh Lpr lfr">
  <q-header>
    <q-toolbar><!-- TopBar content --></q-toolbar>
    <q-tabs v-model="activeTab" dense align="left" indicator-color="secondary">
      <q-tab v-for="tab in tabs" :name="tab.name" :label="tab.label" />
    </q-tabs>
    <q-tabs v-model="activeSubTab" dense align="left" indicator-color="secondary" class="sub-tabs">
      <q-tab v-for="sub in subTabs" :name="sub.name" :label="sub.label" />
    </q-tabs>
  </q-header>
  <q-page-container>
    <q-page><!-- page content --></q-page>
  </q-page-container>
</q-layout>
```

### Spacing Scale (strict — use only these values)

| Token | Value | Use |
|---|---|---|
| `xs` | 4px | Icon padding, tight gaps |
| `sm` | 8px | Inner element spacing |
| `md` | 16px | Card padding, section gaps |
| `lg` | 24px | Major section separation |
| `xl` | 32px | Page-level padding |

### Grid / Width
- Full-width layout — no max-width container cap.
- Page content has `16px` horizontal padding.
- Tables stretch to 100% width.

---

## 5. Top Bar

**Quasar components:** `q-header` > `q-toolbar` + `q-toolbar-title` + `q-btn` (icon) + `q-avatar` + `q-menu` + `q-item`

- **Height:** 56px
- **Background:** `#FFFFFF`
- **Border-bottom:** 1px solid `#d4d3d3`
- **Left:** GreyOrange logo mark (orange) + "Manager Dashboard" in `#FE8400` (bold) + "Version unknown" in `#636f83` (small, below) — wrapped in `q-toolbar-title`
- **Right (left to right):** Bell `q-btn(icon="notifications")` → Timezone text → Globe `q-btn(icon="language")` + language `q-menu` → `q-avatar` + username + caret, opens `q-menu` with `q-list` > `q-item` for Profile/Logout
- All right-side controls are `#636f83` text on white

```vue
<q-header bordered class="bg-white text-dark">
  <q-toolbar>
    <q-toolbar-title><!-- logo + title --></q-toolbar-title>
    <q-btn flat round icon="notifications" color="dark" />
    <q-btn flat round icon="language" color="dark">
      <q-menu><q-list><!-- locale items --></q-list></q-menu>
    </q-btn>
    <q-avatar size="32px" color="dark">
      <q-menu><q-list><!-- profile/logout --></q-list></q-menu>
    </q-avatar>
  </q-toolbar>
</q-header>
```

---

## 6. Primary Navigation Tab Bar

**Quasar components:** `q-tabs` + `q-tab`

- **Height:** 44px
- **Background:** `#101a5c` (dark navy) — set via `class="bg-primary"`
- **Text:** `#FFFFFF`, 13px, 600 weight, UPPERCASE, letter-spacing: 0.5px
- **Active tab indicator:** `indicator-color="secondary"` (orange underline, 3px)
- **Hover state:** Slight opacity decrease (0.85)
- **Tab list (fixed order):** ANALYTICS → OUTBOUND → INBOUND → AUDIT → PROCESS EXCEPTIONS → INVENTORY → SYSTEM → RESOURCES → SHIFT PLANNING → REPORTS → NOTIFICATION
- **Overflow:** `q-tabs` prop `mobile-arrows` for right-side `>` chevron
- **No icons** in primary tabs — text only (`no-caps` prop OFF — labels stay uppercase via CSS)

```vue
<q-tabs
  v-model="activeTab"
  class="bg-primary text-white"
  indicator-color="secondary"
  dense
  mobile-arrows
  align="left"
>
  <q-tab name="analytics" label="ANALYTICS" />
  <q-tab name="outbound"  label="OUTBOUND" />
  <!-- ... -->
</q-tabs>
```

---

## 7. Sub-Tab Bar

**Quasar components:** `q-tabs` + `q-tab` (second `q-tabs` instance, inside `q-header`)

- **Height:** 40px
- **Background:** `#FFFFFF` — `class="bg-white"`
- **Border-bottom:** 1px solid `#d4d3d3`
- **Text:** 13px, 400 weight, `#636f83`, sentence case
- **Active sub-tab:** 13px, 600 weight, `#101a5c`, with `3px` solid `#FE8400` bottom border — `indicator-color="secondary"`
- **No background highlight** on active sub-tab — only the underline changes
- **Spacing:** 24px horizontal padding per tab item — `q-tab` default padding

```vue
<q-tabs
  v-model="activeSubTab"
  class="bg-white text-dark sub-tab-bar"
  indicator-color="secondary"
  dense
  align="left"
  narrow-indicator
>
  <q-tab name="listing"  label="Inventory Listing" />
  <q-tab name="tagchange" label="Tag Change" />
  <!-- ... -->
</q-tabs>
```

---

## 8. Section Banner

- **Height:** 40px
- **Background:** `#101a5c`
- **Text:** `#FFFFFF`, 13px, 600 weight
- **Format:** `Page Title | Stat Label: Value | Stat Label: Value`
- **Separator character:** `|` with spaces
- **Stat values** bold, stat labels regular weight
- **Right side (optional):** Collapse/expand chevron `^` to toggle summary section below

---

## 9. Buttons

**Quasar component:** `q-btn` for all button types. Never use `<button>`.

### Primary Button (CTA)
**`q-btn color="secondary" text-color="white" unelevated`**
- **Background:** `#FE8400` via `color="secondary"`
- **Text:** `#FFFFFF`, 13px, 600 weight, UPPERCASE
- **Border-radius:** 4px — Quasar default with `unelevated` + no `rounded`
- **Height:** 36px — `dense` prop or explicit CSS
- **Padding:** 8px 20px
- **Hover:** Quasar handles darkening automatically
- **Disabled:** `disable` prop — Quasar applies `#d4d3d3` bg

```vue
<q-btn label="LOGIN" color="secondary" text-color="white" unelevated no-caps />
<!-- no-caps keeps label casing as-is; omit if you want Quasar auto-uppercase -->
```

### Secondary Button (Cancel / Neutral)
**`q-btn outline color="dark"`**
- **Background:** `#FFFFFF`
- **Border:** 1px solid `#d4d3d3` via `outline` prop
- **Text:** `#636f83`, 13px, 600 weight, UPPERCASE
- **Border-radius:** 4px

```vue
<q-btn label="CANCEL" outline color="dark" unelevated />
```

### Danger Button (Destructive)
**`q-btn color="negative" text-color="white" unelevated`**
- **Background:** `#ED3324` via `color="negative"`
- **Text:** `#FFFFFF`, 13px, 600 weight

```vue
<q-btn label="DELETE" color="negative" text-color="white" unelevated />
```

### Icon Button (standalone table action)
**`q-btn flat round icon="..." size="sm"`** — or `q-btn icon="..." outline round`
- **Size:** 32px × 32px — `size="sm"` + `dense`
- **Border:** 1px solid `#d4d3d3` — use `outline` prop
- **Border-radius:** 4px — use `square` prop instead of `round` for square icon buttons
- **Icon color:** `color="primary"` (default), `color="secondary"` (primary action), `color="negative"` (destructive)

```vue
<!-- Detail view icon button -->
<q-btn icon="description" outline square dense color="primary" size="sm" />
<!-- Edit -->
<q-btn icon="edit" outline square dense color="primary" size="sm" />
<!-- Delete -->
<q-btn icon="delete" outline square dense color="negative" size="sm" />
```

### Split Button (Save Filter / Export Data)
**`q-btn-dropdown color="secondary" unelevated`** — Quasar's built-in split dropdown button

```vue
<q-btn-dropdown
  split
  color="secondary"
  label="Save Filter"
  unelevated
  @click="saveFilter"
>
  <q-list>
    <q-item clickable v-close-popup><!-- dropdown option --></q-item>
  </q-list>
</q-btn-dropdown>
```

---

## 10. Form Inputs

**Quasar components:** `q-input`, `q-select`, `q-radio`, `q-checkbox`. Never use raw `<input>`, `<select>`, `<textarea>`.

### Text Input
**`q-input outlined dense`**
- **Height:** 36px — `dense` prop
- **Border:** 1px solid `#d4d3d3` — `outlined` prop
- **Border-radius:** 4px — Quasar `outlined` default
- **Background:** `#FFFFFF`
- **Text:** 13px, `#101a5c`
- **Placeholder:** via `placeholder` prop, `#696969`
- **Focus border:** `#2982cc` — override with CSS or `color="info"`
- **Error border:** `#ED3324` — Quasar applies automatically when `error` prop is true
- **Error message:** `error-message` prop — renders 12px `#ED3324` text below input

```vue
<q-input
  v-model="value"
  outlined
  dense
  placeholder="Enter value"
  :error="hasError"
  error-message="Field is required"
/>
```

### Search Input
**`q-input outlined dense` with prepend slot**

```vue
<q-input outlined dense placeholder="Search by Name" v-model="search">
  <template #prepend>
    <q-icon name="search" color="dark" size="18px" />
  </template>
</q-input>
```

### Dropdown / Select
**`q-select outlined dense`**
- Same height/border as text input — `outlined dense` props
- Trailing caret: Quasar renders automatically
- Options list: white bg, `#101a5c` text, `#F5F5F5` hover — Quasar default
- Use `emit-value map-options` when binding to primitive values

```vue
<q-select
  v-model="status"
  :options="statusOptions"
  outlined
  dense
  label="Status"
  emit-value
  map-options
/>
```

### Radio Button
**`q-radio`**
- Selected color: `color="primary"` (`#101a5c`)
- Label: 13px `#101a5c`

```vue
<q-radio v-model="area" val="GTP" label="GTP Area" color="primary" />
<q-radio v-model="area" val="Reserve" label="Reserve Area" color="primary" />
```

### Checkbox
**`q-checkbox`**
- Table row selection: `color="primary"` (`#101a5c`)
- Form checkboxes: `color="secondary"` (`#FE8400`)
- Size: 16px × 16px — Quasar default

```vue
<!-- Table row checkbox -->
<q-checkbox v-model="selected" color="primary" dense />
<!-- Form checkbox -->
<q-checkbox v-model="isActive" label="Active" color="secondary" />
```

---

## 11. Data Tables

**Quasar component:** `q-table` with `flat bordered` props. Never build tables from raw `<table>` HTML.

### Structure
```
┌─────────────────────────────────────────────────────────────────┐
│ [ ] │ Column A      │ Column B    │ Column C    │ Actions        │
├─────────────────────────────────────────────────────────────────┤
│ [ ] │ value         │ value       │ value       │ [icon][icon]   │
│─────────────────────────────────────────────────────────────────│
│ [ ] │ value         │ value       │ value       │ [icon][icon]   │
└─────────────────────────────────────────────────────────────────┘
```

### Table Styling
- **Quasar props:** `flat` (no shadow), `bordered` (outer border only), `dense`, `separator="horizontal"`
- **Background:** `#FFFFFF`
- **Header row:** Background `#F5F5F5`, text `#636f83`, 13px 600 weight — override via `thead tr th` CSS
- **Body rows:** Background `#FFFFFF`, text `#101a5c`, 13px 400 weight
- **Row divider:** 1px solid `#d4d3d3` — `separator="horizontal"` prop
- **Row hover:** Background `#F5F5F5` — Quasar default `q-tr:hover`
- **Checkbox column:** 40px wide, leftmost — use `selection="multiple"` prop on `q-table`
- **Actions column:** Define as last column in `columns` array, `align: 'right'`

```vue
<q-table
  :rows="rows"
  :columns="columns"
  row-key="id"
  selection="multiple"
  v-model:selected="selected"
  flat
  bordered
  dense
  separator="horizontal"
  :rows-per-page-options="[10, 20, 50, 100]"
>
  <!-- Custom cell for actions -->
  <template #body-cell-actions="{ row }">
    <q-td align="right">
      <q-btn icon="description" outline square dense color="primary" size="sm" />
      <q-btn icon="edit" outline square dense color="primary" size="sm" class="q-ml-xs" />
    </q-td>
  </template>

  <!-- Custom cell for status chips -->
  <template #body-cell-status="{ value }">
    <q-td>
      <q-chip :color="statusColor(value)" text-color="white" dense>{{ value }}</q-chip>
    </q-td>
  </template>

  <!-- Null values -->
  <template #body-cell-reason="{ value }">
    <q-td>{{ value || '--' }}</q-td>
  </template>
</q-table>
```

### Column Definition Pattern
```javascript
const columns = [
  { name: 'id',      label: 'Order Info',   field: 'id',     align: 'left', sortable: true },
  { name: 'status',  label: 'Status',       field: 'status', align: 'left' },
  { name: 'actions', label: 'Actions',      field: 'actions',align: 'right' },
]
```

### Cell Content Patterns
- **IDs / Order numbers:** Wrap in `<span class="text-info cursor-pointer">` or `q-btn flat dense no-caps color="info"`
- **Status chips** (inline in cell): `q-chip` — see Section 14
- **Null / empty values:** Rendered as `--`
- **Truncation:** Wrap in `<div class="ellipsis" style="max-width:200px">` + `q-tooltip` for full value
- **Sub-rows / expandable:** "Show More" as `q-btn flat dense no-caps color="info" label="Show More"`

### Pagination
**Quasar component:** `q-table` built-in pagination OR standalone `q-pagination`

- `q-table` handles pagination via `:pagination.sync` and `:rows-per-page-options`
- For standalone: `q-pagination v-model="page" :max="totalPages"`
- Format: `Results per page: [50 ▾]   [<]  1  [>]` — Quasar `q-table` renders this automatically in the bottom slot

### Load More Pattern (alternative to pagination)
- Centered `q-btn` below table: `color="secondary" label="Load More" unelevated`
- Use when `@load-more` emit drives cursor-based GraphQL queries

---

## 12. Filter Bar

**Quasar components:** `q-input` (search) + `q-select` (filters) + `q-btn` (actions) + `q-btn-dropdown` (split buttons) — laid out in a `div` row with `flex` and `q-gutter-sm`

Appears between SectionBanner and DataTable. Always full-width.

```
[ ≡ ] [ 🔍 Search by ... ] [ Dropdown ▾ ] [ Dropdown ▾ ]   ...   [ Save Filter ▾ ] [ Export Data ▾ ] [ ↺ ]
```

- **Left side:** `q-btn(icon="menu", outline, square, dense)` + `q-input(outlined, dense, search)` + `q-select(outlined, dense)` × N
- **Right side:** `q-btn-dropdown(split, color="secondary")` for Save Filter + Export Data + `q-btn(icon="sync", outline, square, dense)` for Refresh
- **Spacing:** `q-gutter-sm` (8px) between all elements — use Quasar's gutter system
- **Filter icon button `≡`:** `q-btn icon="menu" outline square dense color="dark"`
- **Refresh button `↺`:** `q-btn icon="sync" outline square dense color="dark"`

```vue
<div class="row items-center q-gutter-sm q-pa-md">
  <!-- Left -->
  <q-btn icon="menu" outline square dense color="dark" />
  <q-input v-model="search" outlined dense placeholder="Search by Id" style="min-width:180px">
    <template #prepend><q-icon name="search" color="dark" size="18px" /></template>
  </q-input>
  <q-select v-model="orderType" :options="orderTypes" outlined dense label="Order Type" style="min-width:140px" emit-value map-options />

  <q-space />

  <!-- Right -->
  <q-btn-dropdown split color="secondary" label="Save Filter" unelevated @click="saveFilter">
    <q-list><!-- saved filter options --></q-list>
  </q-btn-dropdown>
  <q-btn-dropdown split color="secondary" label="Export Data" unelevated @click="exportData">
    <q-list><!-- export format options --></q-list>
  </q-btn-dropdown>
  <q-btn icon="sync" outline square dense color="dark" @click="refresh" />
</div>
```

---

## 13. Summary / KPI Section

**Quasar components:** `q-card` + `q-card-section` for container; `q-expansion-item` for collapsible wrapper; `q-separator` for internal dividers

Appears at top of pages with analytics. Collapsible (chevron in SectionBanner).

### Layout Variants

**Variant A — Stat Cards Row**
**Quasar:** `q-card` > `q-card-section` with `row` class + `col-*` grid
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ Metric Label │ Metric Label │ Metric Label │ Metric Label │
│    [value]   │    [value]   │    [value]   │    [value]   │
└──────────────┴──────────────┴──────────────┴──────────────┘
```
- `q-card flat bordered` — white card, 1px border `#d4d3d3`, 4px border-radius
- KPI value: 20–24px, 700 weight, `#101a5c` — class `text-h5 text-primary text-weight-bold`
- Label: 12px, `#636f83` — class `text-caption text-dark`

```vue
<q-card flat bordered>
  <q-card-section class="row">
    <div class="col text-center" v-for="kpi in kpis" :key="kpi.label">
      <div class="text-h5 text-primary text-weight-bold">{{ kpi.value }}</div>
      <div class="text-caption text-dark">{{ kpi.label }}</div>
    </div>
  </q-card-section>
</q-card>
```

**Variant B — Mixed Stats + Chart**
**Quasar:** `q-card` > `q-card-section` > `div.row` with `col-7` (stats) + `col-5` (chart)
- Left 60%: stat rows/cards
- Right 40%: chart (bar, line, or donut) wrapped in a `<canvas>` or Plotly `<div>`
- `q-separator vertical` between left and right sections

**Variant C — Donut + Legend**
**Quasar:** `q-card` > `q-card-section` with chart + `q-list dense` legend
- Donut chart in `<canvas>` via vue-chartjs
- Legend: `q-item` per series — colored `q-avatar` dot + label + value

### Collapsible Summary
Use `q-expansion-item` OR control visibility with `v-if` + a toggle button in the SectionBanner (chevron `q-btn flat icon="expand_less"`):

```vue
<q-expansion-item v-model="summaryOpen" header-class="hidden">
  <q-card flat bordered><!-- KPI content --></q-card>
</q-expansion-item>
```

---

## 14. Status Chips & Badges

**Quasar components:** `q-chip` (filled), `q-badge` (count badge), `q-linear-progress` (inline progress bar)
All status indicators are inline, in table cells or on cards.

| Status | Quasar Component | `color` prop | Style |
|---|---|---|---|
| Completed | `q-chip dense` | `positive` | filled, white text |
| Open | `q-chip dense` | `positive` | filled, white text |
| In Progress / Processing | `q-chip dense` | `info` | filled, white text |
| Created | `q-chip dense` | `info` | filled, white text |
| Pending | `q-chip dense` | `warning` | filled, white text |
| Breached | `q-chip dense` | `negative` | filled, white text |
| Cancelled / Closed | `q-chip dense` | `dark` | filled, white text |
| Critical (priority) | `q-chip dense` | `negative` | filled, white text |
| Normal (priority) | plain `<span>` | — | no chip, `#101a5c` text |
| Error / Failed | `q-chip dense` | `negative` | filled, white text |

### Chip Style Rules
- Always use `dense` prop to achieve 20px height
- Always use `text-color="white"` with filled chips
- `square` prop for square-cornered chips (priority labels), default pill for status chips
- Never use `outline` variant for status chips — always filled

```vue
<q-chip dense color="positive" text-color="white">Completed</q-chip>
<q-chip dense color="info"     text-color="white">Created</q-chip>
<q-chip dense color="negative" text-color="white" square>Critical</q-chip>
```

### Notification Count Badge
**`q-badge`** — overlaid on bell icon
```vue
<q-btn flat round icon="notifications" color="dark">
  <q-badge color="negative" floating>{{ count }}</q-badge>
</q-btn>
```

### Progress Bar (inline)
**`q-linear-progress`** — used in inbound listing for putline progress
- Track color: `#d4d3d3` — `track-color="grey-3"`
- Fill color: `color="secondary"` (orange) or `color="positive"` (green)
- Height: 3px — `style="height:3px"`
- Shown below the fraction text (e.g., "0/5 Created")

```vue
<div class="text-caption">0/5 Created</div>
<q-linear-progress :value="0/5" color="secondary" track-color="grey-3" style="height:3px" />
```

---

## 15. Charts

**Vue wrappers:** `vue-chartjs` (wraps Chart.js) for standard charts; `plotly.js` directly for complex charts. Always wrap in a Vue SFC component — never use chart APIs directly in page components.

### Permitted Chart Types
| Type | Vue Library | Quasar container | When to Use |
|---|---|---|---|
| Bar (grouped/stacked) | `vue-chartjs` `Bar` | `q-card flat bordered` | Hourly picks, station performance |
| Line | `vue-chartjs` `Line` | `q-card flat bordered` | Trend over time, wave level projections |
| Donut / Pie | `vue-chartjs` `Doughnut` | `q-card flat bordered` | Status breakdown, utilization split |
| Horizontal bar | `vue-chartjs` `HorizontalBar` | `q-card flat bordered` | Category rankings |
| Heatmap / 3D | Plotly.js `<div ref="plot">` | `q-card flat bordered` | Complex analytics only |

### Chart Color Sequence (for multi-series)
Use in this order:
1. `#101a5c` (dark navy)
2. `#66bb6a` (green)
3. `#FE8400` (orange)
4. `#2982cc` (blue)
5. `#f9b115` (yellow)
6. `#ED3324` (red)
7. `#9C27B0` (purple — last resort)

### Chart Rules
- Always include a legend
- Empty state: show centered italic grey text "No data available"
- Chart containers: white bg, `#d4d3d3` border, 4px border-radius, 16px padding
- Axis labels: 12px `#636f83`
- Grid lines: `#d4d3d3` dashed, 1px
- No 3D effects on 2D charts
- Chart titles: 13px, 600 weight, `#101a5c`, above chart

---

## 16. Modals / Dialogs

**Quasar component:** `q-dialog` + `q-card` + `q-card-section` + `q-card-actions`. Never use custom overlay divs.

### Structure
```
┌──────────────────────────────────────────────┐
│  [Modal Title]                          [ X ] │  ← q-card-section (bg-primary text-white)
├──────────────────────────────────────────────┤
│                                              │
│   Form content / confirmation message        │  ← q-card-section
│                                              │
├──────────────────────────────────────────────┤
│              [ CANCEL ]   [ PROCEED ]        │  ← q-card-actions align="right"
└──────────────────────────────────────────────┘
```

- **Overlay:** `q-dialog` handles backdrop automatically — `backdrop-filter` not needed
- **Width:** `style="width:500px;max-width:90vw"` on `q-card` (form modals); `style="width:360px"` (confirm dialogs)
- **Border-radius:** 4px — Quasar default
- **Header:** `q-card-section class="bg-primary text-white row items-center q-pa-md"`
- **Close button:** `q-btn icon="close" flat round dense color="white" v-close-popup` — inside header row, right-aligned via `q-space`
- **Body:** `q-card-section class="q-pa-lg"` — 24px padding, form inputs per Section 10
- **Footer:** `q-card-actions align="right" class="q-px-md q-pb-md"` — CANCEL then PROCEED
- **Error state:** Use `q-input :error :error-message` — never toast inside modal
- **`persistent`** prop: use on modals with forms to prevent accidental close on backdrop click

```vue
<q-dialog v-model="open" persistent>
  <q-card style="width:500px;max-width:90vw">
    <!-- Header -->
    <q-card-section class="bg-primary text-white row items-center q-pa-md">
      <span class="text-subtitle1 text-weight-bold">Add User</span>
      <q-space />
      <q-btn icon="close" flat round dense color="white" v-close-popup />
    </q-card-section>

    <!-- Body -->
    <q-card-section class="q-pa-lg">
      <q-input outlined dense label="Username" v-model="form.username" />
      <q-input outlined dense label="Password" type="password" v-model="form.password"
        class="q-mt-md" :error="errors.password" error-message="Password does not match" />
    </q-card-section>

    <!-- Footer -->
    <q-card-actions align="right" class="q-px-md q-pb-md">
      <q-btn label="CANCEL" outline color="dark" v-close-popup />
      <q-btn label="PROCEED" color="secondary" text-color="white" unelevated @click="submit" />
    </q-card-actions>
  </q-card>
</q-dialog>
```

---

## 17. Drawers / Side Panels

**Quasar component:** `q-drawer` with `side="right"` and `overlay` or `behavior="mobile"` depending on context. Alternatively `q-dialog` with `position="right"` for full-height side panels.

- Slides in from the right — `side="right"`
- Width: 400–600px — `:width="500"` prop
- Same header structure as modals: `q-card-section class="bg-primary text-white"` with title + `q-btn icon="close"`
- Body: `q-scroll-area` wrapper inside for scrollable content, 24px padding
- No overlay for drawers that show alongside the table (detail panels): `overlay` prop OFF, `:mini="false"`
- Full overlay for action drawers: `overlay` prop ON

```vue
<!-- Detail side panel (no overlay, alongside table) -->
<q-drawer v-model="detailOpen" side="right" :width="500" bordered>
  <q-card-section class="bg-primary text-white row items-center">
    <span class="text-subtitle1 text-weight-bold">Order Detail</span>
    <q-space />
    <q-btn icon="close" flat round dense color="white" @click="detailOpen = false" />
  </q-card-section>
  <q-scroll-area class="fit">
    <div class="q-pa-lg"><!-- content --></div>
  </q-scroll-area>
</q-drawer>

<!-- Action drawer (with overlay) -->
<q-drawer v-model="actionOpen" side="right" :width="500" overlay behavior="mobile">
  <!-- same structure -->
</q-drawer>
```

---

## 18. Alerts & Notifications

### Toast / Notify
**Quasar plugin:** `this.$q.notify()` — imported via Quasar's Notify plugin. Never create custom toast components.

- **Position:** `'top-right'`
- **Timeout:** 3000–5000ms
- **Color:** use Quasar color tokens matching severity

```javascript
// Success
this.$q.notify({ message: 'Order updated successfully', color: 'positive', position: 'top-right', timeout: 3000 })

// Error
this.$q.notify({ message: 'Failed to load data', color: 'negative', position: 'top-right', timeout: 4000 })

// Warning
this.$q.notify({ message: 'No records found', color: 'warning', position: 'top-right', timeout: 3000 })

// Info
this.$q.notify({ message: 'Data temporarily unavailable', color: 'info', position: 'top-right', timeout: 3000 })
```

- No icons inside toast — `message` text only (no `icon` property)
- This is triggered from Apollo error link for `ELASTIC_ERROR` and mutation results

### On-Screen Alerts (real-time)
**Custom `OnScreenAlerts` component** — receives data from Vuex store (populated via GraphQL subscription → RabbitMQ)
- Layered above page content via absolute/fixed positioning
- Severity colors: use `color="negative"` / `color="warning"` Quasar color classes
- Dismissible: `q-btn icon="close" flat dense round` inside alert card

### Notification Bell
**`q-btn` + `q-badge` + `q-menu`** (see Section 5 TopBar)
- Badge: `q-badge color="negative" floating`
- Panel: `q-menu` or `q-drawer` (right side) containing `q-list` of `q-item` notifications

---

## 19. Login Page

- **Layout:** Split — left 40% login card, right 60% warehouse photo background
- **Left panel:** White bg, centered login card with:
  - Dark navy header bar labeled "Login"
  - Avatar placeholder icon (circle, `#636f83`)
  - Username input
  - Password input with eye-toggle icon
  - `[ LOGIN ]` button — full-width, orange (`#FE8400`), UPPERCASE
- **Right panel:** Full-bleed warehouse photo, no overlay
- **Hero text on photo (centered):** "Welcome to", then "Grey Matter Manager Dashboard" (DINNextLTPro, 28px, bold, white), then tagline (16px, white)
- **Top bar on login:** Logo left, Language selector right — same TopBar component, no nav tabs

---

## 20. Hardware / Status Dashboard Sections

Pattern used in System → Hardware Status and similar monitoring pages.

### Stat Block Group
```
┌─────────────────────────────────────────────────────────┐
│  Section Title (e.g. "Ranger")                          │  ← SectionBanner style
├───────────────────────────────────┬─────────────────────┤
│  Info Block (stats)               │  Chart / Table      │
│                                   │                     │
│  [icon] Inducted: 5               │  Task Type | Total  │
│  = [icon] Active: 5               │  [empty state]      │
│  + [icon] Dead: 0                 │                     │
│  [icon] Avg Power: 100            │                     │
└───────────────────────────────────┴─────────────────────┘
```
- Left stat block: white card, icons + labels + values inline
- Label: 12px `#636f83`
- Value: 18px 700 weight `#101a5c`
- Status dot or icon suffix: colored per status (green/red/grey)
- Right: table or chart in white card with `#d4d3d3` border

---

## 21. Empty States

**Quasar component:** `q-table` built-in `no-data-label` prop for table empty state. For full-section empty states, use a plain `div` with centered text — no custom Quasar component needed.

- Centered vertically and horizontally in the content area — `class="flex flex-center"` Quasar utility
- Text: 15px, italic, `#696969` — `class="text-grey text-italic"`
- No icons for empty state — text only
- Example: _"Enter SKU ID and validate to populate data."_
- Example: _"No data available"_

```vue
<!-- In q-table -->
<q-table no-data-label="No data available" ... />

<!-- Full section empty state -->
<div class="flex flex-center q-pa-xl text-grey text-italic">
  Enter SKU ID and validate to populate data.
</div>
```

---

## 22. Icons

**Quasar component:** `q-icon` (standalone), or `icon` prop on `q-btn`, `q-input`, `q-select`, etc. Registered icon sets: Material Icons, Material Symbols Outlined, FontAwesome v5.

- **Preferred set:** Material Symbols Outlined for all new UI — configure in `quasar.conf.js` extras
- **Size in tables (action buttons):** 18px — `size="18px"` or `size="sm"` on `q-btn`
- **Size in nav / top bar:** 20–22px — `size="22px"` on `q-btn`
- **Size in stat blocks:** 24–28px — `q-icon size="28px"`
- **Color:** Use `color="primary"` / `color="secondary"` / etc. — never hardcode hex on `q-icon`

```vue
<q-icon name="notifications" size="22px" color="dark" />
<q-icon name="sym_o_warehouse" size="28px" color="primary" />  <!-- Material Symbols Outlined -->
<q-icon name="fab fa-github" />  <!-- FontAwesome v5 -->
```

### Common Icon → Action Mapping (MUST follow)
| Icon | Action |
|---|---|
| `description` / document | View detail |
| `edit` / pencil | Edit record |
| `settings` / gear | Configure |
| `delete` / trash | Delete (red) |
| `pause` | Pause operation |
| `play_arrow` | Resume operation |
| `info` | Info tooltip |
| `refresh` / `sync` | Reload data |
| `download` / `file_download` | Export/download |
| `notifications` / bell | Alerts |
| `arrow_drop_down` | Dropdown caret |
| `chevron_right` | Navigate / expand |
| `search` | Search input prefix |
| `filter_list` | Filter toggle |

---

## 23. Responsive / Viewport

- **Target:** Desktop-only (1280px minimum width)
- **No mobile breakpoints** — this is a warehouse operations tool used on large monitors
- **Minimum width:** 1280px — do not add responsive CSS below this breakpoint
- Horizontal scroll is acceptable on very wide data tables

---

## 24. Patterns — What Agents MUST Follow

### Pattern A: Listing Page
1. TopBar + PrimaryTabBar + SubTabBar (if sub-sections exist)
2. SectionBanner with page title + summary counts
3. FilterBar (search + dropdowns + Save Filter + Export Data + Refresh)
4. DataTable with checkbox column + data columns + Actions column
5. Pagination (bottom right) OR Load More (centered orange button)

### Pattern B: Dashboard / Overview Page
1. TopBar + PrimaryTabBar
2. SectionBanner
3. Summary section (collapsible) — KPI cards + charts
4. DataTable or secondary data section below

### Pattern C: Form / Action Page (Tag Change, Create Audit)
1. TopBar + PrimaryTabBar + SubTabBar
2. SectionBanner (page title only)
3. White card body with form inputs + action button
4. Empty state message when no data loaded yet

### Pattern D: Modal / Dialog
1. Dark navy header + X close
2. White form body
3. Right-aligned CANCEL + PROCEED footer

### Pattern E: Hardware/Status Card
1. SectionBanner-style section header
2. Two-column layout: left stats, right chart/table
3. Stat items: icon + label + value

---

## 25. Anti-Patterns — What Agents MUST NEVER Do

- **NEVER** use colors outside the defined palette (Section 2)
- **NEVER** use gradients or shadows heavier than `box-shadow: 0 1px 3px rgba(0,0,0,0.1)`
- **NEVER** place the active nav tab at the bottom or side — always top horizontal
- **NEVER** use rounded cards with radius > 4px for UI surfaces
- **NEVER** use full-page loading spinners — use inline skeleton/empty states
- **NEVER** render data tables without column headers
- **NEVER** add icons inside primary CTA buttons (text only)
- **NEVER** use animated transitions longer than 200ms
- **NEVER** use a dark page background — page bg is always `#F5F5F5` or `#FFFFFF`
- **NEVER** invent new icon actions — use the mapping in Section 22
- **NEVER** use toast alerts inside modals — show inline validation errors only
- **NEVER** stack multiple modals — one modal at a time
- **NEVER** use card shadows in tables — tables use border/divider lines only
- **NEVER** center-align table body cells — left-aligned except numeric columns (right-aligned)
- **NEVER** use font sizes outside the type scale in Section 3

---

## 26. Quick Reference Card for Agents

```
Colors:    Navy #101a5c | Orange #FE8400 | Green #66bb6a | Red #ED3324
           Blue #2982cc | Yellow #f9b115 | Grey #636f83  | White #FFFFFF

Fonts:     SourceSansPro (body) | DINNextLTPro (hero/login only)
Font size: 12px caption | 13px body | 14px banner | 20px stat value

Nav:       TopBar (56px) → PrimaryNav (44px, #101a5c) → SubNav (40px, white)
Banner:    Full-width, 40px, #101a5c bg, white text, pipe-separated stats

Buttons:   Primary = #FE8400 | Secondary = white+border | Danger = #ED3324
Inputs:    36px height | #d4d3d3 border | 4px radius | #2982cc focus

Tables:    White bg | #F5F5F5 header | #d4d3d3 row dividers | left-aligned
Modals:    Navy header | white body | CANCEL + PROCEED (right-aligned)

Status:    Completed=#66bb6a | Created=#2982cc | Warning=#f9b115 | Error=#ED3324
Charts:    Bar/Line/Donut via Chart.js | Color order: navy→green→orange→blue
```

---

---

## 27. Quasar Component Reference — Full Lookup Table

> **AGENT RULE:** For every UI element, find it in this table first. Use the listed Quasar component + props. Do NOT substitute with a different component or raw HTML.

| UI Element | Quasar Component | Key Props / Notes |
|---|---|---|
| **Page shell** | `q-layout` | `view="hHh Lpr lfr"` |
| **Top header bar** | `q-header` | `bordered` |
| **Toolbar row** | `q-toolbar` + `q-toolbar-title` | Standard Quasar toolbar |
| **Primary nav tabs** | `q-tabs` + `q-tab` | `class="bg-primary text-white"`, `indicator-color="secondary"`, `mobile-arrows`, `dense`, `align="left"` |
| **Sub-tabs** | `q-tabs` + `q-tab` | `class="bg-white text-dark"`, `indicator-color="secondary"`, `dense`, `align="left"`, `narrow-indicator` |
| **Page content area** | `q-page-container` + `q-page` | `q-page` sets min-height |
| **Section banner** | Custom `div.section-banner` | `bg-primary text-white` — NOT a Quasar component, just a styled div |
| **Card / surface** | `q-card` | `flat bordered` — never use shadow variant |
| **Card section** | `q-card-section` | Padding via `q-pa-*` utilities |
| **Card actions (footer)** | `q-card-actions` | `align="right"` |
| **Collapsible section** | `q-expansion-item` | `header-class="hidden"` when header is custom |
| **Separator / divider** | `q-separator` | `horizontal` (default) or `vertical` |
| **Primary CTA button** | `q-btn` | `color="secondary"`, `text-color="white"`, `unelevated`, `no-caps` |
| **Secondary / cancel button** | `q-btn` | `outline`, `color="dark"`, `unelevated` |
| **Danger / destructive button** | `q-btn` | `color="negative"`, `text-color="white"`, `unelevated` |
| **Icon action button** | `q-btn` | `icon="..."`, `outline`, `square`, `dense`, `size="sm"` |
| **Split dropdown button** | `q-btn-dropdown` | `split`, `color="secondary"`, `unelevated` — for Save Filter / Export Data |
| **Text input** | `q-input` | `outlined`, `dense`, `:error`, `error-message` |
| **Search input** | `q-input` | `outlined`, `dense`, `#prepend` slot with `q-icon name="search"` |
| **Dropdown / select** | `q-select` | `outlined`, `dense`, `emit-value`, `map-options` |
| **Textarea** | `q-input` | `type="textarea"`, `outlined`, `autogrow` |
| **Date picker** | `q-date` inside `q-popup-proxy` on `q-btn` | `mask="YYYY-MM-DD"` |
| **Date range picker** | `vue2-daterange-picker` | External library — not a Quasar component |
| **Checkbox** | `q-checkbox` | `color="primary"` (table), `color="secondary"` (form), `dense` |
| **Radio button** | `q-radio` | `color="primary"` |
| **Toggle** | `q-toggle` | `color="secondary"` |
| **Data table** | `q-table` | `flat`, `bordered`, `dense`, `separator="horizontal"`, `selection="multiple"`, `:rows-per-page-options` |
| **Pagination** | `q-pagination` | `v-model`, `:max`, `boundary-numbers` |
| **Status chip** | `q-chip` | `dense`, `color="positive|info|negative|warning|dark"`, `text-color="white"` |
| **Notification badge** | `q-badge` | `color="negative"`, `floating` |
| **Progress bar (inline)** | `q-linear-progress` | `color="secondary|positive"`, `track-color="grey-3"`, `style="height:3px"` |
| **Circular progress** | `q-circular-progress` | `color="secondary"`, `track-color="grey-3"` |
| **Loading spinner** | `q-spinner` OR `q-inner-loading` | Never full-page blocking spinner — use `q-inner-loading` inside card/table |
| **Tooltip** | `q-tooltip` | Child of any element, activates on hover — for truncated cell values |
| **Icon** | `q-icon` | `name`, `size`, `color` — use Quasar color tokens |
| **Avatar** | `q-avatar` | `size="32px"`, `color="dark"` — for user avatar in top bar |
| **Modal / dialog** | `q-dialog` | `v-model`, `persistent` (for forms) — always contains `q-card` |
| **Right drawer / panel** | `q-drawer` | `side="right"`, `:width="500"`, `overlay` (for action drawers), `bordered` |
| **Scroll area** | `q-scroll-area` | `class="fit"` inside drawer/panel body |
| **Menu (dropdown)** | `q-menu` | On `q-btn` for user dropdown, language selector |
| **List** | `q-list` | Inside `q-menu` or `q-drawer` |
| **List item** | `q-item` + `q-item-section` | `clickable`, `v-close-popup` for menu items |
| **Toast notification** | `this.$q.notify()` | Plugin call — `color`, `message`, `position: 'top-right'`, `timeout` |
| **Notification dialog** | `this.$q.dialog()` | For simple confirm/alert prompts without custom UI |
| **Space flex filler** | `q-space` | In `q-toolbar` / `q-card-section` rows to push elements right |
| **Responsive utilities** | Quasar CSS classes | `row`, `col`, `col-*`, `q-gutter-sm/md`, `q-pa-*`, `q-ma-*`, `flex`, `flex-center`, `items-center`, `justify-between` |

### Quasar CSS Helper Classes Used in This Product

| Class | Effect |
|---|---|
| `bg-primary` | Background `#101a5c` |
| `bg-secondary` | Background `#FE8400` |
| `bg-positive` | Background `#66bb6a` |
| `bg-negative` | Background `#ED3324` |
| `bg-info` | Background `#2982cc` |
| `bg-warning` | Background `#f9b115` |
| `bg-dark` | Background `#636f83` |
| `bg-white` | Background `#FFFFFF` |
| `bg-grey-2` | Background `#F5F5F5` (page bg) |
| `text-primary` | Color `#101a5c` |
| `text-secondary` | Color `#FE8400` |
| `text-dark` | Color `#636f83` |
| `text-grey` | Color `#696969` |
| `text-white` | Color `#FFFFFF` |
| `text-info` | Color `#2982cc` |
| `text-negative` | Color `#ED3324` |
| `text-weight-bold` | font-weight: 700 |
| `text-weight-medium` | font-weight: 500 |
| `text-caption` | 12px text |
| `text-subtitle1` | 15px text |
| `text-h5` | 24px text |
| `text-italic` | font-style: italic |
| `ellipsis` | text-overflow: ellipsis |
| `q-pa-sm` | padding: 8px |
| `q-pa-md` | padding: 16px |
| `q-pa-lg` | padding: 24px |
| `q-ma-sm` | margin: 8px |
| `q-ml-xs` | margin-left: 4px |
| `q-gutter-sm` | gap: 8px (flex row) |
| `q-gutter-md` | gap: 16px (flex row) |
| `row` | display: flex; flex-direction: row |
| `col` | flex: 1 |
| `col-6` | flex: 0 0 50% |
| `flex-center` | justify-content+align-items: center |
| `items-center` | align-items: center |
| `justify-end` | justify-content: flex-end |
| `full-width` | width: 100% |
| `fit` | width+height: 100% |
| `cursor-pointer` | cursor: pointer |
| `hidden` | display: none |

---

*Source: Derived from GreyOrange Manager Dashboard codebase (mdui/ + mdbff/) and UI screenshots*
*Stack: Vue 2 + Quasar Framework 1.20.1 (`@quasar/app 2.4.3`) + Apollo GraphQL*
*Last updated: 2026-06-02*
