/**
 * Shared navigation context derived from site-map.md.
 * Every template uses this so mocks reflect the real app structure.
 */

export interface SubTab {
  name: string;  // q-tab name prop (no spaces)
  label: string; // display label
}

export interface NavContext {
  activeTab: string;       // q-tab name for the active L1 tab
  activeSubTab: string;    // q-tab name for the active sub-tab (or "")
  route: string;           // hash route for this page, e.g. "/#/overview/v2"
  subTabs: SubTab[];
  pageTitle: string;       // section banner page title
}

/** All 11 L1 tabs in fixed order from TABS config (tabs.mjs) */
export const L1_TABS: SubTab[] = [
  { name: "analytics",          label: "ANALYTICS" },
  { name: "outbound",           label: "OUTBOUND" },
  { name: "inbound",            label: "INBOUND" },
  { name: "audit",              label: "AUDIT" },
  { name: "process_exceptions", label: "PROCESS EXCEPTIONS" },
  { name: "inventory",          label: "INVENTORY" },
  { name: "system",             label: "SYSTEM" },
  { name: "resources",          label: "RESOURCES" },
  { name: "shift_planning",     label: "SHIFT PLANNING" },
  { name: "reports",            label: "REPORTS" },
  { name: "notification",       label: "NOTIFICATION" },
];

/** Per-template navigation context from site-map.md */
export const NAV_CONTEXT = {
  "dashboard-overview": {
    activeTab: "analytics",
    activeSubTab: "",
    route: "/#/overview/v2",
    subTabs: [],
    pageTitle: "Analytics — Overview Dashboard",
  } satisfies NavContext,

  "shift-planner": {
    activeTab: "shift_planning",
    activeSubTab: "shift_management",
    route: "/#/shift-planning/shift-management",
    subTabs: [{ name: "shift_management", label: "Shift Management" }],
    pageTitle: "Shift Planning — Shift Management",
  } satisfies NavContext,

  "exception-listing": {
    activeTab: "process_exceptions",
    activeSubTab: "gtp_listing",
    route: "/#/exception/listing",
    subTabs: [
      { name: "gtp_listing",      label: "GTP Listing" },
      { name: "reserved_listing", label: "Reserved Listing" },
    ],
    pageTitle: "Process Exceptions",
  } satisfies NavContext,

  "form-card": {
    activeTab: "outbound",
    activeSubTab: "forward_area",
    route: "/#/outbound/ordersV2",
    subTabs: [
      { name: "forward_area",       label: "Forward Area" },
      { name: "gtp_area",           label: "GTP Area" },
      { name: "containers",         label: "Containers" },
      { name: "capacity_planning",  label: "Capacity Planning" },
      { name: "handling_unit",      label: "Handling Unit" },
    ],
    pageTitle: "Outbound — Forward Area",
  } satisfies NavContext,

  "alert-list": {
    activeTab: "notification",
    activeSubTab: "listing",
    route: "/#/notification/listing",
    subTabs: [{ name: "listing", label: "Listing" }],
    pageTitle: "Notification — Listing",
  } satisfies NavContext,
} as const;

export type TemplateNavKey = keyof typeof NAV_CONTEXT;

/**
 * Builds the shared `<q-header>` inner HTML used by all templates.
 * Includes: top toolbar, primary L1 tab bar, optional sub-tab bar.
 * The section banner (page-specific) is NOT included — templates add it themselves.
 */
export function buildSharedNavHtml(ctx: NavContext): string {
  const primaryTabs = L1_TABS.map(
    (t) => `      <q-tab name="${t.name}" label="${t.label}" />`
  ).join("\n");

  const subTabBar =
    ctx.subTabs.length > 0
      ? `\n    <q-tabs v-model="activeSubTab" class="bg-white text-dark" indicator-color="secondary" dense align="left" narrow-indicator>
${ctx.subTabs.map((st) => `      <q-tab name="${st.name}" label="${st.label}" />`).join("\n")}
    </q-tabs>`
      : "";

  return `    <q-toolbar class="bg-white" style="border-bottom:1px solid #d4d3d3;min-height:56px;">
      <q-toolbar-title>
        <span style="color:#FE8400;font-weight:700;font-size:14px;">Manager Dashboard</span>
        <span style="color:#636f83;font-size:11px;margin-left:8px;">v1.0</span>
      </q-toolbar-title>
      <q-btn flat round icon="notifications" color="dark" size="sm" />
      <q-btn flat round icon="language" color="dark" size="sm" />
      <q-avatar size="32px" color="primary" style="margin-left:8px;cursor:pointer;">
        <q-icon name="person" color="white" size="18px" />
      </q-avatar>
    </q-toolbar>
    <q-tabs v-model="activeTab" class="bg-primary text-white" indicator-color="secondary" dense mobile-arrows align="left">
${primaryTabs}
    </q-tabs>${subTabBar}`;
}
