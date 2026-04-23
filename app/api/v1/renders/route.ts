import { NextResponse } from "next/server";
import { createRenderSchema } from "@/server/api/schemas";
import { createRenderJob } from "@/server/services/renders";
import type { CompositionId } from "@/domain/ids";

export const runtime = "nodejs";
// Render runs ffmpeg synchronously. For short reels this is a few seconds;
// cap well below Pro's 300s ceiling.
export const maxDuration = 120;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createRenderSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const renderJob = await createRenderJob({
      compositionId: parsed.data.compositionId as CompositionId,
      mix: parsed.data.mix
    });
    return NextResponse.json({ renderJob }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
