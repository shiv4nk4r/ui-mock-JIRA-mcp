import { NextResponse } from "next/server";
import { readServerTranscript } from "@lib/mockup/server-transcript";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get("id")?.trim();

  if (!ticketId || ticketId.includes("/") || ticketId.includes("..")) {
    return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
  }

  const transcript = readServerTranscript(ticketId);
  if (!transcript) {
    return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
  }

  return NextResponse.json(transcript);
}
