# Epic GM-299464 Analysis Report

## Document Index

This directory contains a comprehensive analysis of Epic **GM-299464: "Enhance MD Handling Unit and RA Mission Views for Improved Inventory Journey Visibility"**

### Files Included

1. **EPIC_GM_299464_SUMMARY.md** (472 lines)
   - Executive summary and quick reference guide
   - High-level overview of all requirements
   - Timeline and effort estimates
   - Risk assessment matrix
   - Success criteria checklist
   - **START HERE** if you need a quick understanding

2. **EPIC_GM_299464_ANALYSIS.json** (1,116 lines)
   - Structured JSON containing all technical specifications
   - Can be parsed programmatically for automation/tooling
   - Includes all business logic and state transitions
   - Complete file inventory and code locations
   - Integration points and API specifications

---

## Quick Reference

### The Epic in 30 Seconds

**Goal:** Rename "Handling Unit" → "Carrying Unit" and implement end-to-end inventory visibility navigation

**Key Change:** Users can now navigate from:
- **Orders List** → Click order ID
- **Carrying Unit Detail** → Click RA mission ID  
- **RA Mission View** → See all units in mission

**Affected Areas:**
- 100+ files across frontend, backend, tests, i18n
- 5 supported languages (en-us, es, he, ja, ko-kr)
- 3 business flows (Outbound, Inbound, Rewarehousing)

**Effort:** 180-242 hours (4-6 weeks)
**Complexity:** HIGH
**Risk:** MEDIUM-HIGH (RA Service integration)

---

## Navigation Flows Implemented

### Flow 1: Outbound Order Journey
```
Order Listing Page
  ↓ (click order ID)
Order/Carrying Unit Detail
  ↓ (click RA Carrier ID)
RA Mission View
  ↓ (can view all units in mission)
Back to Order
```

### Flow 2: Inbound PUT Order Journey
```
Inbound Order Listing
  ↓ (click order ID)
Inbound Order Detail
  ↓ (displays putCarryingUnit)
View Current Location/Status
```

### Flow 3: Rewarehousing Flow
```
Reslot Order Creation
  ↓
Source Carrying Unit Selection
  ↓
Movement to Destination
  ↓
Track via RA Mission (if robotics assisted)
```

---

## Data Architecture

### Carrying Unit Sources
A "carrying unit" can be one of 4 types:
1. **tote_id** - Robot tote (most common for picks)
2. **packing_box_id** - Packing box for consolidated items
3. **rollcage_id** - Rollcage for shipments/transport
4. **barcode** - Container barcode (fallback)

Logic: `getOutboundCarryingUnits()` checks in order and returns first available

### RA Mission Linking
- **From Carrying Unit:** `raPickCarrierId` (attributes.shipping_method)
- **From Carrying Unit:** `raPickDeliveryNumber` (attributes.RequirementNumber)
- **To Mission:** Lookup mission by these two fields
- **Bidirectional:** Mission lists `containers[].externalSRId` (order ID)

### State Tracking
- **Status Field:** Technical state (CREATED, PROCESSING, PROCESSED, FAILED, CANCELLED)
- **Business State:** User-facing state (Created, In Progress, Completed, etc.)
- **Breach Detection:** Automated flag when pick_before_time exceeded

---

## Field Inventory by Page

### `/outbound/handling-unit` (Primary Page)
**Search/Sort:**
- externalServiceRequestId (Order ID)
- carryingUnits (Tote/Box/Rollcage ID)
- raPickCarrierId (RA Carrier)
- station (PPS ID)

**Display:**
- Current location (warehouse area, aisle, bin)
- Status + Business State
- Staging lane (packing station assignment)
- Mission journey (RA metadata + progress)
- Item count + Progress bar
- Breach indicator (red if pick time exceeded)

### `/outbound/orders/:orderId/` (Detail View)
**Main Content:**
- Master order + Sub orders + Order lines
- All carrying units associated
- Container tracking
- Stage journey (Pick → Pass → Pack → Ship)
- Exception tracking (missing, damaged items)
- RA metadata (put bin, expected aisle)

### `/inbound/listing` (Inbound Orders)
**Special:** 
- Uses `putCarryingUnit` instead of `carryingUnits`
- Conditional display based on `isRangerAssistEnabled` flag
- Can navigate to RA mission if applicable

