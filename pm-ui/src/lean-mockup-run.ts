/**
 * Lean mockup run contract — single source of truth for agent workflow prompts.
 */

export const LEAN_MOCKUP_RUN = [
  "=== LEAN MOCKUP RUN (follow exactly — no redundant MCP) ===",
  "",
  "ALREADY IN SYSTEM PROMPT (do NOT re-fetch via MCP):",
  "- PAGE TEMPLATE SURVEY — full catalog of all routes, archetypes, components",
  "- OFFICIAL BRAND ICONS CATALOG — searchable icon paths",
  "",
  "DO NOT CALL: survey-page-templates, list-page-templates, list-brand-icons, list-captured-pages",
  "unless the catalog sections are missing from the prompt.",
  "",
  "STEP A — Pick routes (one line in your response, no planning narration):",
  "- 1 primary route + up to 2 graft routes from the prefetched survey",
  "",
  "STEP B — One MCP call only:",
  "- get-page-template(routes=[primary, ...grafts]) — max 3 routes, never call twice for same route",
  "",
  "STEP C — Icons (only icons you embed in HTML):",
  "- get-brand-icon(path) for each icon — skip list-brand-icons",
  "",
  "STEP D — Build immediately:",
  "- REUSE_MANIFEST_START/END then RAW_HTML_COMPONENT_START/END",
  "- No further template/icon MCP after Step D starts",
  "",
  "TOOL BUDGET: max 2 MCP rounds before HTML (1 template batch + 1 icon batch).",
  "Modals: get-rendered-component only if ticket requires q-dialog not in template.",
  "Filesystem MCP is READ-ONLY. Do not restate this workflow in thinking — execute tools then write HTML.",
  "Captured Quasar CSS is AUTO-INJECTED server-side — preserve q-table/q-dialog classes.",
  "=== END LEAN MOCKUP RUN ===",
].join("\n");

const ROUTE_HINTS: Array<{ re: RegExp; routes: string[] }> = [
  { re: /shift|planning|MHE|capacity/i, routes: ["/shift-planning/shift-management", "/outbound/capacity-planning/manage-shifts"] },
  { re: /handling.?unit|carrying.?unit/i, routes: ["/outbound/handling-unit", "/outbound/ordersV2"] },
  { re: /\bRA\b|ra.?order|ra.?mission/i, routes: ["/outbound/ra-orders", "/outbound/handling-unit"] },
  { re: /outbound|order.?line|pick(ing)?|ship|container/i, routes: ["/outbound/ordersV2", "/outbound/orders"] },
  { re: /inbound|receive|transfer.?order/i, routes: ["/inbound/listing", "/inbound/transfer-orders"] },
  { re: /inventory|sku|product|storage|recall|stale/i, routes: ["/inventory/products", "/inventory/stale-inventories"] },
  { re: /audit|cycle.?count|ira|gtp/i, routes: ["/audit/audit", "/audit/gtp-audit/create"] },
  { re: /exception|breach/i, routes: ["/exception/listing"] },
  { re: /station|zone|rack|hardware|system/i, routes: ["/system/station-management", "/system/zones"] },
  { re: /user|role|access|billing/i, routes: ["/users/v2Listing", "/users/access-control"] },
  { re: /report|operations.?log/i, routes: ["/reports/operations-log", "/reports"] },
  { re: /notification/i, routes: ["/notification/listing"] },
  { re: /transport/i, routes: ["/transport/listing"] },
  { re: /overview|analytics|dashboard/i, routes: ["/overview/v2", "/overview"] },
  { re: /download/i, routes: ["/downloads"] },
];

/** Keyword hints for user message — agent may override. */
export function suggestTemplateRoutes(ticketText: string): string[] {
  const found = new Set<string>();
  for (const { re, routes } of ROUTE_HINTS) {
    if (re.test(ticketText)) {
      for (const r of routes) found.add(r);
    }
  }
  return [...found].slice(0, 3);
}

export function formatRouteHints(ticketText: string): string {
  const routes = suggestTemplateRoutes(ticketText);
  if (!routes.length) return "";
  return `Suggested template routes (hints — you may override): ${routes.join(", ")}`;
}

export function buildGroundingPromptBlock(label: string): string {
  return [LEAN_MOCKUP_RUN, "", `Capture label: ${label}`].join("\n");
}

export function ticketNeedsModalCapture(ticketText: string): boolean {
  return /modal|dialog|popup|drawer/i.test(ticketText);
}
