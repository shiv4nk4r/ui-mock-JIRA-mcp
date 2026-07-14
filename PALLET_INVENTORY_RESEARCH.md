# Pallet Inventory Listing - Research Report

## 1. EXISTING INVENTORY LISTING COMPONENTS (Top 6)

### Component 1: Exception Listing Template
- **File Path:** `/Users/manish.c/workplace/ui-mock-JIRA-mcp/src/templates/exception-listing.ts`
- **Type:** Listing/Table component with filters and pagination
- **Technology:** HTML/Vue 2 + Quasar v1.20.1
- **Column Definitions:**
  - id (Exception ID) - searchable, sortable
  - sku (SKU ID) - searchable, sortable
  - type (Type) - sortable
  - zone (Zone) - non-sortable
  - priority (Priority) - sortable, filterable
  - status (Status) - sortable, filterable
  - createdAt (Created) - sortable
  - actions (Actions) - menu-based

- **Status Enum Values:** Open, In Progress, Resolved, Closed
- **Filter Implementation:** Dropdown selects for priority/status + global search
- **GraphQL Pattern:** Standard listing query with filter/pagination args
- **Action Buttons:** Three-dot menu with: View Details, Assign, Close

### Component 2: Shift Planner Template
- **File Path:** `/Users/manish.c/workplace/ui-mock-JIRA-mcp/src/templates/shift-planner.ts`
- **Pattern:** Similar exception listing with Quasar q-table
- **Features:** Search, filters, pagination, status changes

### Reference: Tool Listing (External GreyOrange codebase)
- **Document:** TOOL-LISTING-SEARCH-RESULTS.md
- **Column Definitions:**
  - serialNumber (Serial Number) - 150px, searchable
  - name (Tool Template) - 200px, searchable
  - type (Type) - 120px, filterable
  - brandModel (Brand & Model) - 180px, searchable
  - assignedUserName (User) - 120px, searchable
  - mode (Mode/Status) - 160px, filterable, color-coded
  - actions (Actions) - 80px, status transitions menu

- **Status Enum Values:** AVAILABLE, ASSIGNED, OFFLINE, IN_MAINTENANCE, CHARGING, MARKED_LOST, DECOMMISSIONED, ONLINE
- **Status Color Map:**
  - AVAILABLE/ONLINE: #ebf5e8 (light green)
  - OFFLINE: #EFEFEF (light grey)
  - IN_MAINTENANCE/CHARGING: #FEFFD3 (light yellow)
  - MARKED_LOST/DECOMMISSIONED: #FFDDDD (light red)

- **GraphQL Queries:**
  - TOOL_LIST_QUERY returns {total: Int, tools: [ToolItem]}
  - TOOL_TYPES_QUERY returns tool type definitions

- **GraphQL Mutations:**
  - updateToolStatus(toolId, toolStatus)
  - createTool(serialNumber, toolTypeId)
  - deleteTool(toolId)
  - unassignTool(toolId)

### Component 3: Form Card Template
- **File Path:** `/src/templates/form-card.ts`
- **Pattern:** Input forms with validation

### Component 4: Dashboard Overview Template
- **File Path:** `/src/templates/dashboard-overview.ts`
- **Pattern:** KPI cards and summary stats

### Component 5: Alert List Template
- **File Path:** `/src/templates/alert-list.ts`
- **Pattern:** Notification/alert listing

### Component 6: Navigation Context
- **File Path:** `/src/templates/nav.ts`
- **Pattern:** L1 tabs and sub-tab navigation structure

---

## 2. FILTER IMPLEMENTATION PATTERNS

### Global Search
- Quasar `q-input` with `dense outlined` modifiers
- Material icon: `search` prepended
- Debounce: 500ms
- Applied across multiple key fields

### Dropdown Filters
- Quasar `q-select` with `dense outlined` modifiers
- Clearable (X button)
- Applied to enum fields (status, priority, type)
- Options from unique column values

### Filter Bar Layout (Strict Pattern)
- **Row 1 (Stats):** Domain label + Total results count + status breakdown counts + utility buttons (refresh, fullscreen)
- **Row 2 (Filters):** Filter pill toggle + field selector dropdown + search input + spacer + export/config buttons
- Separator line between rows

### Filter Visibility Toggle
- "Filter" button with icon `filter_list`
- Shows active filter count as chip
- Toggles left drawer with detailed filters

---

## 3. COLUMN CONFIGURATION STRUCTURE

```javascript
{
  name: 'fieldName',              // unique identifier
  label: 'Display Label',          // visible header
  field: 'fieldName',             // data source property
  align: 'left',                  // ALWAYS 'left' for data columns
  sortable: true/false,           // enables sort triangles
  headerStyle: 'min-width: 200px' // width via inline style
}
```

