import type {
  CompositionJob,
  Direction,
  MixSettings,
  MusicProviderMode,
  RenderJob,
  RendererMode,
  VideoAsset
} from "@/domain/contracts";

export interface VideoUploadResponse {
  videoAsset: VideoAsset;
}

export interface CreateCompositionRequest {
  videoAssetId: `vid_${string}`;
  direction?: Direction;
  candidateCount?: number;
}

export interface CompositionResponse {
  composition: CompositionJob;
}

export interface SelectCandidateRequest {
  candidateId: `gsc_${string}`;
}

export interface CreateRenderRequest {
  compositionId: `cmp_${string}`;
  mix: MixSettings;
}

export interface RenderResponse {
  renderJob: RenderJob;
}

export interface ConfigResponse {
  music: {
    mode: MusicProviderMode;
    real: boolean;
    note: string;
  };
  renderer: {
    mode: RendererMode;
    mixesAudio: boolean;
    note: string;
  };
}

export interface ErrorResponse {
  error: string | Record<string, unknown>;
}
