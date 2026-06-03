# Grey Matter Manager Dashboard — Global Navigation Sitemap
> **Source:** `mdbff/src/tabs.mjs` (TABS config), `mdui/src/router/` routing structure, `CONTEXT.md`, UI screenshots
> **Purpose:** Context for a Global Navigation Menu Lexicon
> **App:** GreyOrange Manager Dashboard — Vue 2 + Quasar SPA over Apollo GraphQL BFF
> **URL mode:** Hash-based routing (`/#/route`)

---

## Entry Point

```
[Login Page — /v2/login]
  └─ Username + Password → LOGIN
        └─ /overview/v2 (default redirect from /)
```

---

## Global Persistent UI (All Authenticated Pages)

```
q-header (fixed, 56px, white bg)
  q-toolbar
    ├─ [GreyOrange Logo] + "Manager Dashboard" + "Version unknown"   ← top-left
    ├─ [Bell q-btn]          Notifications                           ← top-right
    ├─ [Timezone text]       e.g. "Time Zone - America/Vancouver"
    ├─ [Globe q-btn]         Language selector (en-us, es, he, ja, ko-kr)
    └─ [Avatar q-btn]        "admin ▾" → Profile / Logout q-menu

  q-tabs (primary, 44px, bg #101a5c, indicator-color #FE8400, mobile-arrows)
    → 12 top-level tabs in fixed order (see L1 below)

  q-tabs (sub-tabs, 40px, bg white, indicator-color #FE8400)
    → Context-dependent sub-tabs per active L1 tab
```

---

## Full Navigation Tree

### L1 Tab Order (fixed, from TABS config)

```
ANALYTICS → OUTBOUND → INBOUND → [TRANSPORT*] → AUDIT → PROCESS EXCEPTIONS
  → INVENTORY → SYSTEM → RESOURCES/USERS → [SHIFT PLANNING*] → REPORTS → NOTIFICATION
```
> `*` = feature-flag gated (conditionally shown)

---

### 1. ANALYTICS
- **i18n key:** `analytics`
- **Route:** `/overview/{config.overview.version}` (resolves to `/overview/v2`)
- **Component:** OverviewDashboard
- **Sub-tabs:** None
- **Pattern:** Dashboard / Overview (Pattern B)
- **Page content (from CONTEXT.md):** Overview dashboard with aggregated warehouse KPIs

---

### 2. OUTBOUND
- **i18n key:** `outbound`
- **Base route:** `/outbound`
- **Pattern:** Listing (Pattern A)

| Sub-tab i18n key | Route | Feature Flag | Notes |
|---|---|---|---|
| `forwardArea` | `/outbound/ordersV2` | `isOutboundV2Enabled` | Current V2 forward area |
| `gtpArea` / `"RA Orders"` | `/outbound/orders` | `isOutboundV1Enabled` | Label becomes `"RA Orders"` when `isRangerAssistEnabled=true` |
| `raMissions` | `/outbound/ra-orders` | `isRangerAssistEnabled` | RA mission listing |
| `reservedArea` | `/outbound/reserved-orders` | `isReserveEnabled` | Reserve facility outbound |
| `reservedAreaV2` | `/outbound/reserved-ordersV2` | `isReserveOutboundV2Enabled` | Reserve V2 variant |
| `containers` | `/outbound/containers` | always | Container listing |
| `capacityPlanning` | `/outbound/capacity-planning` | `isCapacityPlanningEnabled` | Wave level projection + shift capacity |
| `handlingUnit` | `/outbound/handling-unit` | `isHandlingUnitEnabled` | Handling unit management |

**Sub-routes (not in sub-tab bar):**
- `/outbound/manage-shifts` — Shift management (accessed from within Outbound)

---

### 3. INBOUND
- **i18n key:** `inbound`
- **Base route:** `/inbound`
- **Pattern:** Listing (Pattern A)

| Sub-tab i18n key | Route | Feature Flag | Notes |
|---|---|---|---|
| `inboundListing` | `/inbound/listing` | always | Main inbound orders list |
| `transferArea` | `/inbound/transfer-orders` | always | Transfer order listing |

**Sub-routes (not in sub-tab bar):**
- `/inbound/listing/:id` — Inbound order detail

---

### 4. TRANSPORT *(feature-flagged)*
- **i18n key:** `transport`
- **Base route:** `/transport`
- **Feature flag:** `isTransportEnabled`
- **Pattern:** Listing (Pattern A)

