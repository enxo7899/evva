import type {
  Candidate,
  CompositionJob,
  Direction,
  JobStatus,
  VideoAsset
} from "@/domain/contracts";
import type {
  CandidateId,
  CompositionId,
  VideoAssetId
} from "@/domain/ids";
import { analyzeVideo } from "@/server/runtime/analysis";
import { createId } from "@/server/runtime/ids";
import {
  compositionStore,
  videoStore
} from "@/server/runtime/session-store";
import { musicProvider } from "@/server/providers/registry";
import type {
  MusicGenerationTicket
} from "@/server/providers/music/interface";

/**
 * Internal wrapper so provider tickets stay out of the public API payload
 * but remain available across polls for the same composition.
 */
type Internal = CompositionJob & { _ticket?: MusicGenerationTicket };

const toPublic = (job: Internal): CompositionJob => {
  const { _ticket: _strip, ...rest } = job;
  void _strip;
  return rest;
};

export async function registerVideoAsset(
  input: Omit<VideoAsset, "id" | "createdAt">
): Promise<VideoAsset> {
  const id = createId("vid") as VideoAssetId;
  const asset: VideoAsset = {
    id,
    createdAt: new Date().toISOString(),
    ...input
  };
  videoStore.set(id, asset);
  return asset;
}

export async function getVideoAsset(id: VideoAssetId): Promise<VideoAsset | null> {
  return videoStore.get(id);
}

export async function createComposition(input: {
  videoAssetId: VideoAssetId;
  direction?: Direction;
  candidateCount?: number;
}): Promise<CompositionJob> {
  const video = videoStore.get(input.videoAssetId);
  if (!video) throw new Error("Video not found. Upload it first.");

  const analysis = await analyzeVideo(video);
  const direction: Direction = input.direction ?? {};
  const candidateCount = input.candidateCount ?? 3;

  const compositionId = createId("cmp") as CompositionId;
  const now = new Date().toISOString();

  const ticket = await musicProvider.submit({
    compositionId,
    direction,
    targetDurationSec: Math.max(5, Math.min(30, Math.round(analysis.durationSec || 15))),
    candidateCount
  });

  const job: Internal = {
    id: compositionId,
    videoAssetId: video.id,
    status: "queued",
    progress: 0.05,
    analysis,
    direction,
    provider: musicProvider.name,
    candidates: [],
    createdAt: now,
    updatedAt: now,
    _ticket: ticket
  };

  compositionStore.set(compositionId, job);
  return toPublic(job);
}

export async function getComposition(
  id: CompositionId
): Promise<CompositionJob | null> {
  const current = compositionStore.get(id) as Internal | null;
  if (!current) return null;

  // Terminal states short-circuit.
  if (current.status === "completed" || current.status === "failed") {
    return toPublic(current);
  }
  if (!current._ticket) {
    return toPublic(current);
  }

  const status = await musicProvider.getStatus(current._ticket);

  let next: Internal = {
    ...current,
    status: status.status as JobStatus,
    progress: status.progress,
    error: status.status === "failed" ? status.error : undefined,
    updatedAt: new Date().toISOString()
  };

  if (status.status === "completed" && current.candidates.length === 0) {
    const results = await musicProvider.fetchResults(current._ticket);
    const candidates: Candidate[] = results.map((r) => ({
      id: createId("gsc") as CandidateId,
      compositionId: current.id,
      title: r.title,
      prompt: r.prompt,
      durationSec: r.durationSec,
      audioUrl: r.audioUrl,
      tags: r.tags,
      isInstrumental: r.isInstrumental,
      provider: musicProvider.name
    }));
    next = { ...next, candidates };
  }

  compositionStore.set(id, next);
  return toPublic(next);
}

export async function selectCandidate(input: {
  compositionId: CompositionId;
  candidateId: CandidateId;
}): Promise<CompositionJob> {
  const job = compositionStore.get(input.compositionId) as Internal | null;
  if (!job) throw new Error("Composition not found.");
  const candidate = job.candidates.find((c) => c.id === input.candidateId);
  if (!candidate) throw new Error("Candidate not found on this composition.");

  const next: Internal = {
    ...job,
    selectedCandidateId: input.candidateId,
    updatedAt: new Date().toISOString()
  };
  compositionStore.set(input.compositionId, next);
  return toPublic(next);
}
