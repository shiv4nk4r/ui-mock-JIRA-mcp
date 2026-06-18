# Manager Dashboard — Full Context Reference

> **Purpose:** LLM/MCP context document for the `manager-dashboard` monorepo.
> Covers architecture, tech stack, data flow, conventions, color system, and integration patterns.

---

## Table of Contents

1. [Monorepo Overview](#1-monorepo-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Data Flow & Request Lifecycle](#4-data-flow--request-lifecycle)
5. [Authentication & Session Management](#5-authentication--session-management)
6. [Frontend (mdui/)](#6-frontend-mdui)
7. [Backend BFF (mdbff/)](#7-backend-bff-mdbff)
8. [Real-Time Subscriptions](#8-real-time-subscriptions)
9. [External Services & Integrations](#9-external-services--integrations)
10. [Color System & Design Tokens](#10-color-system--design-tokens)
11. [Coding Standards & Conventions](#11-coding-standards--conventions)
12. [State Management](#12-state-management)
13. [Routing Structure](#13-routing-structure)
14. [Internationalization](#14-internationalization)
15. [Deployment & Infrastructure](#15-deployment--infrastructure)
16. [Environment Variables Reference](#16-environment-variables-reference)
17. [Development Setup](#17-development-setup)

---

## 1. Monorepo Overview

```
manager-dashboard/
├── mdui/            # Frontend — Vue 2 + Quasar SPA
├── mdbff/           # Backend — Apollo GraphQL BFF
├── md-deployment/   # Docker, Ansible, Grafana configs
└── .github/         # GitHub Actions CI/CD
```

**Product:** GreyOrange warehouse operations dashboard.
Provides real-time warehouse monitoring, order management, inventory, audits, shift planning, capacity planning, and system administration for robotics-driven warehouses.

---

## 2. Technology Stack

### Frontend (mdui/)

| Category | Library | Version |
|---|---|---|
| Framework | Vue.js | 2.x |
| UI Component Library | Quasar Framework | 1.20.1 |
| Build Tool | @quasar/app | 2.4.3 |
| GraphQL Client | apollo-client | 2.6.10 |
| Vue Apollo Integration | vue-apollo | 3.1.0 |
| GraphQL WS | apollo-link-ws | 1.0.20 |
| GraphQL Tag Parser | graphql-tag | 2.12.6 |
| GraphQL Core | graphql | 15.8.0 |
| State Management | Vuex (via Quasar) | — |
| Router | Vue Router (via Quasar) | — |
| Authentication | keycloak-js | 25.0.6 |
| Idle Detection | idle-vue | 2.0.5 |
| Charting (standard) | chart.js + vue-chartjs | 2.9.4 / 3.5.1 |
| Charting (complex) | Plotly.js | — |
| Chart Labels | chartjs-plugin-datalabels | 1.0.0 |
| Calendar | @quasar/quasar-ui-qcalendar | 2.5.0 |
| Date/Time | moment-timezone | 0.5.38 |
| HTTP Client | axios | 1.7.7 |
| CSV Export | vue-json-csv, vue-papa-parse | — |
| i18n | vue-i18n | 8.28.2 |
| Date Range Picker | vue2-daterange-picker | 0.6.8 |
| PDF Viewer | vue-pdf | 4.3.0 |
| UUID | uuid | 8.3.2 |
| Duration Formatting | humanize-duration | 3.27.3 |
| Cookies | vue-cookies | 1.8.2 |
| Icon Sets | Material Icons, Material Symbols Outlined, FontAwesome v5 | — |

### Backend BFF (mdbff/)

| Category | Library | Version |
|---|---|---|
| Server Framework | Express.js | 4.18.2 |
| GraphQL Server | @apollo/server | 5.0.0 |
| Apollo Express Integration | @as-integrations/express4 | 1.1.2 |
| Apollo REST DataSources | @apollo/datasource-rest | 5.0.2 |
| GraphQL Core | graphql | 16.11.0 |
| GraphQL Subscriptions (PubSub) | graphql-subscriptions | 2.0.0 |
| WebSocket Transport | graphql-ws | 5.12.0 |
| Schema Tooling | @graphql-tools/schema, resolvers-composition | 9.x |
| Elasticsearch Client | @elastic/elasticsearch | 7.17.14 |
| Query DSL Builder | bodybuilder | 2.2.21 |
| Redis Client | ioredis | 5.4.1 |
| RabbitMQ Client | amqplib | 0.8.0 |
| HTTP Client | axios | 1.7.7 |
| File Storage | minio | 7.0.26 |
| Service Discovery | consul | 2.0.1 |
| Time-Series DB | influx | 5.9.2 |
| Config Management | config (node-config) | 3.3.2 |
| Templating | mustache | 4.2.0 |
| Date/Time | moment-timezone | 0.5.42 |
| Utilities | lodash | 4.17.21 |
| CSV Processing | csv-parse, json2csv | 6.1.0 / 5.0.6 |
| Logging | pino-elasticsearch, pino-multi-stream | — |
| Module System | ESM (native .mjs) | — |

### Infrastructure

| Service | Technology | Version |
|---|---|---|
| Reverse Proxy | Nginx | 1.17 |
| Search & Analytics | Elasticsearch | 6.8.3 |
| Message Queue | RabbitMQ | 3.12 |
| Cache | Redis | 5.0.5 |
| Database | PostgreSQL | 15 |
| File Storage | MinIO | — |
| Service Registry | Consul | — |
| Monitoring | Grafana | 12.0.3 |
| Containers | Docker + Docker Compose | — |
| Provisioning | Ansible | — |

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                           Browser (Client)                         │
│   Vue 2 + Quasar SPA                                               │
│   Apollo Client ──HTTP──► /bff (GraphQL queries/mutations)         │
│   Apollo Client ──WS───► /bff/subscription (subscriptions)         │
└───────────────────┬────────────────────────────────────────────────┘
                    │ via Nginx reverse proxy
┌───────────────────▼────────────────────────────────────────────────┐
│                     mdbff — Apollo GraphQL BFF                     │
│   Apollo Server 5 + Express                 Port 4000              │
│                                                                     │
│   Resolvers ──► Resolver Composition (auth middleware)             │
│              ──► Models (business logic)                            │
│              ──► Data Sources / APIs (HTTP clients to services)     │
│                                                                     │
│   External Data Sources:                                           │
│   ┌──────────────┐  ┌──────────┐  ┌───────────┐  ┌─────────────┐ │
│   │Elasticsearch │  │  Redis   │  │ RabbitMQ  │  │  PostgreSQL │ │
│   │  (analytics) │  │ (cache)  │  │ (alerts)  │  │  (UPS data) │ │
│   └──────────────┘  └──────────┘  └───────────┘  └─────────────┘ │
│                                                                     │
│   External REST Services:                                           │
│   Platform (Auth) │ PFI (Picking) │ Butler Core │ UPS │ MinIO      │
└────────────────────────────────────────────────────────────────────┘
```

### BFF Internal Layers

```
GraphQL Request
     │
     ▼
Resolver Composition Middleware
(isAuthenticated, hasRole, isEulaApplicable)
     │
     ▼
Resolver (thin — only maps GQL args to model calls)
     │
     ▼
Model (business logic, data transformation, filter building)
     │
     ▼
API/DataSource (axios HTTP client to upstream REST service)
              or
Elasticsearch Client (DSL queries via bodybuilder)
              or
Redis / RabbitMQ / Consul clients
```

---

## 4. Data Flow & Request Lifecycle

### Standard Query Flow

```
1. User interacts with UI component
2. Vue-Apollo fires a GraphQL query (useQuery / this.$apollo.query)
3. Apollo Client adds auth headers:
   - authentication-token: <jwt>
   - refresh-token: <refreshToken>
   - x-request-id: <uuid>
4. HTTP POST to /bff
5. Nginx proxies to mdbff:4000
6. Apollo Server routes to resolver
7. Resolver composition middleware validates:
   - Token via AuthV2.getUserDetailsWithPrivileges()
   - Role check if required
   - EULA acceptance if applicable
8. Resolver calls Model method
9. Model builds query (ES DSL / REST params)
10. API/DataSource makes HTTP call to upstream service OR
    Elasticsearch client executes DSL query
11. Response transformed to GraphQL type
12. JSON response returned to frontend
13. Vue-Apollo updates reactive state
14. Component re-renders
```

### Real-Time Alert Flow

```
External System (UPS/PFI/Butler)
     │ AMQP message
     ▼
RabbitMQ (alert queue)
     │
     ▼
alert.worker.mjs (consumer)
     │ pubsub.publish('alert_data', payload)
     ▼
graphql-subscriptions PubSub
     │ asyncIterator
     ▼
GraphQL Subscription Resolver
     │ WebSocket frame
     ▼
Apollo WebSocket Link (frontend)
     │
     ▼
Vue component subscription handler
     │ updates Vuex store
     ▼
OnScreenAlerts component re-renders
```

### Mutation Flow

```
User action (form submit, button click)
     │
     ▼
Vue-Apollo mutate() call
     │
     ▼
BFF Resolver (with auth middleware)
     │
     ▼
Model validates & builds payload
     │
     ▼
API DataSource HTTP POST/PUT to upstream service
     │
     ▼
Response → GraphQL type → Apollo cache update
     │
     ▼
Quasar Notify plugin shows success/error toast
```

---

## 5. Authentication & Session Management

### Keycloak SSO Flow

```
1. User opens app → root route
2. Apollo client fires LOGIN_STATUS_QUERY to BFF
3. BFF checks session (AUTH_VERSION=new → Keycloak)
4. If unauthenticated → UNAUTHENTICATED GraphQL error
5. Apollo error link catches UNAUTHENTICATED code
6. Frontend redirects to /v2/login
7. Login page creates Keycloak instance:
   { url: SSO_URL, realm: SSO_REALM_NAME, clientId: '...' }
8. Keycloak.init({ onLoad: 'login-required' })
9. Browser redirects to Keycloak login page
10. User enters credentials
11. Keycloak returns access_token + refresh_token
12. Tokens stored: localStorage['md-token'], localStorage['md-refreshToken']
13. Apollo auth link reads tokens → injects into every request header
14. BFF validates token against Platform service on every request
```

### Token Refresh

```
Apollo client runs token refresh timer:
- Checks token expiry every N seconds
- Fires LOGIN_REFRESH_QUERY 2 minutes before expiry
- BFF exchanges refresh token → new access token
- Client updates localStorage tokens
- Refresh failure → redirect to /v2/login
```

### Session Policies

| Policy | Value |
|---|---|
| Idle timeout | 60 minutes (IDLE_TIME_OUT env var) |
| Idle library | idle-vue |
| Force logout | Configurable via FORCE_LOGOUT env var |
| Token storage | localStorage (md-token, md-refreshToken) |
| Header names | authentication-token, refresh-token |
| Request tracing | x-request-id (UUID per request) |

### RBAC / Authorization

- Resolver composition middleware: `isAuthenticated()`, `hasRole('ROLE_NAME')`, `isEulaApplicable()`
- User object in GraphQL context: `{ id, roles[], privileges[], tenant }`
- Applied to 100+ query/mutation resolvers declaratively
- EULA: required before first access if IS_EULA_ENABLED=true

---

## 6. Frontend (mdui/)

### Entry Point & Boot Sequence

Quasar loads boot files in order:
1. **i18n** — Vue-i18n instance with locale files (en-us, es, he, ja, ko-kr)
2. **moment** — Moment timezone defaults
3. **page-title** — Document.title updates on route change
4. **csv** — vue-papa-parse / vue-json-csv global registration
5. **track** — Analytics/Matomo event tracking
6. **nps** — NPS survey widget (calls `https://gram.labs.greyorange.com/nps`)
7. **qcalendar** — QCalendar component registration

### Layout Structure

**Single layout: `MainLayout.vue`** (wraps all authenticated pages)

```
q-layout (hHh Lpr lfr)
  └── q-header
        ├── TopBar          (logo, user menu, notifications bell)
        ├── TabBar           (main navigation tabs)
        └── SubTabBar        (secondary navigation, context-dependent)
  └── q-page-container
        ├── router-view      (active page component)
        ├── NpsTracker       (NPS survey trigger)
        └── OnScreenAlerts   (real-time alert overlay)
```

### Page Hierarchy (Routes)

| Domain | Path Prefix | Key Pages |
|---|---|---|
| Outbound | `/outbound/` | orders, ordersV2, containers, reserved-orders, ra-orders, capacity-planning, manage-shifts, handling-unit |
| Inbound | `/inbound/` | listing, transfer-orders, order detail |
| Transport | `/transport/` | listing |
| Overview | `/overview/` | v2 dashboard |
| Exceptions | `/exception/` | listing, reserved-listing |
| Inventory | `/inventory/` | products, product-detail, tag-change, recall, storage-utilisation, gtp-master-product, stale-inventories |
| Audit | `/audit/` | listing, create-audit (gtp, reserve), reserved-audit |
| Notifications | `/notification/` | listing |
| System | `/system/` | zones, zone-controllers, rack-config, station-management, flow-management, hardware-status |
| Auth | `/v2/login` | login, user management |
| Shift Planning | `/shift-planning/` | shift roster |

**Router mode:** `hash` (URL hash-based routing)

### Component Organization

```
src/components/
├── outbound/         # Order listing, detail, container, capacity charts
├── inbound/          # Inbound order listing, detail
├── inventory/        # Product listing, detail, filters, modals
├── audit/            # Audit creation flows, modals
├── operations/       # Station management with modals/drawers
├── auth/             # Login forms, user management, RBAC modals
├── system/           # Zones, controllers, hardware status, rack config
├── ui/               # Reusable: tables, filters, forms, charts, modals
├── header/           # TopBar, TabBar, SubTabBar
└── alert/            # Fire emergency modals, on-screen alerts
```

### GraphQL Client Configuration

```javascript
// Apollo Client setup
HTTP Link:  POST /bff
WS Link:    ws(s)://host/bff/subscription
Split:      subscriptions → WS, queries/mutations → HTTP

Auth Link adds headers per request:
  authentication-token: localStorage['md-token']
  refresh-token:        localStorage['md-refreshToken']
  x-request-id:        uuidv4()

Error Link handles:
  ELASTIC_ERROR       → "Data temporarily unavailable" notification
  UNAUTHENTICATED     → redirect to /v2/login
  EULA_ERROR_CODE     → redirect to EULA acceptance page

Cache: InMemoryCache with addTypename: false
```

### Dev Server Proxies (quasar.conf.js)

| Proxy Path | Target | Purpose |
|---|---|---|
| `/bff` | `http://mdbff:4000` | GraphQL HTTP |
| `/bff/subscription` | `ws://mdbff:4000` | GraphQL WebSocket |
| `/grafana` | Grafana server | Embedded dashboards |
| `/gcc-report` | Reporting service | Reports |
| `/ups` | UPS service | UPS data |
| `/minio` | MinIO server | File storage |

---

## 7. Backend BFF (mdbff/)

### Server Setup (`src/index.mjs`)

```
Express HTTP Server (port 4000)
  ├── CORS middleware
  ├── JSON body parser
  ├── GET /health         → health check endpoint
  ├── POST /diagnose      → diagnostic endpoint
  ├── Apollo Server       → POST /bff (GraphQL)
  └── WebSocket Server    → /bff/subscription (subscriptions)

Startup also initializes:
  ├── RabbitMQ consumer (alert.worker.mjs)
  └── Consul config watcher (configWatcher.mjs)
```

### Schema Organization (`src/typeDefs/`)

32 type definition `.mjs` files organized by domain:

| Domain | Types |
|---|---|
| Auth | AuthUser, Authorities, User, Role, LicenseType |
| Orders | Order (inbound/outbound), HandlingUnit |
| Missions | Mission, InventoryShortage |
| Inventory | Product, SKU, Slot, RackUtilisation, StaleContainerInventory |
| Operations | Station, Zone, Task, OperationLog, PutLine |
| System | Config, ToolType |
| Notifications | Notification, Alert, Message |
| Files | MinIOFile |
| Common | Pagination, ResponseWrapper, Filter, Summary |

Root schema:
```graphql
type Query      { _empty: String }
type Mutation   { _empty: String }
type Subscription { _empty: String }
```
Extended by each domain's type definition file.

### Resolver Composition & Auth Middleware

All resolvers are wrapped via `@graphql-tools/resolvers-composition`:

```javascript
// Middleware available:
isAuthenticated()          // Requires valid JWT user in context
hasRole('ROLE_NAME')       // Requires specific role
isEulaApplicable()         // Requires EULA accepted

// Example composition:
{
  'Query.inventoryList':    [isAuthenticated()],
  'Mutation.createUser':    [isAuthenticated(), hasRole('ROLE_ADMIN')],
  'Query.billingConfig':    [isAuthenticated(), hasRole('ROLE_BILLING')],
}
```

### Resolver Domains

| Domain | Files |
|---|---|
| Auth | auth/index, user, v2/user, userList, roles, rbac, billing, usageReports, licenseTypes, wmsTool |
| Orders | order/outbound (list, detail, filters, container, bulkAction), order/inbound (list, detail, filters), exception (list, filters) |
| Inventory | inventoryList, inventoryFilters, inventorySummary, inventoryReport, masterProductList, staleContainerInventory, deletableSku, reSlot, tagsChange |
| Missions | missionList, missionDetail, inventoryShortages |
| System | zones, hardware, rack |
| Operations | stationList, stationFilters, stationActions, flowList, stationPendingMsu, binTags |
| Audit | auditList, auditDetails, auditSummary |
| Notifications | notificationList, notificationFilters |
| Alerts | alert, emergency |
| Transport | transport, transportException |
| Capacity Planning | capacityPlanning, capacityData |
| Shift Planning | shift, toolListing |
| Config | configuration |
| Overview | overview |
| Analytics | trackActivity |
| Downloads | minioDownloads |
| Resources | toolTypes, mheMaster, handlingUnitMapping |

### API DataSources (`src/apis/`)

All inherit from `baseAPI.mjs` (Axios with auth headers + retry):

| File | External Service |
|---|---|
| `auth.mjs` | Platform auth service |
| `authV2.mjs` | Keycloak / SSO |
| `rbac.mjs` | RBAC service |
| `order.mjs` | Order service |
| `mission.mjs` | RA/Mission service |
| `sku.mjs` | SKU/Product service |
| `inventory.mjs` | Inventory service |
| `audit.mjs` | Audit service |
| `notification.mjs` | Notification service |
| `station.mjs` | Station service |
| `container.mjs` | Container tracking |
| `rack.mjs` | Rack configuration |
| `transport.mjs` | Transport logistics |
| `overview.mjs` | Dashboard aggregates |
| `capacityPlanning.mjs` | Capacity calculations |
| `hardwareAPI.mjs` | Hardware status |
| `butlerCore.mjs` | Butler/automation |
| `raSam.mjs` | RA SAM service |
| `wmsShiftManager.mjs` | Shift management |
| `ups.mjs` | UPS system |
| `minio.mjs` | MinIO file storage |
| `configuration.mjs` | System config |
| `favFilters.mjs` | Saved filters |

Reserve facility variants exist for inventory, audit, station, and Butler.

### Elasticsearch Pattern

```javascript
// Client: @elastic/elasticsearch v7.17.14
// Query builder: bodybuilder

// Typical resolver → model → ES flow:
async getInventoryList(filters, pagination) {
  const query = bodybuilder()
    .filter('term', 'status', filters.status)
    .size(pagination.limit)
    .from(pagination.offset)
    .build();

  const results = await elasticClient.getSearchDataByDSL(query, 'inventory-index');
  return transformHits(results.hits.hits);
}

// Error codes:
// TimeoutError, ConnectionError → GraphQL error { code: 'ELASTIC_ERROR' }
```

### Consul Config Watcher

```
Watch prefix: config/md-bff/
Poll interval: every 5 minutes
On change: merge KV values into runtime config object
Config hierarchy:
  1. Base defaults
  2. Local environment (config/local.js)
  3. Tenant config (/app/config/tenant.js)
  4. Consul overrides (highest priority)
```

---

## 8. Real-Time Subscriptions

### Frontend WebSocket Setup

```javascript
const wsLink = new WebSocketLink({
  uri: `ws(s)://host/bff/subscription`,
  options: {
    reconnect: true,
    connectionParams: () => ({
      authToken:    localStorage['md-token'],
      refreshToken: localStorage['md-refreshToken'],
    }),
  },
});

// Operation splitting:
// subscriptions → wsLink
// queries/mutations → httpLink
```

### Backend WebSocket Setup

```javascript
// subscriptions-transport-ws (legacy protocol, matching frontend)
SubscriptionServer.create({
  schema, execute, subscribe,
  onConnect(connectionParams) {
    const user = await AuthV2.getUserDetail(connectionParams.authToken);
    if (!user) throw new Error('Unauthorized');
    return { user };
  },
}, { server: httpServer, path: '' });
```

### PubSub

```javascript
// src/subscriptions.mjs
import { PubSub } from 'graphql-subscriptions';
export const pubsub = new PubSub();

// Publishing (alert.worker.mjs):
pubsub.publish('alert_data', { alert: rabbitMQPayload });

// Subscribing (alert resolver):
subscribe: () => pubsub.asyncIterator(['alert_data'])
```

---

## 9. External Services & Integrations

| Service | Protocol | Purpose |
|---|---|---|
| Platform / Auth | REST HTTP | User authentication, RBAC |
| Keycloak (SSO) | OIDC / REST | SSO login, token issuance |
| PFI (Picking & Fulfillment) | REST HTTP | Order picking, fulfillment |
| Butler Core | REST HTTP | Robotics automation control |
| RA SAM | REST HTTP | RA mission management |
| UPS System | REST HTTP + AMQP | Alerts, notifications |
| WMS Tool | REST HTTP | Tool/equipment master data |
| Shift Manager | REST HTTP | Shift roster management |
| Elasticsearch | HTTP (ES protocol) | Search, analytics, aggregations |
| RabbitMQ | AMQP | Alert message queue |
| Redis | Redis protocol | Session cache, distributed locks |
| PostgreSQL | SQL | UPS operational data |
| MinIO | S3-compatible HTTP | File/image/report storage |
| Consul | HTTP | Service discovery, runtime config |
| InfluxDB | HTTP | Time-series metrics |
| Grafana | HTTP (proxied) | Embedded monitoring dashboards |
| Reporting Service | REST HTTP | Report generation |
| NPS Service | REST HTTP | Net Promoter Score surveys |
| Matomo | HTTP | Usage analytics |

---

## 10. Color System & Design Tokens

### Quasar Color Palette (`src/css/quasar.variables.scss`)

| Token | Hex | Usage |
|---|---|---|
| `$primary` | `#101a5c` | Dark navy — primary brand, headers, active states |
| `$secondary` | `#FE8400` | Orange — secondary CTAs, highlights |
| `$positive` | `#66bb6a` | Green — success states, completed status |
| `$negative` | `#ED3324` | Red — error states, critical alerts |
| `$info` | `#2982cc` | Blue — informational badges, links |
| `$warning` | `#f9b115` | Yellow — warning states, caution indicators |
| `$accent` | `#9C27B0` | Purple — accent, rare highlights |
| `$dark` | `#636f83` | Dark grey — secondary text, icons |
| `$grey` | `#696969` | Grey — disabled states, muted text |
| `$text` | `#FFFFFF` | White — text on dark backgrounds |
| `$light-grey` | `#d4d3d3` | Light grey — borders, dividers, backgrounds |

### Typography

| Property | Value |
|---|---|
| Primary typeface | SourceSansPro |
| Brand typeface | DINNextLTPro |
| Body font size | 14px |
| Body line-height | 17px |
| Font files location | `src/css/fonts/` (OTF format) |

### Global CSS (`src/css/app.scss`)

- Font-face declarations for DINNextLTPro and SourceSansPro
- Global resets and base styles
- Single entry: `app.scss` (imports `quasar.variables.scss`)

### Status Color Conventions

Consistent across all listing pages:

| Status | Color Token | Meaning |
|---|---|---|
| Completed / Success | `positive` (#66bb6a) | Order shipped, audit passed |
| Error / Failed | `negative` (#ED3324) | Errors, failed operations |
| In Progress / Active | `info` (#2982cc) | Processing, active missions |
| Warning / Pending | `warning` (#f9b115) | Needs attention |
| Cancelled / Disabled | `dark` (#636f83) | Inactive items |

---

## 11. Coding Standards & Conventions

### GraphQL Schema

- Schema files: `mdbff/src/typeDefs/` as `.mjs` files
- Type names: domain-prefixed PascalCase (e.g., `OutboundOrder`, `InventoryProduct`)
- All queries/mutations use input types — no loose scalar arguments
- Subscriptions: `graphql-subscriptions` PubSub + `subscriptions-transport-ws` protocol
- Error handling: structured GraphQL errors with `code` field, not raw throws

### Apollo Resolvers (BFF)

- Resolvers are thin — only map GQL args → model method calls
- All data fetching delegated to `src/apis/` or `src/clients/`
- Auth middleware applied via resolver composition (not inside resolver body)
- N+1 relationships must use DataLoader for batching
- Error structure: `{ message, code, extensions: { ... } }`

### Vue Components (Frontend)

- SFC pattern: `<template>`, `<script>`, `<style scoped>` — always in this order
- Use Quasar components over raw HTML when equivalent exists (`q-btn` not `<button>`)
- Component names: multi-word PascalCase (`OrderDetailCard`, not `Card`)
- Props: always declare type + validation (`type: String, required: true`)
- No direct DOM manipulation — use Vue reactivity
- Emit events for parent communication, do not mutate props

### ESM Modules (Backend)

- All backend files use `.mjs` extension
- `import`/`export` syntax exclusively — no `require()` or `module.exports`
- Top-level `await` is allowed in `.mjs` files

### Vuex State Management

- Each domain has its own Vuex module in `mdui/src/store/modules/`
- Async operations → Actions; state changes → Mutations only
- Components access store via `mapGetters`/`mapActions` — not `$store.state` directly
- Never mutate state outside of mutations

### Code Style

| Rule | Value |
|---|---|
| ESLint config | `plugin:vue/strongly-recommended` + `airbnb-base` |
| Prettier | enabled |
| Quotes | single quotes |
| Trailing commas | yes |
| Indent | 2 spaces |
| Component naming | PascalCase |
| Function/variable naming | camelCase |
| Constants | SCREAMING_SNAKE_CASE |
| CSS | scoped styles in SFCs; prefer Quasar CSS helpers |
| Import order | (1) external packages → (2) internal modules → (3) relative |

### Chart Conventions

- Chart.js for standard charts (bar, line, pie, doughnut)
- Plotly.js for complex/interactive visualizations (heatmaps, 3D)
- Always wrap chart libraries in Vue components — never use raw chart APIs in pages
- Charts must handle empty data states gracefully (show empty state message)

### Security Rules

- Never hardcode tokens, credentials, or environment-specific URLs
- All resolver auth checks via middleware composition, not inline if-checks
- No raw Elasticsearch queries from user input — always use bodybuilder sanitization
- All mutations require authentication + appropriate role check

---

## 12. State Management

### Vuex Module Map

| Module | Domain |
|---|---|
| `auth.store.js` | Login state, user profile, roles, EULA, favorite filters |
| `operations.store.js` | Station data, operations |
| `outbound.store.js` | Outbound orders, listing filters |
| `inbound.store.js` | Inbound orders |
| `inventory.store.js` | Product/SKU inventory |
| `transport.store.js` | Transport/logistics |
| `audit.store.js` | Audit requests & tracking |
| `system.store.js` | System/zone configuration |
| `notification.store.js` | Customer notifications |
| `overview.store.js` | Dashboard aggregate data |
| `handlingUnit.store.js` | Handling units |
| `capacityPlanning.store.js` | Capacity planning |
| `download.store.js` | Download/report job tracking |
| `staleContainerInventory.store.js` | Stale inventory tracking |
| `reserveOperations`, `reserveAudit`, `reserveOutbound`, `reserveException`, `raOutbound` | Reserve facility variants |

### Auth Store State Shape

```javascript
{
  isLoggedIn: Boolean,
  userLoggedIn: Object,       // full user profile
  usersData: Array,           // user list
  userListDetails: Object,    // pagination
  selectedRoles: Array,       // filter selections
  selectedStatuses: Array,
  eulaData: Object,           // EULA status
  favFilterData: Object,      // saved filter presets
  totalRoles: Array,
  totalPrivilegesByApp: Object,
  favColumns: Object          // saved column preferences
}
```

---

## 13. Routing Structure

**Mode:** Hash-based (`/#/route`)

```
/                        → redirect to /overview/v2
/outbound/
  orders                 → OutboundOrderList (legacy)
  ordersV2               → OutboundOrderListV2 (current)
  containers             → ContainerList
  reserved-orders        → ReservedOrderList
  ra-orders              → RAOrderList
  capacity-planning      → CapacityPlanningPage
  manage-shifts          → ShiftManagementPage
  handling-unit          → HandlingUnitPage
/inbound/
  listing                → InboundOrderList
  transfer-orders        → TransferOrderList
/transport/
  listing                → TransportList
/overview/
  v2                     → OverviewDashboard
/exception/
  listing                → ExceptionList
  reserved-listing       → ReservedExceptionList
/inventory/
  products               → InventoryList
  products/:id           → ProductDetail
  tag-change             → TagChangePage
  recall                 → RecallPage
  storage-utilisation    → StorageUtilisationPage
  gtp-master-product     → GTPMasterProductPage
  stale-inventories      → StaleInventoriesPage
/audit/
  listing                → AuditList
  create-audit/gtp       → CreateGTPAudit
  create-audit/reserve   → CreateReserveAudit
  reserved-audit         → ReservedAuditList
/notification/
  listing                → NotificationList
/system/
  zones                  → ZoneList
  zone-controllers       → ZoneControllerList
  rack-config            → RackConfigPage
  station-management     → StationManagementPage
  flow-management        → FlowManagementPage
  hardware-status        → HardwareStatusPage
/v2/login               → LoginPage
/v2/users               → UserManagementPage
/shift-planning/        → ShiftPlanningPage
```

---

## 14. Internationalization

**Library:** vue-i18n v8.28.2

**Supported Locales:**

| Code | Language |
|---|---|
| `en-us` | English (primary) |
| `es` | Spanish |
| `he` | Hebrew |
| `ja` | Japanese |
| `ko-kr` | Korean |

**File Structure:**
```
src/i18n/
├── en-us/index.js
├── es/index.js
├── he/index.js
├── ja/index.js
└── ko-kr/index.js
```

**Usage:** `this.$t('translationKey')` in components

**Storage:** User locale preference in `localStorage['locale']`

**Fallback:** `en-us`

---

## 15. Deployment & Infrastructure

### Docker Compose Services

| Container | Image | Port | Volume |
|---|---|---|---|
| md_nginx | tower_nginx:1.17 | 8081:80 | nginx config, static |
| md_elasticsearch | elasticsearch:6.8.3 | 9201:9200, 9301:9300 | elastic_data |
| md_rabbitmq | tower_rabbitmq:3.12 | 5671:5672, 15671:15672 | rabbitmq_data |
| md_redis | tower_redis:5.0.5 | 6377:6379 | redis_data |
| md_postgres | tower_postgres:15 | — | postgres_data |
| md_grafana | md_grafana:12.0.3 | — | grafana/ dashboards |
| pghero | — | — | — (DB monitoring UI) |

**Network:** `gormd` (custom Docker bridge network)

**Registry:** `repo.labs.greyorange.com` (private registry)

### Nginx Routing

```
/bff              → mdbff:4000 (GraphQL HTTP)
/bff/subscription → mdbff:4000 (WebSocket)
/grafana          → md_grafana (embedded dashboards)
/gcc-report       → Reporting service
/ups              → UPS service
/minio            → MinIO API
/* (static)       → mdui SPA (index.html fallback)
```

### Grafana

- Version: 12.0.3
- Serves under `/grafana/` sub-path
- Dashboard JSONs provisioned on startup
- 20+ pre-built warehouse dashboards
- Custom branding via `grafana.ini`

### Ansible Roles

| Role | Purpose |
|---|---|
| `docker/` | Docker Engine + Compose install |
| `platform_postgres/` | PostgreSQL provisioning |
| `platform/` | Platform services setup |
| `asl/` | Additional storage location config |

---

## 16. Environment Variables Reference

### Backend BFF (mdbff/.env)

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `production` / `development` |
| `VM_ID` | Deployment VM identifier |
| `SITE_TIMEZONE` | Default timezone |
| `TENANT_ID` | Multi-tenant identifier |
| `ON_PREM` | On-premises deployment flag |
| **Elasticsearch** | |
| `ELASTIC_HOST` | ES host (e.g., 192.168.9.1) |
| `ELASTIC_PORT` | ES port (default: 9200) |
| **External Services** | |
| `PFI_URL` | Picking & fulfillment service |
| `RESERVE_PFI_URL` | Reserve PFI service |
| `BUTLER_SERVER_URL` | Butler automation |
| `RESERVE_BUTLER_SERVER_URL` | Reserve Butler |
| `PLATFORM_SERVER_URL` | Auth/platform service |
| `UPS_URL` | UPS system |
| `TOWER_IP` | Tower/WMS address |
| `STORAGE_SERVICE_BASE_URL` | Storage service |
| **Messaging** | |
| `RABBITMQ_HOST` | RabbitMQ host |
| `RABBITMQ_PORT` | RabbitMQ port |
| `RABBITMQ_DEFAULT_USER` | RabbitMQ username |
| `RABBITMQ_DEFAULT_PASS` | RabbitMQ password |
| **Caching** | |
| `REDIS_HOST` | Redis host |
| `REDIS_PORT` | Redis port (default: 6379) |
| **File Storage** | |
| `MINIO_HOST` | MinIO host |
| `MINIO_PORT` | MinIO port |
| `MINIO_USERNAME` | MinIO access key |
| `MINIO_PASSWORD` | MinIO secret key |
| `MINIO_IMAGE_BUCKET` | Images bucket name |
| `MINIO_REPORT_BUCKET` | Reports bucket name |
| `MINIO_TOOL_BUCKET` | Tool documents bucket |
| **Authentication** | |
| `AUTH_VERSION` | `new` = Keycloak SSO |
| `SSO_URL` | Keycloak server URL |
| `SSO_REALM_NAME` | Keycloak realm |
| `FORCE_LOGOUT` | Enable server-side force logout |
| `IDLE_TIME_OUT` | Session idle timeout (minutes) |
| **Feature Flags** | |
| `SHOW_GRN_BUTTON` | GRN action visibility |
| `IS_EULA_ENABLED` | EULA enforcement |
| `IS_CHANGE_FLOW_ENABLED` | Flow change feature |
| `IS_RESERVE_CHANGE_FLOW_ENABLED` | Reserve flow change |
| `CAN_CREATE_UPDATE_FLOW_TYPE` | Flow type modification |
| **Monitoring** | |
| `GRAFANA_IP` | Grafana URL |
| `GMD_GRAFANA_URL` | Global MD Grafana URL |
| `MATOMO_SITE_ID` | Analytics site ID |
| `REPORTING_SERVICE_IP` | Report service URL |
| **Config** | |
| `CONSUL_URL` | Consul server URL |
| **Database** | |
| `POSTGRES_HOST` | PostgreSQL host |
| `POSTGRES_PORT` | PostgreSQL port |
| `POSTGRES_DB` | Database name |
| `POSTGRES_USER` | PostgreSQL user |
| `POSTGRES_PASSWORD` | PostgreSQL password |

### Frontend (mdui/.env)

| Variable | Purpose |
|---|---|
| `BFF_IP` | BFF server address for dev proxy |
| `REPORTING_SERVICE_IP` | Report service URL |
| `NPS_SERVICE_IP` | NPS survey service URL |
| `MD_GRAFANA_IP` | Grafana URL |
| `MINIO_IP` | MinIO URL |
| `IS_RDC_ENABLED` | RDC feature flag |

---

## 17. Development Setup

### Prerequisites

- Node.js 20.18.0
- npm
- Docker + Docker Compose (for infrastructure services)

### Frontend

```bash
cd mdui
npm install
npx quasar dev          # Dev server with HMR (hot module reload)
npx quasar build        # Production build
npx quasar test --unit  # Unit tests (Jest)
npx eslint .            # Lint
npx prettier --check .  # Format check
```

### Backend BFF

```bash
cd mdbff
npm install
npx nodemon             # Dev server with auto-restart
node src/index.mjs      # Production start
npm test                # Jest + Pact contract tests
npx eslint .            # Lint
```

> **Note:** Both packages require `NODE_OPTIONS=--openssl-legacy-provider` due to OpenSSL compatibility with the Node.js 20 + legacy webpack config.

### Test Strategy

| Test Type | Tool | Location |
|---|---|---|
| Unit tests | Jest | `*.spec.js` co-located or `__tests__/` |
| Component tests | Vue Test Utils | Frontend components |
| Contract tests | Pact (consumer-driven) | BFF ↔ upstream service contracts |

---

*Generated from codebase analysis — /Users/shivankar.s/gor/manager-dashboard*
*Last updated: 2026-06-02*
