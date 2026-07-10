import { F, COLORS } from "@lib/design/tokens";
import { jiraTicketUrl } from "@lib/utils/jira";

export function JiraTicketLink({
  ticketId,
  jiraBaseUrl,
  className,
}: {
  ticketId: string;
  jiraBaseUrl?: string;
  className?: string;
}) {
  const href = jiraTicketUrl(ticketId, jiraBaseUrl);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`hover:underline ${className ?? ""}`}
      style={{
        ...F.mono,
        fontSize: 13,
        fontWeight: 500,
        color: COLORS.accent,
        textDecoration: "none",
      }}
      title={`Open ${ticketId} in JIRA`}
    >
      {ticketId}
    </a>
  );
}

export function TicketSidebar({
  ticketId,
  jiraBaseUrl,
}: {
  ticketId: string;
  jiraBaseUrl?: string;
}) {
  return (
    <aside
      className="hidden sm:flex flex-none flex-col items-center justify-start px-2 py-5 border-r shrink-0"
      style={{ width: 80, borderColor: COLORS.border, background: COLORS.surface }}
    >
      <JiraTicketLink ticketId={ticketId} jiraBaseUrl={jiraBaseUrl} className="text-center break-all leading-snug" />
    </aside>
  );
}
