# Epic GM-299464 Analysis Summary

## Enhance MD Handling Unit and RA Mission Views for Improved Inventory Journey Visibility

---

## Executive Summary

This epic focuses on renaming "Handling Unit" to "Carrying Unit" throughout the Manager Dashboard and implementing enhanced navigation flows between Orders → Carrying Units → RA Missions to provide end-to-end inventory visibility across warehouse operations.

**Key Metrics:**
- Estimated Effort: **180-242 hours** (4-6 weeks, 1 FTE)
- Complexity: **HIGH**
- Affected Files: **100+** (frontend, backend, tests, i18n)
- Risk Level: **MEDIUM-HIGH** (RA Service integration, Elasticsearch migration)

---

## 1. Terminology Changes

### Carrying Unit Renaming
**From:** `Handling Unit` → **To:** `Carrying Unit`

**Scope:**
- 40+ frontend components and pages
- 5 i18n locales (en-us, es, he, ja, ko-kr)
- GraphQL schema updates
- Store modules (Vuex)
- All test fixtures

**Conditional Display Rule:**
When `isRangerAssistEnabled = true`, display "Handling Unit"; otherwise display "Carrying Unit"

**Affected Pages:**
- `/outbound/handling-unit` (PRIMARY)
- `/outbound/ordersV2` (Secondary)
- `/inbound/listing` (Inbound PUT orders)
- `/audit/listing` (Impact view)

**Complexity:** MEDIUM (16-20 hours search/replace + testing)

---

## 2. Navigation Flows

### Flow A: Order → Carrying Unit Detail → RA Mission

```
Orders List Page (/outbound/ordersV2)
         ↓
    [Click Order ID or Row]
         ↓
Carrying Unit Detail (/outbound/orders/:orderId/)
    - Shows all carrying units for order
    - Displays raPickCarrierId (RA Carrier ID)
    - Displays raPickDeliveryNumber (RA Delivery Number)
         ↓
    [Click RA Carrier ID / Delivery Number]
         ↓
RA Mission View (/outbound/ra-orders/:missionId/)
    - Shows all carrying units in mission
    - Displays bot status, mission progress
    - Lists inventory shortages
```

**Data Fields for Navigation:**
| Field | Source | Used For |
|-------|--------|----------|
| raPickCarrierId | attributes.shipping_method | Mission ID lookup |
| raPickDeliveryNumber | attributes.RequirementNumber | Mission reference |
| raPutBinId | expectations.containers[0].products[0].location.barcode | Physical location |
| raExpectationAisle | expectations.containers[0].location.aisle | Expected destination |

### Flow B: Inbound PUT Orders → Carrying Units

```
Inbound Orders (/inbound/listing)
         ↓
    [Click Order]
         ↓
Inbound Order Detail (/inbound/orders/:orderId/)
    - Displays putCarryingUnit
    - Shows current location (if available)
    - Conditional: Ranger Assist enabled displays "Handling Unit"
```

---

## 3. Data Fields Per Page

### Handling Unit Listing (`/outbound/handling-unit`)

**Core Fields:**
| Field | Type | Source | Searchable | Sortable | Notes |
|-------|------|--------|-----------|----------|-------|
| externalServiceRequestId | String | Order ID | ✓ | ✓ | Primary identifier |
| carryingUnits | Array | tote_id \| packing_box_id \| rollcage_id | ✓ | - | Search by ID |
| status | String | Service request status | - | ✓ | CREATED, PROCESSING, etc. |
| businessState | String | Computed | - | ✓ | In Progress, Completed |
| currentLocation | Object | attributes.location | - | - | Warehouse location |
| raPickCarrierId | String | attributes.shipping_method | ✓ | ✓ | Links to mission |
| raPickDeliveryNumber | String | attributes.RequirementNumber | ✓ | ✓ | RA mission ref |
| raPutBinId | String | location.barcode | ✓ | - | Physical bin |
| raExpectationAisle | String | location.aisle | - | - | Expected aisle |
| stationId / PPS | Array | attributes.pps_id | ✓ | ✓ | Ranger ID |
| stagingLane | String | order_options.current_seat_location | ✓ | - | Packing lane |
| missionJourney | Composite | raCarrier + deliveryNum + itemCount | - | - | Visual journey |
| totalOrderQuantity | Integer | sr_products_counts.expectations | ✓ | ✓ | Item count |
| orderProgress | Object | actuals/expectations ratio | - | - | Progress bar |
| isBreached | Boolean | Computed logic | ✓ | - | Pick time exceeded |
| createdOn / updatedOn | DateTime | Timestamps | ✓ | ✓ | Audit trail |

