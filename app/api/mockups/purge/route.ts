import { NextResponse } from "next/server";
import { purgeTicketDiskArtifacts } from "@lib/mockup/server-transcript";

export const dynamic = "force-dynamic";

/** Wipe on-disk mock HTML + transcript for a ticket (used by history delete). */
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get("id")?.trim();

  if (!ticketId || ticketId.includes("/") || ticketId.includes("..")) {
    return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
  }

  const deleted = purgeTicketDiskArtifacts(ticketId);
  return NextResponse.json({ ok: true, deleted: deleted.length });
}
