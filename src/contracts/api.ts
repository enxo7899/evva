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
  upload: {
    /**
     * "direct" = browser uploads straight to Vercel Blob using a short-lived
     *            token (required on Vercel for files larger than ~4.5MB).
     * "multipart" = browser POSTs FormData to /api/v1/videos/upload. Used in
     *               local dev where the Node server has no body-size cap.
     */
    mode: "direct" | "multipart";
    maxBytes: number;
  };
}

export interface ErrorResponse {
  error: string | Record<string, unknown>;
}
