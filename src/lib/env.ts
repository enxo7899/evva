const value = (key: string, fallback?: string) => process.env[key] ?? fallback;

export const env = {
  nodeEnv: value("NODE_ENV", "development"),

  // Music generation
  generatedMusicProvider: value("GENERATED_MUSIC_PROVIDER", "replicate"),
  replicateApiToken: value("REPLICATE_API_TOKEN"),
  replicateMusicModel: value("REPLICATE_MUSIC_MODEL", "meta/musicgen"),

  // Video render / export
  mediaRendererProvider: value("MEDIA_RENDERER_PROVIDER", "ffmpeg"),
  ffmpegPath: value("FFMPEG_PATH", "ffmpeg"),
  ffprobePath: value("FFPROBE_PATH", "ffprobe")
};

/**
 * True when a real music provider is configured.
 * Today: Replicate. Falls back to the mock provider otherwise.
 */
export const hasRealMusicProvider =
  env.generatedMusicProvider === "replicate" && Boolean(env.replicateApiToken);