| Sub-tab i18n key | Route | Notes |
|---|---|---|
| `transport` | `/transport` | Transport / logistics listing |

---

### 5. AUDIT
- **i18n key:** `audit`
- **Base route:** `/audit`
- **Pattern:** Listing + action flows (Pattern A)

| Sub-tab i18n key | Route | Feature Flag | Notes |
|---|---|---|---|
| `forwardArea` | `/audit/audit` | always | GTP / forward area audit listing |
| `reservedListing` | `/audit/reserved-audit` | `isReserveEnabled` | Reserve area audit listing |

**Sub-routes (not in sub-tab bar):**
- `/audit/create-audit/gtp` — Create GTP audit wizard
- `/audit/create-audit/reserve` — Create reserve audit wizard

---

### 6. PROCESS EXCEPTIONS
- **i18n key:** `processExceptions`
- **Base route:** `/exception`
- **Pattern:** Listing (Pattern A)

| Sub-tab i18n key | Route | Feature Flag | Notes |
|---|---|---|---|
| `gtpListing` | `/exception/listing` | always | Exception listing (Pick/Put/Missing/Damaged/Unscannable) |
| `reservedListing` | `/exception/reserved-listing` | `isReserveEnabled` | Reserve area exceptions |

---

### 7. INVENTORY
- **i18n key:** `Inventory` *(note: capital I in source — likely i18n-resolved)*
- **Base route:** `/inventory`
- **Pattern:** Mixed — Listing (A), Form (C), Dashboard (B)

| Sub-tab i18n key | Route | Feature Flag | Notes |
|---|---|---|---|
| `inventoryListing` | `/inventory/products` | always | SKU/inventory listing with utilisation summary |
| `tagChange` | `/inventory/tagChange` | always | Enter SKU ID → validate → change storage tag |
| `storageUtilisation` | `/inventory/storage-utilisation` | always | Storage slot listing + utilisation % |
| `productMaster` | `/inventory/gtp-master-product` | always | Master product listing (dimensions, DOH, qty) |
| `staleInventories` | `/inventory/stale-inventories` | `isStaleContainerInventoriesEnabled` | Stale container inventory tracking |

**Sub-routes (not in sub-tab bar):**
- `/inventory/products/:id` — Product / SKU detail
- `/inventory/recall` — Inventory recall page

---

### 8. SYSTEM
- **i18n key:** `system`
- **Base route:** `/system`
- **Pattern:** Listing + Hardware Status (Pattern A + E)

| Sub-tab i18n key | Route | Feature Flag | Notes |
|---|---|---|---|
| `overview` | `/system/zones` | always | Zone list (Total/Operating/Non-Operating) |
| `rackConfig` | `/system/rack-config` | always | Rack / MSU configuration |
| `stationManagement` | `/system/station-management` | always | Station list (Pick/Put/Audit, Mode, Profile, Queue) |
| `reserveStationManagement` | `/system/reserve-station-management` | `isReserveEnabled` | Reserve station management |
| `hardwareStatus` | `/system/hardware-status` | always | Ranger + Charger hardware status dashboard |

**Sub-routes (not in sub-tab bar):**
- `/system/zone-controllers` — Zone controller list
- `/system/flow-management` — Flow management page

---

### 9. RESOURCES / USERS
- **i18n key:** `"Resources"` if `isRdcEnabled`, else `users`
- **Base route:** `/users`
- **Pattern:** Listing (Pattern A)

| Sub-tab i18n key | Route | Feature Flag | Notes |
|---|---|---|---|
| `usersList` | `/users/v2Listing` | always | User management listing |
| `billingControl` | `/users/v2/billing` | async `isBillingTabEnabled()` | Billing control panel |
| `rolesAndPermissions` | `/users/access-control` | `isAccessControlEnabled` + `isAdmin` | RBAC — roles & permissions (admin only) |
| `"Tool Types"` | `/users/tool-types` | `isRdcEnabled` | MHE tool type master |
| `"Handling Units"` | `/users/handling-units` | `isRdcEnabled` | Handling unit definitions |
| `"Pallet Types"` | `/users/pallet-types` | `isRdcEnabled` | Pallet type master |
| `toolListing` | `/users/tool-listing` | `isRdcEnabled` | Tool inventory listing |
| ~~`"Base Setup"`~~ | ~~`/users/base-setup`~~ | ~~`isRdcEnabled`~~ | **Commented out** — not rendered |

