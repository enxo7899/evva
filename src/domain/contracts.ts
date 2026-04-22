import type {
  CandidateId,
  CompositionId,
  RenderJobId,
  VideoAssetId
} from "./ids";

export type JobStatus = "queued" | "processing" | "completed" | "failed";

export type VocalPreference =
  | "instrumental_only"
  | "vocals_allowed"
  | "vocals_preferred";

export type MixPreset =
  | "balanced"
  | "music-forward"
  | "voice-friendly"
  | "original-audio-forward";

export type RendererMode = "ffmpeg" | "preview-copy";
export type MusicProviderMode = "replicate" | "mock";

/**
 * An uploaded reel tracked for the current session only.
 * Persisted in an in-memory session store; files live under public/uploads/.
 */
export interface VideoAsset {
  id: VideoAssetId;
  sourceUrl: string;
  originalFilename: string;
  durationSec: number;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

/**
 * Minimal, honest per-clip facts. No invented moods/themes.
 * Extended later when real multimodal analysis is wired in.
 */
export interface VideoAnalysis {
  durationSec: number;
  aspectRatio?: string;
  summary: string;
}

export interface Direction {
  freeText?: string;
  desiredVibe?: string[];
  exclusions?: string[];
  vocalPreference?: VocalPreference;
}

export interface Candidate {
  id: CandidateId;
  compositionId: CompositionId;
  title: string;
  prompt: string;
  durationSec: number;
  audioUrl: string;
  tags: string[];
  isInstrumental: boolean;
  provider: MusicProviderMode;
}

/**
 * One user-facing "compose soundtrack" run. Owns the generation lifecycle
 * and (optionally) which candidate the user selected. No separate
 * IntentProfile / Request / Selection records in this MVP.
 */
export interface CompositionJob {
  id: CompositionId;
  videoAssetId: VideoAssetId;
  status: JobStatus;
  progress: number;
  analysis: VideoAnalysis;
  direction: Direction;
  provider: MusicProviderMode;
  candidates: Candidate[];
  selectedCandidateId?: CandidateId;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MixSettings {
  preset: MixPreset;
  originalAudioLevel: number;
  musicLevel: number;
  fadeInSec?: number;
  fadeOutSec?: number;
}

export interface RenderJob {
  id: RenderJobId;
  compositionId: CompositionId;
  videoAssetId: VideoAssetId;
  candidateId: CandidateId;
  mix: MixSettings;
  mode: RendererMode;
  status: JobStatus;
  progress: number;
  outputUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}
