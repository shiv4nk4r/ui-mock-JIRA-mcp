# Manager Dashboard — Vue / Quasar UMD Component Library

Use this library when generating mockups in **Vue / Quasar mode**.
Output is a complete standalone HTML page using Vue 2 + Quasar 1 UMD from CDN.

**MANDATORY RULES:**
- COPY the BOOTSTRAP TEMPLATE verbatim. Never change CDN URLs or versions.
- COPY the CUSTOM APP CSS block verbatim inside `<style>`.
- Use real Quasar components (`<q-table>`, `<q-btn>`, etc.) — never raw `<table>`, `<button>`.
- Brand colors are already configured via `Vue.use(Quasar, { config: { brand: ... } })`. Use `color="primary"`, `color="secondary"`, etc.
- Status chips: always `<q-chip dense size="sm" class="q-ma-none" :style="\`background-color:\${getStatusColor(row.status)};font-size:12px\`">`.
- No Vuex, no Vue Router, no Apollo — single self-contained Vue instance only.
- Wrap the full HTML output in: `RAW_HTML_COMPONENT_START` … `RAW_HTML_COMPONENT_END`.

---

## SECTION 1: BOOTSTRAP TEMPLATE

Copy this skeleton verbatim. Fill in only `data()`, `computed`, `methods`, and `template`.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Manager Dashboard — Mockup</title>

  <!-- Quasar 1 CSS (sets body font-family to Roboto by default — we override below) -->
  <link href="https://cdn.jsdelivr.net/npm/quasar@1.20.1/dist/quasar.min.css" rel="stylesheet">
  <!-- Material Icons (used by Quasar + app) -->
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet">
  <!-- Source Sans Pro — matches real app's self-hosted SourceSansPro OTF.
       DO NOT use Source+Sans+3 — different family name, renders differently. -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap" rel="stylesheet">

  <style>
    /* ── CUSTOM APP CSS — copy verbatim from SECTION 2 ── */
  </style>
</head>
<body class="desktop">
  <div id="q-app"></div>

  <script src="https://cdn.jsdelivr.net/npm/vue@2.7.16/dist/vue.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/quasar@1.20.1/dist/quasar.umd.min.js"></script>

  <script>
    /* ── Quasar setup ── */
    Quasar.lang.set(Quasar.lang.enUS);
    Vue.use(Quasar, {
      config: {
        brand: {
          primary:   '#101a5c',
          secondary: '#FE8400',
          positive:  '#66bb6a',
          negative:  '#ED3324',
          info:      '#2982cc',
          warning:   '#f9b115',
          dark:      '#636f83',
        },
      },
      plugins: {
        Notify: Quasar.plugins.Notify,
        Dialog: Quasar.plugins.Dialog,
      },
    });

    /* ── STATUS_COLOR_MAP — use in getStatusColor(status) ── */
    const STATUS_COLOR_MAP = {
      'Created':                            '#ececec',
      'Completed':                          '#ebf5e8',
      'Released':                           '#ebf5e8',
      'Completed - Short Picked':           '#ebf5e8',
      'Active':                             '#ebf5e8',
      'Open':                               '#ebf5e8',
      'Cancelled':                          '#ffd8d7',
      'Unfulfillable':                      '#ffd8d7',
      'Abandoned':                          '#ffd8d7',
      'Failed':                             '#ffd8d7',
      'Completed - Cancelled':              '#ffd8d7',
      'Offline':                            '#ffd8d7',
      'Error':                              '#ffd8d7',
      'In Progress':                        '#ffeedc',
      'Staging In Progress':                '#ffeedc',
      'Cancellation In Progress':           '#ffeedc',
      'In Progress | Picking from Rack':    '#ffeedc',
      'In Progress | Picking from Tote':    '#ffeedc',
      'Staged Failed':                      '#ffeedc',
      'Put In Progress':                    '#ffeedc',
      'On Hold - Audit blocked':            '#ffeedc',
      'On Hold- Pending Inventory':         '#ffeedc',
      'Pending':                            '#ffeedc',
      'In Maintenance':                     '#ffeedc',
      'Approved':                           '#ebf5e8',
      'Rejected':                           '#ffd8d7',
      'Paused':                             '#ffeedc',
    };

    /* ── Vue instance — fill in data, computed, methods, template ── */
    new Vue({
      el: '#q-app',

      data() {
        return {
          /* ── reactive state ── */
          rows: [],           // table rows — fill with ticket-specific data
          loading: false,
          selected: [],       // multi-select
          pagination: { page: 1, rowsPerPage: 50, rowsNumber: 0 },
          totalRecords: 0,
          filterOpen: false,
          detailOpen: false,
          selectedRow: null,
          /* add ticket-specific fields here */
        };
      },

      computed: {
        /* add computed properties as needed */
        columns() {
          return [
            /* define ticket-specific columns here */
          ];
        },
      },

      methods: {
        getStatusColor(status) {
          return STATUS_COLOR_MAP[status] || '#ececec';
        },
        viewDetails(row) {
          this.selectedRow = row;
          this.detailOpen = true;
        },
        /* add ticket-specific methods here */
      },

      template: `
        <!-- Use SNIPPET: vue-listing-page as starting point -->
        <q-layout view="hHh lpr fFf">
          <!-- header, tabs, page content go here -->
        </q-layout>
      `,
    });
  </script>
