import { NextResponse } from "next/server";
import { createCompositionSchema } from "@/server/api/schemas";
import { createComposition } from "@/server/services/compositions";
import type { VideoAssetId } from "@/domain/ids";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createCompositionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const composition = await createComposition({
      videoAssetId: parsed.data.videoAssetId as VideoAssetId,
      direction: parsed.data.direction,
      candidateCount: parsed.data.candidateCount
    });
    return NextResponse.json({ composition }, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