**Sub-routes (not in sub-tab bar):**
- `/v2/users` — User management page (auth-layer route)

---

### 10. SHIFT PLANNING *(feature-flagged)*
- **i18n key:** `shiftPlanning`
- **Base route:** `/shift-planning`
- **Feature flag:** `isRdcEnabled`
- **Pattern:** Listing (Pattern A)

| Sub-tab i18n key | Route | Notes |
|---|---|---|
| `"Shift Management"` | `/shift-planning/shift-management` | Shift roster management |

---

### 11. REPORTS
- **i18n key:** `reports`
- **Base route:** `/reports`
- **Pattern:** Listing (Pattern A)

| Sub-tab i18n key | Route | Feature Flag | Notes |
|---|---|---|---|
| `operationsLog` | `/reports/operations-log` | always | Operations log report |
| ~~`storageSpace`~~ | ~~`/reports/storage-space`~~ | — | **Commented out** — not rendered |

---

### 12. NOTIFICATION
- **i18n key:** `notification`
- **Base route:** `/notification`
- **Pattern:** Listing (Pattern A)

| Sub-tab i18n key | Route | Notes |
|---|---|---|
| `listing` | `/notification/listing` | Notification listing |

---

## Feature Flags Summary

All flags come from `config.get('configuration.system.*')` — resolved from Consul KV at runtime:

| Flag | Affects |
|---|---|
| `isOutboundV2Enabled` | Outbound → Forward Area (V2) |
| `isOutboundV1Enabled` | Outbound → GTP Area (V1) |
| `isRangerAssistEnabled` | Outbound → RA Missions tab; renames GTP Area label to "RA Orders" |
| `isReserveEnabled` | Outbound Reserved, Audit Reserved, Exception Reserved, System Reserve Station Mgmt |
| `isReserveOutboundV2Enabled` | Outbound → Reserved Area V2 |
| `isCapacityPlanningEnabled` | Outbound → Capacity Planning |
| `isHandlingUnitEnabled` | Outbound → Handling Unit |
| `isTransportEnabled` | Transport L1 tab (entire section) |
| `isStaleContainerInventoriesEnabled` | Inventory → Stale Inventories |
| `isRdcEnabled` | Resources label rename; Tool Types/Handling Units/Pallet Types/Tool Listing/Base Setup; Shift Planning L1 tab |
| `isAccessControlEnabled` | Resources → Roles & Permissions (also requires admin role) |
| `isBillingTabEnabled` | Resources → Billing Control (async — from configurationAPI) |

---

## Linked External Apps (OTHER_APPS — launcher, not main nav)

| Key | Icon | Label |
|---|---|---|
| `tower` | `fas fa-broadcast-tower` | Tower |
| `intralogistics` | `"I"` | Intralogistics |
| `rms` | `"R"` | RMS |
| `analyticalDashboard` | `img:logos/grafana.png` | analyticalDashboard (Grafana) |
| `ttpTower` | `fas fa-broadcast-tower` | TTP Tower |
| `zeroWalkTower` | `fas fa-broadcast-tower` | Zero Walk Tower |

---

## Full Sitemap at a Glance

