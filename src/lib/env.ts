const value = (key: string, fallback?: string) => process.env[key] ?? fallback;

export const env = {
  nodeEnv: value("NODE_ENV", "development"),

  // Music generation
  generatedMusicProvider: value("GENERATED_MUSIC_PROVIDER", "elevenlabs"),

  // ElevenLabs
  elevenLabsApiKey: value("ELEVENLABS_API_KEY"),
  elevenLabsMusicModel: value("ELEVENLABS_MUSIC_MODEL"),

  // Replicate (alternate)
  replicateApiToken: value("REPLICATE_API_TOKEN"),
  replicateMusicModel: value("REPLICATE_MUSIC_MODEL", "meta/musicgen"),

  // Video render / export
  mediaRendererProvider: value("MEDIA_RENDERER_PROVIDER", "ffmpeg"),
  ffmpegPath: value("FFMPEG_PATH", "ffmpeg"),
  ffprobePath: value("FFPROBE_PATH", "ffprobe")
};

/**
 * Resolves which music provider the registry should instantiate. Falls back
 * to the mock provider when the requested real provider is missing its key.
 */
export function resolveMusicProviderMode(): "elevenlabs" | "replicate" | "mock" {
  const requested = (env.generatedMusicProvider ?? "elevenlabs").toLowerCase();
  if (requested === "elevenlabs") {
    return env.elevenLabsApiKey ? "elevenlabs" : "mock";
  }
  if (requested === "replicate") {
    return env.replicateApiToken ? "replicate" : "mock";
  }
  return "mock";
}
