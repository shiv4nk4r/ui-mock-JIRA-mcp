/**
 * Lean mockup run contract — single source of truth for agent workflow prompts.
 * Limits MCP round-trips to max 2 before writing HTML.
 */

export const LEAN_MOCKUP_RUN = [
  "=== LEAN MOCKUP RUN (follow exactly — no redundant MCP) ===",
  "",
  "ALREADY IN SYSTEM PROMPT (do NOT re-fetch via MCP):",
  "- PAGE TEMPLATE SURVEY — full catalog of all routes, archetypes, components",
  "",
  "DO NOT CALL: survey-page-templates, list-captured-pages",
  "unless the catalog sections are missing from the prompt.",
  "",
  "STEP A — Pick routes (one line in your response, no planning narration):",
  "- 1 primary route + up to 2 graft routes from the prefetched survey",
  "",
  "STEP B — One MCP call only:",
  "- get-page-template(routes=[primary, ...grafts]) — max 3 routes, never call twice for same route",
  "- If no captures available: call find-related-context with keywords from ticket",
  "",
  "STEP C — Source code context (use what find-related-context or get-page-template returned):",
  "- Call read-source-file only if source was truncated and you need exact field names",
  "",
  "STEP D — Build immediately:",
  "- REUSE_MANIFEST_START/END then RAW_HTML_COMPONENT_START/END",
  "- No further template/source MCP after Step D starts",
  "",
  "LIST/TABLE PAGES — WORKING INTERACTIONS (mandatory):",
  "  1. Use data-table-engine SNIPPET. Fill ALL_ROWS with 15-25 objects covering every",
  "     filter value combination so no filter returns empty results.",
  "  2. Customise rowHtml(r) with the ticket's real columns. Wire each action button",
  "     to a handler: cancelRow(id), releaseRow(id), viewDetails(id), or ticket-specific",
  "     functions that mutate ALL_ROWS[i] then call render().",
  "  3. Include filters-sidebar SNIPPET (class=\"open\" by default).",
  "     Wrap table in: <div class=\"content-with-filters\">",
  "       [filters-sidebar] <div class=\"table-section\"> [table + pagination] </div>",
  "     </div>. Sidebar overlays the table via position:absolute inside position:relative wrapper.",
  "     Add onchange=\"onCheckFilter('field','value',this.checked)\" to each checkbox.",
  "     Add oninput=\"onInputFilter('field',this.value)\" to INPUT filters.",
  "  4. Include top-summary-filters SNIPPET. Each button: data-filter=\"StatusLabel\"",
  "     onclick=\"setTopFilter(this.dataset.filter)\". Counts auto-update via renderSummaryCounts().",
  "  5. Sortable <th> elements: data-sort=\"fieldKey\" onclick=\"sortBy('fieldKey')\".",
  "  6. pagination-row: id=\"resultsCount\" on count span, id=\"pageButtons\" on button container,",
  "     onchange=\"setPageSize(this.value)\" on rows-per-page select.",
  "  7. Search: id=\"searchInput\" on input, id=\"searchField\" on dropdown, oninput=\"onSearch()\".",
  "  8. toolbar-top stats span: id=\"toolbarStats\" so render() updates the live count.",
  "  9. Add any ticket-specific action modals following the openActionModal() pattern.",
  "",
  "TOOL BUDGET: max 3 MCP rounds before HTML.",
  "  Round 1: get-page-template (visual grounding) OR find-related-context (code grounding)",
  "  Round 2: find-related-context (if not already called) OR read-source-file (truncated files)",
  "  Round 3: any remaining lookup — then BUILD",
  "Captured Quasar CSS is AUTO-INJECTED server-side — preserve q-table/q-dialog/q-btn classes.",
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

export function suggestTemplateRoutes(ticketText: string): string[] {
  const found = new Set<string>();
  for (const { re, routes } of ROUTE_HINTS) {
    if (re.test(ticketText)) for (const r of routes) found.add(r);
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