### `/outbound/ra-orders/:missionId/` (New View)
**Mission-Level:**
- Mission ID, Bot ID, Mission Status
- All carrying units in mission (containers)
- Item count, order count
- Inventory shortages in this mission
- Mission progress and completion status

---

## Technical Specifications

### Frontend Architecture

**Pages (6):** Route-level components for each flow

**Components (15+):** Reusable display and navigation components

**GraphQL Queries (4):**
- `HANDLING_UNIT_LIST_QUERY` - Listing with all fields
- `HANDLING_UNIT_DETAIL_QUERY` - Order hierarchy + containers
- `INBOUND_ORDER_LIST_QUERY` - PUT orders
- `INBOUND_ORDER_DETAIL_QUERY` - PUT order detail

**Vuex Store:** `handlingUnit.store.js` + sub-modules for state management

**Search:** Full-text search on carrying unit ID via Elasticsearch

**Filters:** 30+ filter combinations (status, station, breach, etc.)

### Backend Architecture

**GraphQL Types:**
- `HandlingUnit` (extends existing Order type)
- `RAMission` (new type for mission data)
- `RAMissionContainer` (links mission ↔ order)
- `InventoryShortage` (shortage detail)

**Resolvers:** Thin resolvers delegate to models
- `handlingUnitList` → model builds ES query
- `handlingUnitDetail` → fetches order hierarchy
- `raissionList` → queries RA service
- `missionDetail` → fetches mission + shortages

**Models:** Business logic for queries
- Build Elasticsearch DSL queries
- Transform API responses to GraphQL types
- Compute derived fields (isBreached, businessState)

**APIs (3):**
- **Order Service** - Carries unit + order data
- **RA SAM** - Mission + bot data  
- **Elasticsearch** - Full-text search + analytics

### Data Layer

**Index:** `servicerequest` (Elasticsearch)

**Searchable Fields:**
- Carrying units: `attributes.tote_id.keyword`
- RA Carrier: `attributes.shipping_method.keyword`
- Status: `status.keyword`
- Station: `attributes.pps_id.keyword`

**Aggregations:** Used for filter dropdowns and counts

---

## Implementation Roadmap

### Phase 1: Data Model (1 week)
- Define RAMission GraphQL type ✓ (type defs complete)
- Add RA fields to HandlingUnit type ✓ (already present)
- Verify Elasticsearch mappings ✓ (already indexed)
- Create test data

### Phase 2: Backend Integration (2 weeks)
- Implement mission resolvers
- Add inventory shortage query
- Integrate RA Service API calls
- Create Pact contract tests
- Endpoint: Fully functional BFF APIs

### Phase 3: Frontend UI (2 weeks)
- Implement navigation links
- Add new data columns
- Build mission detail views
- Implement advanced filters
- Endpoint: Fully functional UI

### Phase 4: Testing (1 week)
- System integration tests
- E2E user journey tests
- Performance testing (prod scale)
- UAT with stakeholders

### Phase 5: Deployment (1 week)
- Staged rollout (10% → 50% → 100%)
- Monitor metrics
- Rollback procedures
- Post-launch support

---

## Testing Coverage

### Unit Tests
- `getOutboundCarryingUnits()` - All 4 source types
- `isBreached()` - Date/status logic
- `businessState` resolver - Config transforms
- Filter DSL builders - Complex queries

**Target:** 85%+ coverage

### Component Tests
- Handling unit list rendering
- Navigation link functionality
- Search and filter
- Conditional Ranger Assist display

### Integration Tests
- Elasticsearch query performance
- RA Service latency impact
- Order service API calls
- Multi-area order handling

### E2E Tests
- Full user journey: List → Detail → Mission
- Search/filter workflows
- Breach detection
- Pagination with complex filters

---

## Files Modified Summary

### Frontend Changes (40+ files)
- **Pages:** 6 files
- **Components:** 15+ files
- **GraphQL Queries:** 4 files
- **Store Modules:** 5 files
- **i18n (5 locales):** 15 files
- **Tests:** 10+ files

### Backend Changes (30+ files)
- **TypeDefs:** 3 files
- **Resolvers:** 8+ files
- **Models:** 6 files
- **Constants:** 2 files
- **Utilities:** 2 files
- **APIs:** 2 files
- **Tests:** 10+ files

---

## Effort Breakdown

