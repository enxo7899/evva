import type { Direction, MusicProviderMode } from "@/domain/contracts";
import type { CompositionId } from "@/domain/ids";

export interface MusicGenerationRequest {
  compositionId: CompositionId;
  direction: Direction;
  /** Seconds of audio requested per candidate. Provider may clamp. */
  targetDurationSec: number;
  /** How many candidates the user asked for. */
  candidateCount: number;
}

/**
 * Provider-opaque handle returned by `submit`. The service stores this
 * and passes it back on every subsequent provider call for the same job.
 */
export interface MusicGenerationTicket {
  providerJobIds: string[];
  prompts: string[];
  titles: string[];
  /** Model metadata captured at submit time, for the candidates' DTO. */
  isInstrumental: boolean;
  targetDurationSec: number;
}

export interface MusicGenerationStatus {
  status: "queued" | "processing" | "completed" | "failed";
  /** 0..1 progress. */
  progress: number;
  error?: string;
}

export interface MusicGenerationResult {
  externalId: string;
  title: string;
  prompt: string;
  /** Publicly-servable URL (under public/ in local mode). */
  audioUrl: string;
  durationSec: number;
  tags: string[];
  isInstrumental: boolean;
}

export interface MusicProvider {
  readonly name: MusicProviderMode;
  submit(req: MusicGenerationRequest): Promise<MusicGenerationTicket>;
  getStatus(ticket: MusicGenerationTicket): Promise<MusicGenerationStatus>;
  fetchResults(ticket: MusicGenerationTicket): Promise<MusicGenerationResult[]>;
}
