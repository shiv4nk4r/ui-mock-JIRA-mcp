import { shiftPlannerTemplate } from "./shift-planner";
import { exceptionListingTemplate } from "./exception-listing";
import { formCardTemplate } from "./form-card";
import { dashboardOverviewTemplate } from "./dashboard-overview";
import { alertListTemplate } from "./alert-list";
import { NAV_CONTEXT, NavContext, buildSharedNavHtml } from "./nav";

export type { NavContext } from "./nav";
export { L1_TABS, NAV_CONTEXT } from "./nav";

export type TemplateKey =
  | "shift-planner"
  | "exception-listing"
  | "form-card"
  | "dashboard-overview"
  | "alert-list";

type TemplateFn = (
  ticketId: string,
  summary: string,
  navCtx: NavContext,
  navHtml: string
) => string;

const TEMPLATES: Record<TemplateKey, TemplateFn> = {
  "shift-planner":      shiftPlannerTemplate,
  "exception-listing":  exceptionListingTemplate,
  "form-card":          formCardTemplate,
  "dashboard-overview": dashboardOverviewTemplate,
  "alert-list":         alertListTemplate,
};

const KEYWORD_MAP: Array<{ keys: string[]; template: TemplateKey }> = [
  {
    keys: ["shift", "schedule", "roster", "headcount", "worker", "planner", "staffing"],
    template: "shift-planner",
  },
  {
    keys: ["exception", "mismatch", "discrepancy", "error", "listing", "list", "filter", "table", "view"],
    template: "exception-listing",
  },
  {
    keys: ["form", "input", "create", "edit", "update", "submit", "entry", "add", "configure", "setup"],
    template: "form-card",
  },
  {
    keys: ["dashboard", "overview", "kpi", "metric", "analytics", "chart", "summary", "report", "stats"],
    template: "dashboard-overview",
  },
  {
    keys: ["alert", "notification", "notify", "message", "warning", "event", "feed", "activity"],
    template: "alert-list",
  },
];

export function selectTemplate(summary: string, description: string): TemplateKey {
  const text = `${summary} ${description}`.toLowerCase();
  let bestTemplate: TemplateKey = "dashboard-overview";
  let bestScore = 0;

  for (const { keys, template } of KEYWORD_MAP) {
    const score = keys.filter((k) => text.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestTemplate = template;
    }
  }

  return bestTemplate;
}

export function renderTemplate(key: TemplateKey, ticketId: string, summary: string): string {
  const navCtx = NAV_CONTEXT[key];
  const navHtml = buildSharedNavHtml(navCtx);
  return TEMPLATES[key](ticketId, summary, navCtx, navHtml);
}
