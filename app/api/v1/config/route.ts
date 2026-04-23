import { NextResponse } from "next/server";
import type { ConfigResponse } from "@/contracts/api";
import { mediaRenderer, musicProvider } from "@/server/providers/registry";
import { hasBlobStore } from "@/server/runtime/storage";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export async function GET() {
  const music: ConfigResponse["music"] =
    musicProvider.name === "elevenlabs"
      ? {
          mode: "elevenlabs",
          real: true,
          note: "Using ElevenLabs Music. Candidates are real generated audio."
        }
      : musicProvider.name === "replicate"
        ? {
            mode: "replicate",
            real: true,
            note: "Using Replicate (meta/musicgen). Candidates are real generated audio."
          }
        : {
            mode: "mock",
            real: false,
            note: "Mock music provider. Candidates are seeded sine-wave sketches. Set GENERATED_MUSIC_PROVIDER=elevenlabs + ELEVENLABS_API_KEY (or replicate + REPLICATE_API_TOKEN) to enable real generation."
          };

  const renderer: ConfigResponse["renderer"] =
    mediaRenderer.mode === "ffmpeg"
      ? {
          mode: "ffmpeg",
          mixesAudio: true,
          note: "ffmpeg active. Export bakes the selected track and your mix levels into a real MP4."
        }
      : {
          mode: "preview-copy",
          mixesAudio: false,
          note: "Preview-copy export. The live in-browser mix is the authoritative audition; install ffmpeg and set MEDIA_RENDERER_PROVIDER=ffmpeg to bake a real mixed file."
        };

  const upload: ConfigResponse["upload"] = {
    mode: hasBlobStore() ? "direct" : "multipart",
    maxBytes: MAX_UPLOAD_BYTES
  };

  const body: ConfigResponse = { music, renderer, upload };
  return NextResponse.json(body);
}
