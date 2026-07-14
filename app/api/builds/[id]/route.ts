import { existsSync } from "fs";
import { NextResponse } from "next/server";
import { MD_REPO_ROOT } from "@lib/build/config";
import { jobRecordToBuildState } from "@lib/build/job-store";
import { getBuildJobDetail, retryBuildJob } from "@lib/build/run-build-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Build detail + agent logs (id = jobId or reviewId). */
export async function GET(
  request: Request,
  context: { params: { id: string } },
) {
  const id = context.params.id;
  const { searchParams } = new URL(request.url);
  const afterTs = Number(searchParams.get("afterTs") || "0") || 0;

  const detail = getBuildJobDetail(id, { afterTs });
  if (!detail) {
    return NextResponse.json({ error: "Build not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

/** Retry a failed/finished build — starts a new background job. */
export async function POST(
  request: Request,
  context: { params: { id: string } },
) {
  const id = context.params.id;
  const body = (await request.json().catch(() => ({}))) as { action?: string };

  if (body.action && body.action !== "retry") {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  if (!existsSync(MD_REPO_ROOT)) {
    return NextResponse.json(
      { error: `MD_REPO_ROOT does not exist: ${MD_REPO_ROOT}` },
      { status: 500 },
    );
  }

  try {
    const job = retryBuildJob(id);
    return NextResponse.json({
      ok: true,
      build: jobRecordToBuildState(job),
      jobId: job.jobId,
      message: "Retry started in the background",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /not found/i.test(message) ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
