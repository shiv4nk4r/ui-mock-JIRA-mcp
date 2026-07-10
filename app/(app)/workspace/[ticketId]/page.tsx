import { WorkspaceClient } from "@/components/workspace/WorkspaceClient";

export default function WorkspacePage({ params }: { params: { ticketId: string } }) {
  return <WorkspaceClient ticketId={decodeURIComponent(params.ticketId)} />;
}
