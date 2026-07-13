# Tool Listing Page - Manager Dashboard Search Results

## Overview
Comprehensive tool listing implementation in the manager-dashboard codebase (pm-mcp directory). Includes Vue components, GraphQL queries/mutations, status management constants, and backend model layer.

---

## 1. Main Vue Component for Tool Listing

**File:** `/Users/shivankar.s/gor/poc-mcp/pm-mcp/.repos/manager-dashboard/mdui/src/pages/shift-planning/ToolListing.vue`

Parent page component that:
- Loads tool list and tool types on `created()`
- Passes data to `ToolList` child component
- Handles tool creation, status changes, and unassignment via mutations
- Uses Apollo GraphQL client

**Key Methods:**
- `fetchTools()` - Queries TOOL_LIST_QUERY
- `handleChangeStatus({toolId, toolStatus})` - Calls UPDATE_TOOL_STATUS_MUTATION
- `handleUnassignTool({toolId})` - Calls UNASSIGN_TOOL_MUTATION
- `handleCreateTool({serialNumber, toolTypeId})` - Calls CREATE_TOOL_MUTATION
- `fetchToolTypes()` - Queries TOOL_TYPES_QUERY

---

## 2. Tool List Component (Table UI)

**File:** `/Users/shivankar.s/gor/poc-mcp/pm-mcp/.repos/manager-dashboard/mdui/src/components/shift-planning/tool-listing/ToolList.vue`

Child component rendering the Quasar q-table with tool data.

### Column Definitions (from data.columns array):

| Column | Label | Field | Searchable | Filterable | Width | Features |
|--------|-------|-------|-----------|-----------|-------|----------|
| serialNumber | Serial Number | serialNumber | ✓ | - | 150px | Search by serial |
| name | Tool Template | name | ✓ | - | 200px | Tool type name |
| type | Type | type | - | ✓ | 120px | MHE type, filterable |
| brandModel | Brand & Model | brand, model | ✓ | - | 180px | Combined display |
| assignedUserName | User | user | ✓ | - | 120px | Assigned user name |
| mode | Mode | mode | - | ✓ | 160px | Status w/ color chip |
| actions | Actions | - | - | - | 80px | Transition menu + delete |

### Key Features:
- **Global search** - keyword search on name, serialNumber
- **Column-level search** - per-column input popups
- **Column filtering** - checkboxes for unique values per filterable column
- **Pagination** - 50/100/200 rows per page options
- **Status transitions** - dropdown menu with allowed state transitions
- **Tool deletion** - delete button in actions
- **Create tool dialog** - form to create new tool
- **Dynamic filters** - filter dropdowns generated from unique column values

---

## 3. GraphQL Queries

**File:** `/Users/shivankar.s/gor/poc-mcp/pm-mcp/.repos/manager-dashboard/mdui/src/graphql/queries/shift-planning/tool-list.js`

```graphql
query toolList {
  toolList {
    total
    tools {
      toolId
      name
      serialNumber
      type
      brand
      model
      user
      mode
    }
  }
}

query toolTypes {
  toolTypes {
    id
    name
  }
}
```

---

## 4. Tool Status & Mode Definitions

**File:** `/Users/shivankar.s/gor/poc-mcp/pm-mcp/.repos/manager-dashboard/mdui/src/constants/tool.js`

### Status Transitions (State Machine):

```javascript
TOOL_STATUS_TRANSITIONS = {
  AVAILABLE: [IN_MAINTENANCE, CHARGING, MARKED_LOST, OFFLINE, DECOMMISSIONED],
  ASSIGNED: [AVAILABLE (unassign), IN_MAINTENANCE, CHARGING, OFFLINE, DECOMMISSIONED],
  OFFLINE: [AVAILABLE, IN_MAINTENANCE, CHARGING, MARKED_LOST, DECOMMISSIONED],
  IN_MAINTENANCE: [CHARGING, MARKED_LOST, OFFLINE, DECOMMISSIONED],
  MARKED_LOST: [IN_MAINTENANCE, CHARGING, OFFLINE, DECOMMISSIONED],
  CHARGING: [AVAILABLE, IN_MAINTENANCE, OFFLINE, DECOMMISSIONED],
  DECOMMISSIONED: [] // terminal state - no transitions
}
```

Each transition has:
- `label` - user-friendly display text
- `value` - status code (e.g., "IN_MAINTENANCE")
- `api` - method type: 'patch' or 'unassign'

### Status Color Mapping:

```javascript
TOOL_STATUS_COLOR_MAP = {
  ONLINE: '#ebf5e8',           // light green
  OFFLINE: '#EFEFEF',          // light grey
  CHARGING: '#FEFFD3',         // light yellow
  IN_MAINTENANCE: '#FEFFD3',   // light yellow
  MARKED_LOST: '#FFDDDD',      // light red
  DECOMMISSIONED: '#FFDDDD',   // light red
  AVAILABLE: '#ECFFE8',        // light green
  ASSIGNED: '#ECFFE8'          // light green
}
```

### Status Labels:

```javascript
TOOL_STATUS_LABEL_MAP = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
  CHARGING: 'Charging',
  IN_MAINTENANCE: 'In Maintenance',
  MARKED_LOST: 'Marked Lost',
  DECOMMISSIONED: 'Decommissioned',
  AVAILABLE: 'Available',
  ASSIGNED: 'Assigned'
}
```

