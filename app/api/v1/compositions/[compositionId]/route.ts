import { NextResponse } from "next/server";
import { getComposition } from "@/server/services/compositions";
import type { CompositionId } from "@/domain/ids";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ compositionId: string }> }
) {
  const { compositionId } = await context.params;

  if (!compositionId.startsWith("cmp_")) {
    return NextResponse.json(
      { error: "Invalid composition id" },
      { status: 400 }
    );
  }

  try {
    const composition = await getComposition(compositionId as CompositionId);
    if (!composition) {
      return NextResponse.json(
        { error: "Composition not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ composition });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
