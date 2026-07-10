import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const MOCKUPS_DIR = join(homedir(), "claude-ui-designs");

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticketId = searchParams.get("id")?.trim();

  if (!ticketId || ticketId.includes("/") || ticketId.includes("..")) {
    return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
  }

  const filepath = resolve(join(MOCKUPS_DIR, `${ticketId}.analysis.json`));
  if (!filepath.startsWith(MOCKUPS_DIR) || !existsSync(filepath)) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  try {
    const data = JSON.parse(readFileSync(filepath, "utf-8"));
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to read analysis" }, { status: 500 });
  }
}
