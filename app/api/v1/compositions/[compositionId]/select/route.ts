import { NextResponse } from "next/server";
import { selectCandidateSchema } from "@/server/api/schemas";
import { selectCandidate } from "@/server/services/compositions";
import type { CandidateId, CompositionId } from "@/domain/ids";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ compositionId: string }> }
) {
  const { compositionId } = await context.params;
  if (!compositionId.startsWith("cmp_")) {
    return NextResponse.json(
      { error: "Invalid composition id" },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = selectCandidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const composition = await selectCandidate({
      compositionId: compositionId as CompositionId,
      candidateId: parsed.data.candidateId as CandidateId
    });
    return NextResponse.json({ composition });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