</body>
</html>
```

---

## SECTION 2: CUSTOM APP CSS

Copy this entire block verbatim into the `<style>` tag. These are compiled from the real
`manager-dashboard/mdui/src/css/app.scss` — they extend Quasar's built-in CSS with
Manager Dashboard–specific overrides.

```css
/* ── Global font override ──
   Quasar 1 UMD sets body { font-family: Roboto, ... } — we must override it.
   Real app uses SourceSansPro OTF; CDN equivalent = 'Source Sans Pro' (NOT 'Source Sans 3').
   Apply to body AND * so Quasar component inner elements are also covered. */
body, * {
  font-family: 'Source Sans Pro', 'Helvetica Neue', Arial, sans-serif !important;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body { font-size: 14px; line-height: 1.5; }

/* ── text-custom-grey utility (equivalent to Quasar text-grey-9 but app-specific) ── */
.text-custom-grey { color: #4D5055; }

/* ── md-v2-table — v2 listing page table overrides ── */
.md-v2-table .q-table__top {
  background-color: #FFFFFF;
  color: #4D5055;
  padding: 0;
  font-weight: 600;
}
.md-v2-table thead tr:first-child th {
  background-color: #F6F6F6;
  color: #4D5055;
  padding: 8px;
  font-size: 13px;
  border-right: solid 0.5px lightgrey;
}
.md-v2-table thead tr:first-child th:last-child { border-right: none; }
.md-v2-table thead tr th { position: sticky; z-index: 1; }
.md-v2-table thead tr:last-child th { top: 48px; }
.md-v2-table thead tr:first-child th { top: 0; }
.md-v2-table.q-table__card { box-shadow: none !important; border-radius: 0; }
.md-v2-table .q-table th { border-color: #e0e0e0; }
.md-v2-table tbody { color: #4D5055; font-weight: 600; }
.md-v2-table .q-td { font-weight: 600; color: #4D5055; }

/* ── md-table — v1 legacy table overrides ── */
.md-table thead tr:first-child th { background-color: #f5f5f5; color: #212121; }
.md-table thead tr th { position: sticky; z-index: 1; }
.md-table thead tr:last-child th { top: 48px; }
.md-table thead tr:first-child th { top: 0; }
.md-table.q-table__card { box-shadow: none !important; border-radius: 0; }

/* ── my-sticky-column-table — sticky first two columns ── */
.my-sticky-column-table thead tr:first-child th { position: sticky; top: 0; z-index: 1; }
.my-sticky-column-table th:first-child,
.my-sticky-column-table td:first-child {
  position: sticky; left: 0; z-index: 2;
  width: 75px; min-width: 75px; max-width: 75px;
}
.my-sticky-column-table th:nth-child(2),
.my-sticky-column-table td:nth-child(2) {
  position: sticky; left: 75px; z-index: 2;
}
.my-sticky-column-table td:first-child,
.my-sticky-column-table td:nth-child(2) { background-color: #FFFFFF; }
.my-sticky-column-table thead tr:first-child th:first-child,
.my-sticky-column-table thead tr:first-child th:nth-child(2) { z-index: 4; }
.my-sticky-column-table thead tr:first-child th:nth-child(n+3) { z-index: 3; }

/* ── Expandable rows ── */
.row-expanded .q-td { background-color: #FFF6ED; }
.expanded-td { background-color: #FFFCF8; padding: 0 !important; }
.expanded-table .q-td { background-color: #FFFCF8; }
.expanded-table th:nth-child(2),
.expanded-table td:nth-child(2) { left: 0; }

/* ── custom-pagination — page button styling ── */
.custom-pagination .q-btn {
  min-width: 3em !important;
  height: 30px;
  color: #4D5055;
  font-size: 12px !important;
  border: solid 1px #E7E7E7;
  border-radius: 2px;
  margin: 2px;
  font-weight: 600;
}

/* ── smaller-input — compact 35px inputs for filter bars ── */
.smaller-input .q-field__control {
  min-height: 35px !important; height: 35px !important;
  padding: 0 0 0 8px !important;
  border: solid 1px #E7E7E7;
}
.smaller-input .q-field__marginal { height: 35px !important; }
.smaller-input .q-field__control::before,
.smaller-input .q-field__control::after { display: none !important; }

/* ── Dialog width utilities ── */
.dialog-35 .q-dialog__inner--minimized > div { max-width: 35vw !important; min-width: 35vw !important; }
.dialog-40 .q-dialog__inner--minimized > div { max-width: 40vw !important; min-width: 40vw !important; }
.dialog-70 .q-dialog__inner--minimized > div { max-width: 70vw !important; min-width: 70vw !important; }
.dialog-100 .q-dialog__inner--minimized > div { max-width: 100% !important; }

/* ── q-table global font weight ── */
.q-table th { font-weight: 600; }
.q-dialog__inner--minimized > div { max-width: 100% !important; }

/* ── Force left-align on ALL q-table data cells ──
   Quasar adds text-right class to columns with align:'right'.
   Right-aligned text wider than the cell clips from the LEFT (shows "nal" not "Normal").
   Override to left for ALL data columns — only explicitly center action-icon cells if needed. */
.q-table tbody td { text-align: left !important; }
.q-table thead th { text-align: left !important; }
/* Quasar's own text-right class must not apply to data cells */
.q-table tbody td.text-right { text-align: left !important; }
.q-table thead th.text-right { text-align: left !important; }
```

---

## SECTION 3: VUE / QUASAR SNIPPETS

Use these snippets as building blocks. Replace placeholder data with ticket-specific content.

---

### SNIPPET: vue-listing-page

Full listing page layout. Paste into `template: \`...\``.

```html
<q-layout view="hHh lpr fFf">

  <!-- ── Top bar (56px white) ── -->
  <q-header bordered class="bg-white text-dark" style="height:56px;">
    <q-toolbar>
      <q-toolbar-title class="row items-center no-wrap" style="gap:8px;">
        <!-- Official GreyOrange logo — copy exactly from component library -->
        <img src="GREYORANGE_LOGO_DATA_URI" alt="GreyOrange" class="topbar-logo-img" height="28" style="height:28px;width:auto;" />
        <span style="font-weight:700;color:#FE8400;font-size:15px;">Manager Dashboard</span>
      </q-toolbar-title>
      <q-btn flat round icon="notifications" color="dark" />
      <q-btn flat round icon="language" color="dark" />
      <q-avatar size="32px" color="primary" text-color="white" class="q-ml-sm" style="cursor:pointer;">
        <span style="font-size:12px;font-weight:600;">MC</span>
      </q-avatar>
    </q-toolbar>
  </q-header>

  <!-- ── Primary nav tabs (44px navy) ── -->
  <q-header style="top:56px;">
    <q-tabs v-model="activeTab" class="bg-primary text-white"
            indicator-color="secondary" dense mobile-arrows align="left">
      <q-tab name="analytics"  label="ANALYTICS" />
      <q-tab name="outbound"   label="OUTBOUND" />
      <q-tab name="inbound"    label="INBOUND" />
      <q-tab name="audit"      label="AUDIT" />
      <q-tab name="exceptions" label="PROCESS EXCEPTIONS" />
      <q-tab name="inventory"  label="INVENTORY" />
      <q-tab name="system"     label="SYSTEM" />
    </q-tabs>

    <!-- ── Sub-tab bar (38px white, optional) ── -->
    <q-tabs v-model="activeSubTab" class="bg-white text-dark"
            indicator-color="secondary" dense align="left" style="border-bottom:1px solid #d4d3d3;">
      <q-tab name="listing"  label="Listing" />
      <q-tab name="summary"  label="Summary" />
    </q-tabs>

    <!-- ── Section banner (40px navy) ── -->
    <div class="bg-primary text-white row items-center q-px-md" style="height:40px;font-size:13px;">
      <span style="font-weight:600;">Page Title</span>
      <span class="q-ml-md" style="font-weight:400;color:rgba(255,255,255,0.8);">
        | Results: <strong>{{ totalRecords }}</strong>
        | In Progress: <strong>{{ rows.filter(r=>r.status==='In Progress').length }}</strong>
      </span>
    </div>
  </q-header>

  <!-- Left filters — outer layout drawer so it covers the full page under the navbar -->
  <q-drawer v-model="filterOpen" side="left" bordered overlay :width="280">
    <div class="q-pa-md">
      <div class="text-weight-bold q-mb-md" style="font-size:14px;color:#101a5c;">Filters</div>
      <!-- add q-checkbox or q-radio filter options here -->
    </div>
  </q-drawer>

  <q-page-container style="padding-top:152px;"><!-- 56 + 44 + 38 + 40 = 178 or adjust -->
    <q-page style="background:#F5F5F5;padding:8px;">

      <!-- ── Main table card ── -->
      <q-card flat bordered :class="isFullScreen ? 'q-mt-none' : 'q-mt-sm'">
        <q-layout class="no-shadow" view="hHh lpr fFf" style="min-height:100%;">
          <q-separator />
          <div class="col" style="height:calc(100vh - 220px); overflow:auto;">

            <q-table
              class="no-shadow md-v2-table fit my-sticky-column-table"
              :data="rows"
              :columns="columns"
              row-key="id"
              selection="multiple"
              :selected.sync="selected"
              separator="horizontal"
              hide-selected-banner
              hide-pagination
              :rows-per-page-options="[0]"
              dense
              color="primary"
              :loading="loading"
            >
              <!-- ── Toolbar slot ── -->
              <template v-slot:top="">
                <!-- Row 1: stats summary + utility buttons -->
                <div class="row full-width q-pa-xs">
                  <div class="col q-pa-none q-pr-md text-custom-grey" style="font-size:13px;font-weight:600;">
                    Domain Listing
                    <span style="font-weight:400;"> | Results: </span><strong>{{ totalRecords }}</strong>
                  </div>
                  <q-space />
                  <q-btn flat round dense padding="xs" class="q-mr-sm" color="primary" size="sm" @click="loading=!loading">
                    <q-icon name="refresh" size="sm" />
                    <q-tooltip>Refresh</q-tooltip>
                  </q-btn>
                  <q-btn flat round dense padding="xs" color="primary" size="sm">
                    <q-icon name="fullscreen" size="sm" />
                  </q-btn>
                </div>
                <q-separator class="bg-grey-4 full-width q-mb-sm" />

                <!-- Row 2: filter pill + search (NO record count here) -->
                <div class="row full-width q-pl-sm q-mb-sm" style="gap:8px;">
                  <!-- Filter pill -->
                  <div class="q-btn inline relative-position q-tab--no-caps justify-center"
                       style="border:1px solid #E7E7E7;border-radius:2px;cursor:pointer;padding:0 8px;height:32px;display:flex;align-items:center;"
                       @click="filterOpen=!filterOpen">
                    <q-icon name="filter_list" size="xs" class="q-mr-xs text-custom-grey" />
                    <span class="text-custom-grey text-weight-medium text-body2">Filter</span>
                  </div>
                  <!-- Search field dropdown + input -->
                  <q-btn-dropdown color="grey-2" unelevated text-color="grey-9"
                                  class="text-body2 smaller-input" no-caps style="border:1px solid #E7E7E7;">
                    <template v-slot:label>
                      <span class="text-custom-grey text-weight-medium">ID</span>
                    </template>
                    <q-list separator>
                      <q-item clickable v-close-popup><q-item-section class="text-body2">Order ID</q-item-section></q-item>
                      <q-item clickable v-close-popup><q-item-section class="text-body2">Status</q-item-section></q-item>
                    </q-list>
                  </q-btn-dropdown>
                  <q-input color="secondary" debounce="300" dense outlined
                           class="smaller-input text-body2" placeholder="Search..." style="min-width:180px;">
                    <template v-slot:prepend><q-icon name="search" class="text-custom-grey" /></template>
                  </q-input>
                  <q-space />
                  <q-btn flat round dense padding="xs" color="primary" size="md">
                    <q-icon name="tune" size="sm" />
                    <q-tooltip>Configure columns</q-tooltip>
                  </q-btn>
                  <q-btn flat round dense padding="xs" color="primary" size="md">
                    <q-icon name="file_download" size="sm" />
                    <q-tooltip>Export</q-tooltip>
                  </q-btn>
                </div>
              </template>

              <!-- ── Status cell ── -->
              <template v-slot:body-cell-status="props">
                <q-td :props="props">
                  <q-chip dense size="sm" class="q-ma-none"
                          :style="\`background-color:\${getStatusColor(props.row.status)};font-size:12px;\`">
                    {{ props.row.status }}
                  </q-chip>
                </q-td>
              </template>

              <!-- ── Priority cell — PLAIN TEXT, never a chip ── -->
              <!-- Critical = red text (text-negative). Normal = plain text.
                   Using q-chip for priority causes left-side clipping in narrow columns. -->
              <template v-slot:body-cell-priority="props">
                <q-td :props="props">
                  <span v-if="props.row.priority === 'Critical'"
                        style="color:#ED3324; font-weight:400;">Critical</span>
                  <span v-else style="font-weight:400;">{{ props.row.priority || 'Normal' }}</span>
                </q-td>
              </template>

              <!-- ── Actions cell ── -->
              <template v-slot:body-cell-actions="props">
                <q-td :props="props">
                  <div class="flex q-gutter-xs">
                    <q-btn flat round dense padding="xs" color="primary" size="sm"
                           @click="viewDetails(props.row)">
                      <q-icon name="description" size="2em" />
                      <q-tooltip>View Details</q-tooltip>
                    </q-btn>
                    <q-separator vertical />
                    <q-btn flat round dense padding="xs" color="primary" size="sm">
                      <q-icon name="edit" size="2em" />
                      <q-tooltip>Edit</q-tooltip>
                    </q-btn>
                  </div>
                </q-td>
              </template>

              <!-- ── Empty state ── -->
              <template v-slot:no-data="">
                <div class="row justify-center q-mt-sm q-mb-md full-width">
                  <span v-if="totalRecords === 0">No records found</span>
                  <q-spinner-gears v-else color="primary" size="25px" />
                </div>
              </template>
            </q-table>

            <!-- ── Pagination bar (outside q-table) ── -->
            <div v-if="totalRecords > 0"
                 class="row items-center justify-between full-width bg-white q-px-sm"
                 style="border-top:1px solid #e0e0e0;min-height:40px;">
              <div class="text-weight-medium text-custom-grey">
                {{ totalRecords }} results found
              </div>
              <div class="row items-center">
                <span class="q-mr-sm text-body2">Results per page:</span>
                <q-select v-model="pagination.rowsPerPage" :options="[50, 100, 200]"
                          dense flat borderless emit-value map-options
                          style="width:55px;min-width:0;" />
                <q-pagination :value="pagination.page"
                              :max="Math.ceil(totalRecords / pagination.rowsPerPage) || 1"
                              :max-pages="6"
                              direction-links
                              color="grey"
                              active-color="secondary"
                              class="custom-pagination"
                              @input="p => pagination.page = p" />
              </div>
            </div>

          </div><!-- end col -->

          <!-- Right detail drawer stays inside the card layout -->
          <q-drawer v-model="detailOpen" side="right" :width="450" bordered>
            <div style="font-size:13px;display:flex;flex-direction:column;height:100%;">
              <div style="flex-shrink:0;">
                <div class="q-pa-xs row justify-between items-center text-weight-bold text-grey-9"
                     style="font-size:16px;">
                  <span>{{ selectedRow ? selectedRow.id : 'Details' }}</span>
                  <q-btn flat dense rounded icon="close" @click="detailOpen=false" />
                </div>
                <q-separator class="q-mb-sm" />
              </div>
              <div style="flex:1;overflow-y:auto;padding:8px 12px;" v-if="selectedRow">
                <!-- Detail content: label-value pairs -->
                <div v-for="(val, key) in selectedRow" :key="key" class="row q-mb-xs">
                  <div class="col-5 text-grey-7" style="font-size:12px;">{{ key }}</div>
                  <div class="col-7 text-custom-grey" style="font-size:13px;font-weight:600;">{{ val }}</div>
                </div>
              </div>
            </div>
          </q-drawer>

        </q-layout>
      </q-card>

    </q-page>
  </q-page-container>
</q-layout>
```

---

### SNIPPET: vue-modal

```html
<!-- In data(): showModal: false, modalTitle: 'Confirm Action' -->
<q-dialog v-model="showModal" persistent class="dialog-40">
  <q-card style="min-width:400px;">
    <!-- Navy header -->
    <q-card-section class="bg-primary text-white row items-center q-pa-md">
      <span class="text-subtitle1 text-weight-bold">{{ modalTitle }}</span>
      <q-space />
      <q-btn icon="close" flat round dense color="white" v-close-popup />
    </q-card-section>

    <!-- Body -->
    <q-card-section class="q-pa-lg">
      <p style="font-size:14px;color:#4D5055;margin-bottom:12px;">
        Please confirm the action. This cannot be undone.
      </p>
      <!-- form fields using q-input, q-select, q-radio -->
    </q-card-section>

    <!-- Footer -->
    <q-card-actions align="right" class="q-px-md q-pb-md">
      <q-btn label="CANCEL" outline color="dark" v-close-popup />
      <q-btn label="PROCEED" color="secondary" text-color="white" unelevated @click="confirmAction" />
    </q-card-actions>
  </q-card>
</q-dialog>
```

---

### SNIPPET: vue-status-chip

```html
<!-- Standalone status chip — use in any table cell or card -->
<q-chip
  dense
  size="sm"
  class="q-ma-none"
  :style="\`background-color:\${getStatusColor(row.status)};font-size:12px;\`"
>
  {{ row.status }}
</q-chip>
```

---

### SNIPPET: vue-action-buttons

```html
<!-- Row action buttons — flat round, no border, primary color -->
<div class="flex q-gutter-xs">
  <q-btn flat round dense padding="xs" color="primary" size="sm" @click="viewDetails(row)">
    <q-icon name="description" size="2em" />
    <q-tooltip>View Details</q-tooltip>
  </q-btn>
  <q-separator vertical />
  <q-btn flat round dense padding="xs" color="primary" size="sm" @click="editRow(row)">
    <q-icon name="edit" size="2em" />
    <q-tooltip>Edit</q-tooltip>
  </q-btn>
  <q-separator vertical />
  <q-btn flat round dense padding="xs" color="primary" size="sm">
    <q-icon name="more_vert" size="2em" />
    <q-menu>
      <q-list style="min-width:180px;">
        <q-item clickable v-close-popup><q-item-section>Action A</q-item-section></q-item>
        <q-item clickable v-close-popup><q-item-section>Action B</q-item-section></q-item>
      </q-list>
    </q-menu>
  </q-btn>
</div>
```

---

## SECTION 4: STATUS_COLOR_MAP (for getStatusColor method)

```javascript
getStatusColor(status) {
  const map = {
    'Created':                         '#ececec',
    'Completed':                       '#ebf5e8',
    'Released':                        '#ebf5e8',
    'Completed - Short Picked':        '#ebf5e8',
    'Active':                          '#ebf5e8',
    'Open':                            '#ebf5e8',
    'Approved':                        '#ebf5e8',
    'Cancelled':                       '#ffd8d7',
    'Unfulfillable':                   '#ffd8d7',
    'Abandoned':                       '#ffd8d7',
    'Failed':                          '#ffd8d7',
    'Completed - Cancelled':           '#ffd8d7',
    'Offline':                         '#ffd8d7',
    'Rejected':                        '#ffd8d7',
    'In Progress':                     '#ffeedc',
    'Staging In Progress':             '#ffeedc',
    'Cancellation In Progress':        '#ffeedc',
    'On Hold - Audit blocked':         '#ffeedc',
    'On Hold- Pending Inventory':      '#ffeedc',
    'Pending':                         '#ffeedc',
    'In Maintenance':                  '#ffeedc',
    'Paused':                          '#ffeedc',
  };
  return map[status] || '#ececec';
},
```
