import { NextResponse } from "next/server";
import { hasBlobStore } from "@/server/runtime/storage";
import { hasKvStore } from "@/server/runtime/kv";
import { resolveMusicProviderMode } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Deploy diagnostics. Hit this endpoint on a live deploy to confirm that
 * Blob + KV stores are wired up and the expected music provider is active.
 *
 * Deliberately NEVER echoes the value of any secret — only booleans and the
 * resolved provider modes. Safe to leave public for debugging.
 */
export async function GET() {
  const blob = hasBlobStore();
  const kv = hasKvStore();
  const music = resolveMusicProviderMode();

  const readiness: Array<{ ok: boolean; label: string; fix?: string }> = [
    {
      ok: blob,
      label: "Vercel Blob token (BLOB_READ_WRITE_TOKEN)",
      fix: "Add a Blob store in Vercel → Storage → Blob, then redeploy."
    },
    {
      ok: kv,
      label: "Vercel KV / Upstash (KV_REST_API_URL + KV_REST_API_TOKEN)",
      fix: "Add a KV store in Vercel → Storage → KV (or the Upstash Redis integration), then redeploy."
    },
    {
      ok: music !== "mock" || process.env.GENERATED_MUSIC_PROVIDER === "mock",
      label: "Music provider key matches GENERATED_MUSIC_PROVIDER",
      fix: "Set ELEVENLABS_API_KEY or REPLICATE_API_TOKEN, or set GENERATED_MUSIC_PROVIDER=mock."
    }
  ];

  return NextResponse.json({
    ok: readiness.every((r) => r.ok),
    checks: readiness,
    resolved: {
      uploadMode: blob ? "direct" : "multipart",
      musicProvider: music,
      requestedMusicProvider: process.env.GENERATED_MUSIC_PROVIDER ?? null,
      mediaRenderer: process.env.MEDIA_RENDERER_PROVIDER ?? "ffmpeg"
    }
  });
}