```
[/v2/login]  Login Page
     │
     └─► [/overview/v2]  Analytics — Overview Dashboard
         
[ANALYTICS]
  └── /overview/v2

[OUTBOUND]
  ├── /outbound/ordersV2             Forward Area          (flag: isOutboundV2Enabled)
  ├── /outbound/orders               GTP Area / RA Orders  (flag: isOutboundV1Enabled)
  ├── /outbound/ra-orders            RA Missions           (flag: isRangerAssistEnabled)
  ├── /outbound/reserved-orders      Reserved Area         (flag: isReserveEnabled)
  ├── /outbound/reserved-ordersV2    Reserved Area V2      (flag: isReserveOutboundV2Enabled)
  ├── /outbound/containers           Containers
  ├── /outbound/capacity-planning    Capacity Planning     (flag: isCapacityPlanningEnabled)
  └── /outbound/handling-unit        Handling Unit         (flag: isHandlingUnitEnabled)
      [/outbound/manage-shifts]      Manage Shifts         (sub-route, no tab)

[INBOUND]
  ├── /inbound/listing               Inbound Listing
  └── /inbound/transfer-orders       Transfer Area
      [/inbound/listing/:id]         Order Detail          (sub-route, no tab)

[TRANSPORT]  *(flag: isTransportEnabled)*
  └── /transport                     Transport

[AUDIT]
  ├── /audit/audit                   Forward Area
  └── /audit/reserved-audit          Reserved Listing      (flag: isReserveEnabled)
      [/audit/create-audit/gtp]      Create GTP Audit      (sub-route, no tab)
      [/audit/create-audit/reserve]  Create Reserve Audit  (sub-route, no tab)

[PROCESS EXCEPTIONS]
  ├── /exception/listing             GTP Listing
  └── /exception/reserved-listing    Reserved Listing      (flag: isReserveEnabled)

[INVENTORY]
  ├── /inventory/products            Inventory Listing
  ├── /inventory/tagChange           Tag Change
  ├── /inventory/storage-utilisation Storage Utilisation
  ├── /inventory/gtp-master-product  Product Master
  └── /inventory/stale-inventories   Stale Inventories     (flag: isStaleContainerInventoriesEnabled)
      [/inventory/products/:id]      Product Detail        (sub-route, no tab)
      [/inventory/recall]            Recall Page           (sub-route, no tab)

[SYSTEM]
  ├── /system/zones                  Overview (Zones)
  ├── /system/rack-config            Rack Config
  ├── /system/station-management     Station Management
  ├── /system/reserve-station-management  Reserve Station Mgmt  (flag: isReserveEnabled)
  └── /system/hardware-status        Hardware Status
      [/system/zone-controllers]     Zone Controllers      (sub-route, no tab)
      [/system/flow-management]      Flow Management       (sub-route, no tab)

[RESOURCES / USERS]  *(label: "Resources" if isRdcEnabled)*
  ├── /users/v2Listing               Users List
  ├── /users/v2/billing              Billing Control       (flag: isBillingTabEnabled async)
  ├── /users/access-control          Roles & Permissions   (flag: isAccessControlEnabled + admin)
  ├── /users/tool-types              Tool Types            (flag: isRdcEnabled)
  ├── /users/handling-units          Handling Units        (flag: isRdcEnabled)
  ├── /users/pallet-types            Pallet Types          (flag: isRdcEnabled)
  └── /users/tool-listing            Tool Listing          (flag: isRdcEnabled)
      [/users/base-setup]            Base Setup            (commented out)

[SHIFT PLANNING]  *(flag: isRdcEnabled)*
  └── /shift-planning/shift-management  Shift Management

[REPORTS]
  └── /reports/operations-log        Operations Log
      [/reports/storage-space]       Storage Space         (commented out)

[NOTIFICATION]
  └── /notification/listing          Notification Listing
```

---

## i18n Key → Display Label Mapping (en-us)

> These are the translation keys used in the TABS config. Final rendered labels come from the i18n locale files.

| i18n Key | Expected English Label |
|---|---|
| `analytics` | Analytics |
| `outbound` | Outbound |
| `forwardArea` | Forward Area |
| `gtpArea` | GTP Area |
| `raMissions` | RA Missions |
| `reservedArea` | Reserved Area |
| `reservedAreaV2` | Reserved Area V2 |
| `containers` | Containers |
| `capacityPlanning` | Capacity Planning |
| `handlingUnit` | Handling Unit |
| `inbound` | Inbound |
| `inboundListing` | Inbound Listing |
| `transferArea` | Transfer Area |
| `transport` | Transport |
| `audit` | Audit |
| `reservedListing` | Reserved Listing |
| `processExceptions` | Process Exceptions |
| `gtpListing` | GTP Listing |
| `Inventory` | Inventory |
| `inventoryListing` | Inventory Listing |
| `tagChange` | Tag Change |
| `storageUtilisation` | Storage Utilisation |
| `productMaster` | Product Master |
| `staleInventories` | Stale Inventories |
| `system` | System |
| `overview` | Overview |
| `rackConfig` | Rack Config |
| `stationManagement` | Station Management |
| `reserveStationManagement` | Reserve Station Management |
| `hardwareStatus` | Hardware Status |
| `users` | Users |
| `usersList` | Users List |
| `billingControl` | Billing Control |
| `rolesAndPermissions` | Roles and Permissions |
| `toolListing` | Tool Listing |
| `shiftPlanning` | Shift Planning |
| `reports` | Reports |
| `operationsLog` | Operations Log |
| `notification` | Notification |
| `listing` | Listing |
