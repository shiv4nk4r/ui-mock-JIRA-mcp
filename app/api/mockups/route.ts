import { NextResponse } from "next/server";
import { readdirSync, statSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const MOCKUPS_DIR = join(homedir(), "claude-ui-designs");

function fmtBytes(n: number): string {
  if (n < 1024)        return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export async function GET() {
  try {
    const files = readdirSync(MOCKUPS_DIR)
      .filter((f) => f.endsWith(".html"))
      .map((filename) => {
        const filepath = join(MOCKUPS_DIR, filename);
        const stat = statSync(filepath);
        const ticketId = filename.replace(/\.html$/, "");
        return {
          filename,
          ticketId,
          sizeBytes:     stat.size,
          sizeLabel:     fmtBytes(stat.size),
          modifiedAt:    stat.mtime.toISOString(),
          modifiedLabel: new Date(stat.mtime).toLocaleString("en-US", {
            month: "short", day: "numeric", year: "numeric",
            hour: "numeric", minute: "2-digit",
          }),
          hasAnalysis: existsSync(join(MOCKUPS_DIR, `${ticketId}.analysis.json`)),
        };
      })
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    return NextResponse.json(files);
  } catch {
    return NextResponse.json([]);
  }
}
