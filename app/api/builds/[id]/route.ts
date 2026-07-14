import { NextResponse } from "next/server";
import { getBuildJobDetail } from "@lib/build/run-build-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
