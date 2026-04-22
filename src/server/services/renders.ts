import type {
  MixSettings,
  RenderJob
} from "@/domain/contracts";
import type {
  CompositionId,
  RenderJobId
} from "@/domain/ids";
import { createId } from "@/server/runtime/ids";
import {
  compositionStore,
  renderStore,
  videoStore
} from "@/server/runtime/session-store";
import { mediaRenderer } from "@/server/providers/registry";

export async function createRenderJob(input: {
  compositionId: CompositionId;
  mix: MixSettings;
}): Promise<RenderJob> {
  const composition = compositionStore.get(input.compositionId);
  if (!composition) throw new Error("Composition not found.");
  if (!composition.selectedCandidateId) {
    throw new Error("Select a candidate before rendering.");
  }
  const candidate = composition.candidates.find(
    (c) => c.id === composition.selectedCandidateId
  );
  if (!candidate) throw new Error("Selected candidate is no longer available.");

  const video = videoStore.get(composition.videoAssetId);
  if (!video) throw new Error("Source video is no longer available.");

  const id = createId("rnd") as RenderJobId;
  const now = new Date().toISOString();

  const job: RenderJob = {
    id,
    compositionId: composition.id,
    videoAssetId: composition.videoAssetId,
    candidateId: candidate.id,
    mix: input.mix,
    mode: mediaRenderer.mode,
    status: "queued",
    progress: 0,
    createdAt: now,
    updatedAt: now
  };

  renderStore.set(id, job);

  // Fire and forget — provider updates its own internal state, we poll.
  void mediaRenderer
    .enqueue({
      renderJobId: id,
      videoSourceUrl: video.sourceUrl,
      generatedAudioUrl: candidate.audioUrl,
      mix: input.mix
    })
    .catch((err) => {
      const current = renderStore.get(id);
      if (!current) return;
      renderStore.set(id, {
        ...current,
        status: "failed",
        progress: 1,
        error: err instanceof Error ? err.message : "Renderer rejected the job.",
        updatedAt: new Date().toISOString()
      });
    });

  return job;
}

export async function getRenderJob(id: RenderJobId): Promise<RenderJob | null> {
  const current = renderStore.get(id);
  if (!current) return null;

  if (current.status === "completed" || current.status === "failed") {
    return current;
  }

  const status = await mediaRenderer.getStatus(id);
  const updated: RenderJob = {
    ...current,
    status: status.status,
    progress: status.progress,
    outputUrl: status.outputUrl ?? current.outputUrl,
    error: status.error ?? current.error,
    updatedAt: new Date().toISOString()
  };

  renderStore.set(id, updated);
  return updated;
}