**Derived Fields (Computed):**
- `businessState`: Transform based on fulfillmentArea, order type, stage
- `carryingUnits`: Array of tote_id, packing_box_id, or rollcage_id
- `isBreached`: Status + pick_before_time logic
- `missionJourney`: Concatenation of RA metadata + progress

### RA Mission View (`/outbound/ra-orders/:missionId/`)

**Mission-Level Fields:**
| Field | Type | Source | Notes |
|-------|------|--------|-------|
| missionId | String | RAMission | Primary identifier |
| botId | String | RAMission | Robot identifier |
| status | String | RAMission | CREATED, IN_PROGRESS, COMPLETED, FAILED |
| containers | Array | RAMissionContainer[] | List of carrying units in mission |
| orderCount | Integer | RAMission | Total orders in mission |
| itemCount | Integer | RAMission | Total items across orders |
| inventoryShortages | Array | InventoryShortage[] | Missing or unavailable inventory |
| createdAt / updatedAt | DateTime | RAMission | Timestamps |

**Bidirectional Linking:**
- Mission → Carrying Unit: Via `containers.externalSRId` (links back to order)
- Carrying Unit → Mission: Via `raPickCarrierId` + `raPickDeliveryNumber`

---

## 4. State Transitions & Visibility

### Order States

| State | Allowed Transitions | User Actions | Breach Detection | Display |
|-------|-------------------|--------------|-----------------|---------|
| CREATED | PROCESSING, CANCELLED | CANCEL, HOLD | - | Open Requests |
| PROCESSING | PAUSED, WAITING, PROCESSED, FAILED | PAUSE, CANCEL, HOLD | ✓ pick_before_time < NOW | All Views |
| PAUSED | PROCESSING, CANCELLED, FAILED | RESUME, CANCEL | ✓ | All Views |
| WAITING | PROCESSING, CANCELLED, FAILED | RESUME, CANCEL | ✓ | All Views |
| PROCESSED | - | - | ✓ updatedOn > pick_before_time | Completed |
| FAILED | - | RETRY | ✓ | All Views |
| CANCELLED | - | - | - | Archived |

### Breach Detection Logic

```
Breached = (
  (status in [PROCESSING, PAUSED, WAITING, CREATED] AND pick_before_time < NOW)
  OR
  (status in [PROCESSED, FAILED, CANCELLED] AND updatedOn > pick_before_time)
)
```

**Display:** Red badge/border, separate filter category

---

## 5. Affected Layers

### Frontend (52-68 hours)

**Pages (6):**
- `pages/outbound/handling-unit/Listing.vue`
- `pages/outbound/listing/OrderViewDetail.vue`
- `pages/inbound/Listing.vue`
- `pages/inbound/OrderViewDetail.vue`
- `pages/outbound/listing/RAOrderViewDetail.vue`

**Components (10+):**
- Handling unit list, detail, order lines
- Inbound order views
- Audit impact modals
- RA mission detail components

**GraphQL Queries:**
- `HANDLING_UNIT_LIST_QUERY`
- `HANDLING_UNIT_DETAIL_QUERY`
- `INBOUND_ORDER_LIST_QUERY`
- `RAMission queries`

**Store Modules:**
- `handlingUnit.store.js`
- `outbound/handlingUnit/*` (sub-modules)

**i18n Keys (5 locales):**
- `carryingUnit`
- `missionJourney`
- `stagingLane`
- `currentLocation`

### Backend (36-50 hours)

**GraphQL Types:**
- `HandlingUnit` (extend with RA fields)
- `RAMission` (new type)
- `RAMissionContainer` (new type)
- `InventoryShortage` (new type)

**Resolvers:**
- Mission list, detail resolvers
- Inventory shortage resolver
- Extend order resolver with RA mission data

**Models:**
- `handlingUnitList.mjs` - Query building
- `handlingUnitFilters.mjs` - Filter DSL
- `missionList.mjs` - Mission queries
- `mission.mjs` - Mission detail