### Critical Rules:
- ALL data columns use `text-align: left` (never right/center)
- Status never uses chips for priority (plain span)
- Status uses dense q-chip with inline background color
- Colors from predefined STATUS_COLOR_MAP (no invented hex)

---

## 4. STATUS ENUM VALUES FOR PALLETS

Inferred from warehouse operations context:
- **AVAILABLE** - Ready for use/allocation
- **IN_TRANSIT** - Currently moving/transporting
- **IN_STORAGE** - Stored at location
- **STAGED** - Prepared for outbound
- **DAMAGED** - Requires repair/disposition
- **QUARANTINED** - On hold/under review
- **ARCHIVED** - End of life/retired
- **ASSIGNED** - Allocated to specific area
- **LOST** - Missing/unaccounted
- **PENDING_VERIFICATION** - Awaiting confirmation

---

## 5. ACTION BUTTON PATTERNS

### Standard Button Styling:
```html
<q-btn flat round dense padding="xs" color="primary" size="sm" @click="action">
  <q-icon name="icon_name" size="sm" />
  <q-tooltip>Tooltip Text</q-tooltip>
</q-btn>
```

- **Modifiers:** flat round dense (never outline/square)
- **Size:** sm (26x26px icon buttons)
- **Color:** primary (navy)
- **Icons:** Material Icons or Material Symbols

### Common Actions:
1. **View Details** - `sym_o_description` or `visibility`
2. **Edit** - `mode_edit` or `edit`
3. **Delete** - `delete` or `close`
4. **Change Status** - Dropdown menu
5. **Assign** - `person_add`
6. **Unassign** - `person_remove`
7. **Export** - `file_download`
8. **Refresh** - `refresh`

### Dropdown Menu (Status Transitions):
```html
<q-btn flat round dense icon="more_vert">
  <q-menu>
    <q-list dense>
      <q-item clickable v-close-popup>
        <q-item-section>Action Label</q-item-section>
      </q-item>
    </q-list>
  </q-menu>
</q-btn>
```

### Row Action Grouping:
- Flex container: `<div class="flex q-gutter-xs">`
- Separators between groups: `<q-separator vertical />`

---

## 6. GRAPHQL QUERY STRUCTURE FOR PALLET DATA

### Standard List Query Pattern:
```graphql
query palletList($filter: PalletFilter, $pagination: PaginationInput) {
  palletList(filter: $filter, pagination: $pagination) {
    total: Int
    pallets: [
      {
        id: String
        code: String           # barcode/identifier
        status: String         # enum value
        location: String       # zone/aisle/bin
        weight: Float
        createdAt: DateTime
        updatedAt: DateTime
        assignedTo: String     # optional user/area
      }
    ]
  }
}
```

### Mutation Patterns:
```graphql
mutation updatePalletStatus($input: UpdatePalletStatusInput!) {
  updatePalletStatus(input: $input) {
    success: Boolean
    message: String
    pallet: Pallet
  }
}

mutation createPallet($input: CreatePalletInput!) {
  createPallet(input: $input) {
    success: Boolean
    message: String
    palletId: String
  }
}

mutation deletePallet($palletId: String!) {
  deletePallet(palletId: $palletId) {
    success: Boolean
    message: String
  }
}
```

### Filter Input Type:
```graphql
input PalletFilter {
  status: [String]           # enum values
  location: [String]         # zone/aisle IDs
  dateRange: DateRangeInput  # createdAt filtering
  searchTerm: String         # global search
}
```

---

## 7. NAVIGATION CONTEXT (Site Map)

### Inventory Module Routes:
- **Base Route:** `/inventory`
- **Sub-tabs:**
  - `/inventory/products` - SKU/inventory listing (inventoryListing)
  - `/inventory/tagChange` - Storage tag management (tagChange)
  - `/inventory/storage-utilisation` - Slot utilization (storageUtilisation)
  - `/inventory/gtp-master-product` - Master product listing (productMaster)
  - `/inventory/stale-inventories` - Stale inventory tracking (staleInventories)

### L1 Tab Navigation (from nav.ts):
- **activeTab:** "inventory"
- **activeSubTab:** varies by page
- **subTabs:** array of SubTab objects {name, label}
- **pageTitle:** e.g., "Inventory — Products"

### Sub-routes (Detail pages):
- `/inventory/products/:id` - Product detail view
- `/inventory/recall` - Inventory recall page

---

## 8. QUASAR COMPONENTS USED

### Table & Data Grid:
- `q-table` - Main data grid (flat dense properties)
- `q-tr` / `q-td` - Row and cell elements
- `q-chip` - Status badge display (dense size="sm")
- `q-icon` - Material Icons integration

### Filters & Search:
- `q-select` - Dropdown filter (dense outlined clearable)
- `q-input` - Search input (dense outlined with debounce)
- `q-btn-dropdown` - Segmented search field selector

