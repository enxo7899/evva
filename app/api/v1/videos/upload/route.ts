import path from "node:path";
import { NextResponse } from "next/server";
import { putBuffer } from "@/server/runtime/storage";
import { registerVideoAsset } from "@/server/services/compositions";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Multipart upload route.
 *
 * On Vercel, serverless request bodies are capped (~4.5MB on most plans),
 * so large reels must use the direct-to-Blob flow (see `../upload-token`
 * and `../register`). This endpoint remains useful:
 *   - locally, where the Node server has no body-size cap;
 *   - on Vercel, for small test files.
 * Either way, the uploaded bytes are persisted via the storage abstraction
 * (Blob in production, `public/uploads/` in dev).
 */

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska"
]);

const sanitizeFilename = (filename: string) =>
  filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-");

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Video file is required." },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported video type. Please upload MP4, MOV, WEBM, or MKV." },
      { status: 400 }
    );
  }

  if (file.size > MAX_VIDEO_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum supported size is 200MB." },
      { status: 400 }
    );
  }

  const filename = sanitizeFilename(file.name || "reel.mp4");
  const extension = path.extname(filename) || ".mp4";
  const uniqueName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${extension}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const stored = await putBuffer(
    `uploads/${uniqueName}`,
    buffer,
    file.type || "video/mp4"
  );

  const durationFromClient = Number(formData.get("durationSec") ?? 0);
  const durationSec =
    Number.isFinite(durationFromClient) && durationFromClient > 0
      ? durationFromClient
      : 15;

  const widthFromClient = toPositiveInt(formData.get("width"));
  const heightFromClient = toPositiveInt(formData.get("height"));

  const videoAsset = await registerVideoAsset({
    sourceUrl: stored.url,
    originalFilename: file.name || uniqueName,
    durationSec,
    mimeType: file.type,
    sizeBytes: file.size,
    width: widthFromClient,
    height: heightFromClient
  });

  return NextResponse.json({ videoAsset }, { status: 201 });
}

function toPositiveInt(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined;
}
