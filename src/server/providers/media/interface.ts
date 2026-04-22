import type { MixSettings, RendererMode } from "@/domain/contracts";

export interface RenderRequest {
  renderJobId: string;
  videoSourceUrl: string;   // public path (/uploads/foo.mp4)
  generatedAudioUrl: string; // public path (/generated/foo.wav)
  mix: MixSettings;
}

export interface RenderStatus {
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  outputUrl?: string;
  error?: string;
}

export interface MediaRenderer {
  readonly mode: RendererMode;
  readonly mixesAudio: boolean;
  enqueue(req: RenderRequest): Promise<void>;
  getStatus(renderJobId: string): Promise<RenderStatus>;
}
