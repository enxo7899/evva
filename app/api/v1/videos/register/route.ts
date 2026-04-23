import { NextResponse } from "next/server";
import { z } from "zod";
import { registerVideoAsset } from "@/server/services/compositions";

export const runtime = "nodejs";
export const maxDuration = 10;

/**
 * Register an already-uploaded video.
 *
 * Used by the direct-to-Blob upload flow: the browser uploads bytes straight
 * to Blob, then calls this endpoint with the resulting URL + metadata so we
 * can create a VideoAsset in KV. The register step is what the rest of the
 * API treats as "the upload happened".
 */

const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska"
]);

const bodySchema = z.object({
  url: z.string().url(),
  pathname: z.string().min(1).optional(),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  durationSec: z.number().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body." },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(parsed.mimeType)) {
    return NextResponse.json(
      { error: "Unsupported video type." },
      { status: 400 }
    );
  }

  const videoAsset = await registerVideoAsset({
    sourceUrl: parsed.url,
    originalFilename: parsed.filename,
    durationSec: parsed.durationSec ?? 15,
    mimeType: parsed.mimeType,
    sizeBytes: parsed.sizeBytes,
    width: parsed.width,
    height: parsed.height
  });

  return NextResponse.json({ videoAsset }, { status: 201 });
}
