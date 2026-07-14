import { NextResponse } from "next/server";
import { listAllBuildJobs } from "@lib/build/run-build-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** List all build jobs (newest first) for the Builds monitor page. */
export async function GET() {
  const builds = listAllBuildJobs();
  return NextResponse.json({
    builds: builds.map((b) => ({
      jobId: b.jobId,
      reviewId: b.reviewId,
      ticketId: b.ticketId,
      ticketSummary: b.ticketSummary,
      branchName: b.branchName,
      status: b.status,
      phase: b.phase,
      message: b.message,
      prUrl: b.prUrl,
      prNumber: b.prNumber,
      error: b.error,
      model: b.model,
      files: b.files,
      logCount: b.logCount,
      active: b.active,
      startedAt: b.startedAt,
      updatedAt: b.updatedAt,
      finishedAt: b.finishedAt,
    })),
  });
}
