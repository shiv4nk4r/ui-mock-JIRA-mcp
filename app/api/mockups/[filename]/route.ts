import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { homedir } from "os";

export const dynamic = "force-dynamic";

const MOCKUPS_DIR = join(homedir(), "claude-ui-designs");

export async function GET(
  _req: Request,
  { params }: { params: { filename: string } },
) {
  const { filename } = params;

  // Security: only allow .html files and no path traversal
  if (!filename.endsWith(".html") || filename.includes("/") || filename.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const filepath = resolve(join(MOCKUPS_DIR, filename));
  if (!filepath.startsWith(MOCKUPS_DIR) || !existsSync(filepath)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const html = readFileSync(filepath, "utf-8");
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new Response("Error reading file", { status: 500 });
  }
}
