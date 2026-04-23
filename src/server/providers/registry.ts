import { env, resolveMusicProviderMode } from "@/lib/env";
import type { MediaRenderer } from "@/server/providers/media/interface";
import { createFfmpegRenderer } from "@/server/providers/media/ffmpeg";
import { createPreviewCopyRenderer } from "@/server/providers/media/preview-copy";
import type { MusicProvider } from "@/server/providers/music/interface";
import { createElevenLabsProvider } from "@/server/providers/music/elevenlabs";
import { createMockMusicProvider } from "@/server/providers/music/mock";
import { createReplicateProvider } from "@/server/providers/music/replicate";

/**
 * Providers are instantiated once per process and cached on globalThis so
 * Next.js HMR doesn't create duplicates during development.
 *
 * Music provider selection is controlled by GENERATED_MUSIC_PROVIDER:
 *   - "elevenlabs" (default) → ElevenLabs Music API, requires ELEVENLABS_API_KEY
 *   - "replicate"             → meta/musicgen on Replicate, requires REPLICATE_API_TOKEN
 *   - "mock"                  → seeded sine-wave sketches (offline dev only)
 *
 * If the real provider's key is missing, we fall back to the mock provider
 * and label it in the UI via GET /api/v1/config.
 */

type G = typeof globalThis & {
  __evvaMusic?: MusicProvider;
  __evvaRenderer?: MediaRenderer;
};
const g = globalThis as G;

function buildMusicProvider(): MusicProvider {
  const mode = resolveMusicProviderMode();
  if (mode === "elevenlabs") return createElevenLabsProvider();
  if (mode === "replicate") return createReplicateProvider();
  return createMockMusicProvider();
}

export const musicProvider: MusicProvider =
  g.__evvaMusic ?? (g.__evvaMusic = buildMusicProvider());

export const mediaRenderer: MediaRenderer =
  g.__evvaRenderer ??
  (g.__evvaRenderer =
    env.mediaRendererProvider === "ffmpeg"
      ? createFfmpegRenderer()
      : createPreviewCopyRenderer());
