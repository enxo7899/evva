export type Candidate = {
  id: `gsc_${string}`;
  title: string;
  tags: string[];
  whyItFits: string;
  isInstrumental: boolean;
  audioUrl: string;
  durationSec: number;
};

export type Analysis = {
  themes: string[];
  moods: string[];
  energy: number;
  pacing: "slow" | "medium" | "fast";
  summary: string;
};

export type VocalPreference = "instrumental_only" | "vocals_allowed" | "vocals_preferred";

export type MixPresetKey =
  | "balanced"
  | "music-forward"
  | "voice-friendly"
  | "original-audio-forward";

export type MixPreset = {
  value: MixPresetKey;
  label: string;
  description: string;
  originalAudioLevel: number;
  musicLevel: number;
};

export const MIX_PRESETS: MixPreset[] = [
  {
    value: "balanced",
    label: "Balanced",
    description: "Reel ambience sits with the score.",
    originalAudioLevel: 0.55,
    musicLevel: 0.7
  },
  {
    value: "music-forward",
    label: "Music forward",
    description: "Score leads. Montage-friendly.",
    originalAudioLevel: 0.25,
    musicLevel: 0.9
  },
  {
    value: "voice-friendly",
    label: "Voice friendly",
    description: "Dialogue stays readable.",
    originalAudioLevel: 0.8,
    musicLevel: 0.4
  },
  {
    value: "original-audio-forward",
    label: "Original forward",
    description: "Reel audio leads, score fills.",
    originalAudioLevel: 0.85,
    musicLevel: 0.3
  }
];

export const ACCEPTED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska"
];

export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatSeconds = (s: number) => {
  if (!Number.isFinite(s) || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
};

export const splitTags = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
