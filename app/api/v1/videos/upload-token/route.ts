import { NextResponse } from "next/server";
import {
  handleUpload,
  type HandleUploadBody
} from "@vercel/blob/client";
import { hasBlobStore } from "@/server/runtime/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Direct-to-Blob upload token handler.
 *
 * On Vercel this endpoint is called twice in the flow:
 *   1. Browser requests a one-time upload URL + token for the pending file.
 *   2. After the browser finishes uploading directly to Blob, Vercel Blob
 *      sends us an `onUploadCompleted` callback so we can record the URL
 *      server-side if needed.
 *
 * Returning 501 when no Blob token is configured keeps local dev honest —
 * the client-side upload flow inspects this and falls back to multipart.
 */

const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska"
];

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export async function POST(request: Request) {
  if (!hasBlobStore()) {
    return NextResponse.json(
      { error: "Blob storage not configured on this server." },
      { status: 501 }
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ALLOWED_CONTENT_TYPES,
        maximumSizeInBytes: MAX_UPLOAD_BYTES,
        addRandomSuffix: true,
        tokenPayload: JSON.stringify({ kind: "evva-upload" })
      }),
      onUploadCompleted: async () => {
        // The register endpoint is the authoritative step that creates a
        // VideoAsset in KV. We don't need to do anything here — the webhook
        // is fire-and-forget and may land on a different container than the
        // subsequent API calls.
      }
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token generation failed." },
      { status: 400 }
    );
  }
}
