const DEFAULT_JIRA_BASE = "https://greyorange-work.atlassian.net";

export function jiraTicketUrl(ticketId: string, baseUrl?: string): string {
  const base = (baseUrl || DEFAULT_JIRA_BASE).replace(/\/$/, "");
  if (!base || base.includes("your-company")) {
    return `${DEFAULT_JIRA_BASE}/browse/${ticketId}`;
  }
  return `${base}/browse/${ticketId}`;
}