---

## 5. GraphQL Mutations

**File:** `/Users/shivankar.s/gor/poc-mcp/pm-mcp/.repos/manager-dashboard/mdui/src/graphql/mutations/shift-planning/tool.js`

```graphql
mutation updateToolStatus($input: UpdateToolStatusInput!) {
  updateToolStatus(input: $input) {
    success
    message
  }
}

mutation createTool($input: CreateToolInput!) {
  createTool(input: $input) {
    success
    message
    toolId
  }
}

mutation deleteTool($input: DeleteToolInput!) {
  deleteTool(input: $input) {
    success
    message
  }
}

mutation unassignTool($input: UnassignToolInput!) {
  unassignTool(input: $input) {
    success
    message
  }
}
```

---

## 6. Backend - GraphQL Schema & Resolvers

**File:** `/Users/shivankar.s/gor/poc-mcp/pm-mcp/.repos/manager-dashboard/mdbff/src/resolvers/shift-planning/toolListing.mjs`

### GraphQL Type Definitions:

```graphql
type ToolItem {
  toolId: String
  name: String
  serialNumber: String
  type: String
  brand: String
  model: String
  user: String
  mode: String
}

type ToolListResult {
  total: Int
  tools: [ToolItem]
}

input UpdateToolStatusInput {
  toolId: String!
  toolStatus: String!
  userId: String (optional)
}

input UnassignToolInput {
  toolId: String!
}

input CreateToolInput {
  serialNumber: String!
  toolTypeId: String!
}

input DeleteToolInput {
  toolId: String!
}

type ToolOperationResponse {
  success: Boolean
  message: String
}

type CreateToolResponse {
  success: Boolean
  message: String
  toolId: String
}
```

### Resolver Mutations:

- `updateToolStatus(args.input)` → dataSources.toolListingModel.updateToolStatus()
- `createTool(args.input)` → dataSources.wmsToolAPI.createTool()
- `deleteTool(args.input)` → dataSources.wmsToolAPI.deleteTool()
- `unassignTool(args.input)` → dataSources.wmsToolAPI.unassignTool()

### Resolver Query:

- `toolList()` → dataSources.toolListingModel.getToolList()

---

## 7. Backend - Data Model

**File:** `/Users/shivankar.s/gor/poc-mcp/pm-mcp/.repos/manager-dashboard/mdbff/src/models/shift-planning/toolListing.mjs`

### ToolListing Class Methods:

#### `getToolList(context)`
- Fetches all tools from wmsToolAPI
- Gets tool types and MHE types
- Gets users map (cached in Redis for 3 hours)
- Maps raw tool data to frontend format:
```javascript
{
  toolId: tool.id
  name: toolType.name
  serialNumber: tool.serialNumber
  type: mhe.name
  brand: toolType.brand
  model: toolType.model
  user: resolved user firstname + lastname (or username)
  mode: tool.toolStatus
}
```
- Returns `{total, tools[]}`

#### `updateToolStatus(input, context)`
- Takes `{toolId, toolStatus}`
- Calls dataSources.wmsToolAPI.patchTool(toolId, {toolStatus})
- Returns `{success, message}`

---

## 8. UI Mockup Context

**File:** `/Users/shivankar.s/gor/poc-mcp/src/mcp-context/mockups/GM-294720-tool-listing.html`

Jira ticket GM-294720 mockup showing tool listing page design with:
- Top navigation bar
- Tool listing table with search and filters
- Status badge coloring (visual states)
- Action buttons for status transitions
- Create tool dialog
- Pagination controls

---

## Summary File Paths

| Component Type | File Path |
|---|---|
| Page (Parent) | `mdui/src/pages/shift-planning/ToolListing.vue` |
| Table Component | `mdui/src/components/shift-planning/tool-listing/ToolList.vue` |
| GraphQL Queries | `mdui/src/graphql/queries/shift-planning/tool-list.js` |
| GraphQL Mutations | `mdui/src/graphql/mutations/shift-planning/tool.js` |
| Status Constants | `mdui/src/constants/tool.js` |
| Backend Resolvers | `mdbff/src/resolvers/shift-planning/toolListing.mjs` |
| Backend Data Model | `mdbff/src/models/shift-planning/toolListing.mjs` |
| UI Mockup | `src/mcp-context/mockups/GM-294720-tool-listing.html` |

---

## Key Status States and Transitions

The system implements a state machine for tool status with 8 distinct states:
1. **AVAILABLE** - Tool ready for use
2. **ASSIGNED** - Tool assigned to a user (can unassign to AVAILABLE)
3. **OFFLINE** - Tool offline/unavailable
4. **IN_MAINTENANCE** - Tool under maintenance
5. **CHARGING** - Tool charging
6. **MARKED_LOST** - Tool marked as lost
7. **DECOMMISSIONED** - End-of-life state (no transitions allowed)
8. **ONLINE** - Online (used for color display only)

Status transitions are controlled via dropdown menu in the actions column, with different allowed transitions per current state. Transition data includes the API method to call ('patch' for status update, 'unassign' for user unassignment).
