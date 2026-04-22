import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { registerVideoAsset } from "@/server/services/compositions";

export const runtime = "nodejs";

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
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  await mkdir(uploadDir, { recursive: true });

  const outputPath = path.join(uploadDir, uniqueName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(outputPath, buffer);

  const durationFromClient = Number(formData.get("durationSec") ?? 0);
  const durationSec =
    Number.isFinite(durationFromClient) && durationFromClient > 0
      ? durationFromClient
      : 15;

  const sourceUrl = `/uploads/${uniqueName}`;

  const videoAsset = await registerVideoAsset({
    sourceUrl,
    originalFilename: file.name || uniqueName,
    durationSec,
    mimeType: file.type,
    sizeBytes: file.size
  });

  return NextResponse.json({ videoAsset }, { status: 201 });
}
