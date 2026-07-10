import { NextResponse } from "next/server";
import type { ReviewItem, MockupSession } from "@lib/types";
import { buildAgentPrompt, buildExecutionDetails } from "@lib/utils/execution-details";
import type { ExecutionDetails } from "@lib/utils/execution-details";

export const dynamic = "force-dynamic";

interface RequestBody {
  review: ReviewItem;
  session?: MockupSession | null;
  fallbackPrompt?: string;
}

function enhancePrompt(base: string, details: ExecutionDetails): string {
  const fileHints = details.changes
    .filter((c) => c.source === "effort")
    .map((c) => `- **${c.location}**: ${c.description}${c.effort ? ` (${c.effort})` : ""}`)
    .join("\n");

  if (!fileHints) return base;

  const insert = [
    "",
    "## Priority implementation map",
    "Work through these in order. Confirm file paths with codebase search before editing:",
    "",
    fileHints,
    "",
  ].join("\n");

  const goalIdx = base.indexOf("## Required changes");
  if (goalIdx >= 0) {
    return base.slice(0, goalIdx) + insert + base.slice(goalIdx);
  }
  return base + insert;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const { review, session, fallbackPrompt } = body;

    if (!review?.ticketId) {
      return NextResponse.json({ error: "Missing review data" }, { status: 400 });
    }

    const details = buildExecutionDetails(review, session ?? null);
    const base = fallbackPrompt ?? buildAgentPrompt(details, review, session ?? null);
    const prompt = enhancePrompt(base, details);

    return NextResponse.json({ prompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
