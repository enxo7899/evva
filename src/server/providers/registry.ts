import { env, hasRealMusicProvider } from "@/lib/env";
import type { MediaRenderer } from "@/server/providers/media/interface";
import { createFfmpegRenderer } from "@/server/providers/media/ffmpeg";
import { createPreviewCopyRenderer } from "@/server/providers/media/preview-copy";
import type { MusicProvider } from "@/server/providers/music/interface";
import { createMockMusicProvider } from "@/server/providers/music/mock";
import { createReplicateProvider } from "@/server/providers/music/replicate";

/**
 * Providers are instantiated once per process and cached on globalThis so
 * Next.js HMR doesn't create duplicates during development.
 */

type G = typeof globalThis & {
  __evvaMusic?: MusicProvider;
  __evvaRenderer?: MediaRenderer;
};
const g = globalThis as G;

export const musicProvider: MusicProvider =
  g.__evvaMusic ??
  (g.__evvaMusic = hasRealMusicProvider
    ? createReplicateProvider()
    : createMockMusicProvider());

export const mediaRenderer: MediaRenderer =
  g.__evvaRenderer ??
  (g.__evvaRenderer =
    env.mediaRendererProvider === "ffmpeg"
      ? createFfmpegRenderer()
      : createPreviewCopyRenderer());