### Actions & Menus:
- `q-btn` - Action buttons (flat round dense)
- `q-menu` - Dropdown menu for actions
- `q-list` / `q-item` - Menu item list

### Layout:
- `q-layout` - Page wrapper (view="hHh lpr fFf")
- `q-drawer` - Left/right filter sidebar
- `q-separator` - Visual dividers
- `q-toolbar` - Top bar layout
- `q-page` - Page content area

---

## 9. DESIGN SYSTEM TOKENS (design.md)

### Color Palette:
| Token | Value | Usage |
|-------|-------|-------|
| --primary | #101a5c | Navy, top bar, buttons |
| --secondary | #FE8400 | Orange, active indicators |
| --positive | #66bb6a | Green, success status |
| --negative | #ED3324 | Red, error/warning |
| --info | #2982cc | Blue, informational |
| --warning | #f9b115 | Yellow, warning status |
| --dark | #636f83 | Dark grey, text |
| --body-text | #4D5055 | Table cell text |
| --border | #E7E7E7 | Filter/input borders |
| --page-bg | #F5F5F5 | Page background |
| --card-bg | #FFFFFF | Card/table background |

### Typography:
- **Font Family:** Source Sans Pro (NOT Source Sans 3)
- **Font Sizes:** 13px (labels), 14px (body), 12px (secondary)
- **Font Weights:** 400 (regular), 600 (semi-bold), 700 (bold)
- **CDN Link:** `https://fonts.googleapis.com/css2?family=Source+Sans+Pro:ital,wght@0,300;0,400;0,600;0,700;1,400&display=swap`

### Layout Dimensions:
- Top bar height: 56px
- Primary nav height: 44px
- Sub-tab nav height: 38px
- Section banner height: 40px
- Table header height: 40px
- Table row height: 40px (compact)

---

## 10. KEY FILE PATHS - CONTEXT DOCUMENTS

| Resource | File Path |
|----------|-----------|
| **Design System** | `/src/mcp-context/design.md` |
| **Component Library** | `/src/mcp-context/component-library.md` |
| **Architecture & Tech Stack** | `/src/mcp-context/context.md` |
| **Routing & Page Hierarchy** | `/src/mcp-context/site-map.md` |
| **Tool Listing Reference** | `TOOL-LISTING-SEARCH-RESULTS.md` |
| **Exception Listing Template** | `/src/templates/exception-listing.ts` |
| **Shift Planner Template** | `/src/templates/shift-planner.ts` |
| **Template Index** | `/src/templates/index.ts` |
| **Navigation Context** | `/src/templates/nav.ts` |
| **Inventory Screenshots** | `/src/mcp-context/inventory-*.png` |

---

## SUMMARY - PALLET LISTING DEVELOPMENT PATTERNS

### 1. Reuse Exception Listing Architecture
- Nearly identical structure for pallet/inventory listings
- Table with global search, dropdown filters, pagination
- Action buttons with dropdown menus

### 2. Status Enum with State Machine
- Use Tool Listing pattern for status transitions
- Define allowed transitions from each state
- Render as dropdown menu in actions column
- Color-code statuses with predefined hex map

### 3. Filter Bar Structure (Critical)
- **Row 1:** Domain label + result count + status breakdowns + refresh/fullscreen buttons
- **Row 2:** Filter pill (with count chip) + field selector dropdown + search input + spacer + export/config
- Separator between rows (1px solid #E7E7E7)

### 4. Search Implementation
- Global text search on 2-3 key fields (barcode/code, ID, location)
- Debounce 500ms
- Combined with field selector dropdown for segmented search

### 5. Column Configuration
- 8-10 columns max (code, status, location, weight, assignedTo, createdAt, etc.)
- ALL columns use `align: 'left'`
- Use headerStyle for width constraints
- Sortable flag for numeric/date columns

### 6. GraphQL Integration
- Standard query: palletList(filter, pagination) returns {total, pallets}
- Mutations: updateStatus, create, delete with consistent response type
- Filter input supports status enum, location array, date range, search term

### 7. Color & Styling
- Use predefined STATUS_COLOR_MAP (no invented hex values)
- Colors: green (#ebf5e8) for available, yellow (#FEFFD3) for pending, red (#FFDDDD) for critical
- Typography: Source Sans Pro, 13px body text, 600 font-weight for table cells

### 8. Action Patterns
- Flat round icon buttons (26x26px, sm size)
- Group with flex container and q-gutter-xs
- Status changes via three-dot menu (q-menu with q-list)
- Tooltips on hover

### 9. Navigation Context
- activeTab: "inventory"
- activeSubTab: context-specific
- Include in section banner title

### 10. Reusable Base CSS
- Copy component-library.md BASE CSS BLOCK verbatim
- Quasar CDN links for icons and fonts
- No custom CSS for colors or typography unless ticket-specific