**Utilities:**
- `getOutboundCarryingUnits()` - 4 sources (tote, packing_box, rollcage, array)
- `getPutCarryingUnit()` - Inbound carrying unit
- Breach detection logic

**Constants:**
- 600+ line `handlingUnit.mjs` with all filter definitions
- Elasticsearch field mappings

**APIs:**
- Order service calls
- RA SAM service calls
- Mission service calls

### Data Layer (Elasticsearch)

**Index:** `servicerequest`

**Fields for Carrying Unit Search:**
- `attributes.tote_id.keyword` - Tote ID search
- `attributes.packing_box_id.keyword` - Packing box search
- `attributes.rollcage_id.keyword` - Rollcage search
- `attributes.shipping_method.keyword` - RA Carrier ID
- `attributes.RequirementNumber` - RA Delivery Number
- `attributes.order_options.current_seat_location.keyword` - Staging lane

**Aggregations:**
- Carrying unit counts by filter
- Status distribution
- Breach order counts

---

## 6. Integration Points

### RA SAM Service Integration

**Data Provided:**
```
FROM: /outbound/orders/:orderId/
  - raPickCarrierId (attributes.shipping_method)
  - raPickDeliveryNumber (attributes.RequirementNumber)

TO: /outbound/ra-orders/:missionId/
  - missionId
  - botId
  - status (CREATED, IN_PROGRESS, COMPLETED, FAILED)
  - containers[] (carrying units in mission)
  - itemCount, orderCount
  - inventoryShortages[]
```

**Complexity:** MEDIUM - Two-step navigation chain

### Order Service Integration

**Data Provided:**
- Carrying unit identifiers (4 sources)
- Current location metadata
- Stage information (pick, pass, put)
- Exception tracking

**Complexity:** HIGH - Complex order hierarchy (master/sub/line levels)

### Elasticsearch Integration

**Queries:**
- Full-text search by carrying unit ID
- Filter aggregations for UI dropdowns
- Breach order detection via DSL script queries
- Multi-area order queries

**Complexity:** MEDIUM - 600+ lines of DSL definitions

---

## 7. Testing Strategy

### Unit Tests (16-20 hours)
- `getOutboundCarryingUnits()` - All 4 sources
- `isBreached()` - Date/status combinations
- `businessState` resolver - Config-based transforms
- Filter DSL builders - Complex boolean queries

### Component Tests (12-16 hours)
- List rendering with carrying units
- Navigation link functionality
- Conditional Ranger Assist display
- Filter/search functionality

### Integration Tests (20-28 hours)
- Order → Carrying Unit → Mission navigation
- Elasticsearch query performance
- RA Service latency impact
- Multi-area order handling

### E2E Tests (6-8 hours)
- Full user journey: List → Detail → Mission
- Search and filter workflows
- Breach detection display

---

## 8. Timeline & Effort

### Breakdown

| Phase | Duration | Effort |
|-------|----------|--------|
| Phase 1: Data Model | 1 week | 20-24 hrs |
| Phase 2: Backend Integration | 2 weeks | 40-50 hrs |
| Phase 3: Frontend UI | 2 weeks | 50-68 hrs |
| Phase 4: Testing | 1 week | 40-50 hrs |
| Phase 5: Deployment | 1 week | 20-24 hrs |
| **TOTAL** | **4-6 weeks** | **180-242 hrs** |

### Critical Path
1. RA Service API integration (blocks mission view)
2. Elasticsearch field mapping updates (blocks search)
3. Frontend navigation implementation (depends on above two)
4. End-to-end testing (depends on all above)

---

## 9. Risk Assessment

### High Risk

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| RA Service Integration Complexity | HIGH | HIGH | Early testing, mock service, fallback UI |
| Elasticsearch Index Migration | MEDIUM | HIGH | Blue-green deploy, reindex during low traffic |
| Backward Compatibility Breaking | MEDIUM | MEDIUM | Versioned APIs, deprecation notices |

### Medium Risk

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Multi-locale Translation Updates | MEDIUM | MEDIUM | Translation mgmt tool, automated extraction |
| Performance with Large Datasets | MEDIUM | MEDIUM | Indexed search, limit aggregations |
| RA Mission Latency | MEDIUM | MEDIUM | Caching layer, async loading |

---

## 10. Files to Modify

### Frontend Files (40+)

