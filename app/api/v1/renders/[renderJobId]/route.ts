import { NextResponse } from "next/server";
import { getRenderJob } from "@/server/services/renders";
import type { RenderJobId } from "@/domain/ids";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ renderJobId: string }> }
) {
  const { renderJobId } = await context.params;

  if (!renderJobId.startsWith("rnd_")) {
    return NextResponse.json({ error: "Invalid render id" }, { status: 400 });
  }

  const renderJob = await getRenderJob(renderJobId as RenderJobId);
  if (!renderJob) {
    return NextResponse.json({ error: "Render job not found" }, { status: 404 });
  }

  return NextResponse.json({ renderJob });
}