| Component | Hours | Notes |
|-----------|-------|-------|
| Terminology Updates | 20-24 | Search/replace + testing |
| Navigation Implementation | 24-32 | Links, routing, state |
| Data Field Enhancements | 12-16 | New columns, displays |
| Backend Integration | 40-50 | APIs, resolvers, models |
| Testing (all levels) | 48-64 | Unit, integration, E2E |
| Documentation & Deploy | 20-24 | Guides, runbooks |
| **TOTAL** | **180-242** | **4-6 weeks (1 FTE)** |

---

## Risk Matrix

### High Priority Risks
1. **RA Service Integration** - May not be stable/documented
   - Mitigation: Early integration testing, mock service
   
2. **Elasticsearch Migration** - Index changes could impact performance
   - Mitigation: Blue-green deployment, test on staging

3. **Backward Compatibility** - Existing consumers may break
   - Mitigation: Versioned APIs, deprecation window

### Medium Priority Risks
4. **Multi-locale Translations** - 5 locales = 5x update work
   - Mitigation: Automated extraction, translation tool

5. **Performance at Scale** - Large carrying unit datasets
   - Mitigation: Indexed search, limit aggregations

6. **Ranger Assist Feature Flag** - Complex conditional logic
   - Mitigation: Comprehensive flag testing

---

## Dependency Map

```
Epic GM-299464 (Carrying Unit Visibility)
    ├── RA SAM Service API (must be stable)
    ├── Elasticsearch Index (must support new fields)
    ├── Order Service (must return RA metadata)
    ├── Keycloak RBAC (for new resource permissions)
    └── BFF Infrastructure (must handle increased load)

Frontend Changes
    ├── New NavigationRoutes
    ├── Updated GraphQL Queries
    ├── New Vue Components
    └── Updated Store Modules

Backend Changes
    ├── New GraphQL Types (RAMission)
    ├── New Resolvers (Mission, Shortages)
    ├── Updated Models (Carrying Unit Logic)
    └── Extended APIs (RA Service Calls)

Testing
    ├── Unit Tests (utilities, resolvers)
    ├── Component Tests (Vue components)
    ├── Integration Tests (APIs, Services)
    └── E2E Tests (Full User Journeys)
```

---

## Success Metrics

### Functional
- [ ] All 3 navigation flows work end-to-end
- [ ] Carrying unit search returns accurate results
- [ ] RA mission data populates correctly
- [ ] Breach detection displays correctly
- [ ] All state transitions handled properly

### Performance
- [ ] Listing page load < 2 seconds (prod scale)
- [ ] Search query response < 500ms
- [ ] RA mission detail load < 1 second
- [ ] No N+1 query problems

### Quality
- [ ] 85%+ test coverage
- [ ] All CI checks passing
- [ ] No critical bugs in UAT
- [ ] Performance baseline maintained

### User Experience
- [ ] Clear navigation paths
- [ ] Consistent terminology (all locales)
- [ ] Responsive on all devices
- [ ] Accessible (WCAG 2.1 AA)

---

## Document Usage

### For Product Managers
- Read: SUMMARY.md sections 1-3, 10-12
- Focus: Business flows, user journeys, timeline

### For Architects
- Read: Both documents in full
- Focus: Data architecture, integration points, risk assessment

### For Backend Developers
- Read: ANALYSIS.json sections: affectedLayers.backend, integrationPoints
- Focus: Type defs, resolver implementation, model logic

### For Frontend Developers
- Read: ANALYSIS.json sections: affectedLayers.frontend, dataFieldsPerPage
- Focus: Components, queries, navigation implementation

### For QA Engineers
- Read: ANALYSIS.json section: estimatedComplexity.testing
- Focus: Test scenarios, edge cases, coverage targets

---

## Related Documents

- **CLAUDE.md** - Project coding standards & conventions
- **CONTEXT.md** - Full system architecture reference
- **CONTRIBUTING.md** - Development workflow

---

## Questions & Support

For questions about this analysis:
1. Check the relevant section in EPIC_GM_299464_SUMMARY.md
2. Refer to EPIC_GM_299464_ANALYSIS.json for technical details
3. Review CLAUDE.md for coding standards
4. Contact: Architecture & Analysis Team

---

**Analysis Completed:** 2026-06-18  
**Ticket:** GM-299464  
**Status:** Ready for Implementation Planning  
**Confidence Level:** HIGH (based on existing codebase analysis)

**Change Log:**
- 2026-06-18: Initial analysis complete
  - 40+ files identified
  - 3 navigation flows mapped
  - 180-242 hour estimate calculated
  - Risk assessment completed