**Pages:**
- `mdui/src/pages/outbound/handling-unit/Listing.vue`
- `mdui/src/pages/outbound/listing/OrderViewDetail.vue`
- `mdui/src/pages/inbound/Listing.vue`

**Components:**
- `mdui/src/components/outbound/handling-unit/order-list/List.vue` (~2000 lines)
- `mdui/src/components/outbound/handling-unit/order-detail/*`
- `mdui/src/components/inbound/listing/*` (4 files with carryingUnit)
- `mdui/src/components/audit/modals/ViewImpactedOrder.vue`

**GraphQL:**
- `mdui/src/graphql/queries/outbound/handling-unit-*.js` (2 files)
- `mdui/src/graphql/queries/inbound/order-*.js` (2 files)

**Store:**
- `mdui/src/store/modules/handlingUnit.store.js`
- `mdui/src/store/modules/outbound/handlingUnit/*` (sub-modules)

**i18n (5 locales):**
- `mdui/src/i18n/en-us/index.js`
- `mdui/src/i18n/es/index.js`
- `mdui/src/i18n/he/index.js`
- `mdui/src/i18n/ja/index.js`
- `mdui/src/i18n/ko-kr/index.js`

### Backend Files (30+)

**Type Definitions:**
- `mdbff/src/typeDefs/handlingUnit.mjs` (200+ lines)
- `mdbff/src/typeDefs/mission.mjs` (add RAMission types)
- `mdbff/src/typeDefs/order.mjs` (extend carryingUnits)

**Resolvers:**
- `mdbff/src/resolvers/mission/*.mjs` (3 files)
- `mdbff/src/resolvers/order/outbound/*.mjs` (extend)

**Models:**
- `mdbff/src/models/order/handlingUnit*.mjs` (4 files)
- `mdbff/src/models/mission/*.mjs` (2 files)

**Constants:**
- `mdbff/src/constants/handlingUnit.mjs` (600+ lines)

**Utilities:**
- `mdbff/src/utils/orders.mjs` (update getOutboundCarryingUnits)

### Tests

**Unit Tests:**
- `mdbff/src/resolvers/order/__tests__/*.test.mjs` (10+ files)
- `mdbff/src/models/order/__tests__/*.test.mjs`
- `mdbff/src/__pact/contracts/*.json` (update contract tests)

**Component Tests:**
- `mdui/src/components/**/__tests__/*.spec.js` (8+ files)

---

## 11. Success Criteria

- [ ] All 40+ files updated with "Carrying Unit" terminology
- [ ] Order → Carrying Unit → RA Mission navigation flows fully functional
- [ ] All data fields display correctly in each view
- [ ] Search by carrying unit ID works across all pages
- [ ] Breach detection displays correctly
- [ ] RA mission metadata populates accurately
- [ ] Elasticsearch queries perform <500ms on production-scale data
- [ ] All 5 locales translated and tested
- [ ] Unit test coverage >85%
- [ ] E2E tests pass for all user journeys
- [ ] Performance baseline meets SLA requirements
- [ ] Zero breaking changes to existing APIs (or documented migrations)

---

## 12. Deliverables

1. **EPIC_GM_299464_ANALYSIS.json** - Comprehensive technical analysis (this file structure as JSON)
2. Updated codebase with all terminology changes
3. GraphQL schema updates (TypeDefs, Resolvers)
4. Backend models and utilities
5. Frontend UI components and pages
6. Updated test suite (unit, integration, e2e)
7. Migration guide for API consumers
8. Deployment runbook (blue-green strategy)
9. Performance baseline report
10. UAT sign-off documentation

---

## 13. Next Steps

1. **Prioritization:** Confirm with product team on Go-Live blocker status
2. **Resource Planning:** Allocate 1 dedicated FTE for 4-6 weeks
3. **RA Service Readiness:** Verify RA SAM service API stability and SLAs
4. **Data Preparation:** Plan Elasticsearch reindexing if field mappings change
5. **Design Review:** Confirm UI/UX for new navigation flows
6. **Kickoff:** Schedule sprint planning with full cross-functional team

---

**Document Generated:** 2026-06-18  
**Analysis Scope:** Epic GM-299464 - Enhance MD Handling Unit and RA Mission Views  
**Author:** Architecture & Analysis Team  
**Status:** Complete - Ready for Implementation Planning
