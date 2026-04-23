"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createComposition,
  createRender,
  fetchConfig,
  getComposition,
  getRender,
  selectCandidate,
  uploadVideoFile
} from "@features/generation/api";
import { useJobPolling } from "@hooks/use-job-polling";
import type { ConfigResponse } from "@/contracts/api";
import type {
  Candidate as DomainCandidate,
  CompositionJob,
  JobStatus,
  VideoAnalysis as DomainAnalysis,
  VocalPreference
} from "@/domain/contracts";
import { CandidatesSection } from "./candidates";
import { DirectionSection } from "./direction";
import { ExportSection, type RendererMode } from "./export-bar";
import {
  MIX_PRESETS,
  type Candidate as UiCandidate,
  type MixPresetKey
} from "./models";
import { ProgressRail, type StudioStep } from "./progress-rail";
import { Button, SectionLabel, cn } from "./primitives";
import { Stage } from "./stage";
import { UploadHero } from "./upload-hero";
import { IconSparkle, IconUpload } from "./icons";

export function StudioShell() {
  // ---- Source / upload ----
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [videoAssetId, setVideoAssetId] = useState<`vid_${string}` | null>(null);
  const [uploading, setUploading] = useState(false);
  const [videoDims, setVideoDims] = useState<{ width: number; height: number } | null>(null);

  // ---- Direction ----
  const [freeText, setFreeText] = useState("");
  const [vibe, setVibe] = useState<string[]>([]);
  const [exclusions, setExclusions] = useState("");
  const [vocal, setVocal] = useState<VocalPreference>("instrumental_only");

  // ---- Composition (generation) ----
  const [compositionId, setCompositionId] = useState<`cmp_${string}` | null>(null);
  const [compositionStatus, setCompositionStatus] = useState<JobStatus | "idle">("idle");
  const [compositionProgress, setCompositionProgress] = useState(0);
  const [candidates, setCandidates] = useState<UiCandidate[]>([]);
  const [analysis, setAnalysis] = useState<DomainAnalysis | null>(null);

  // ---- Selection + mix ----
  const [selectedCandidateId, setSelectedCandidateId] = useState<`gsc_${string}` | null>(null);
  const [preset, setPreset] = useState<MixPresetKey>("balanced");
  const [levels, setLevels] = useState({
    music: MIX_PRESETS[0].musicLevel,
    original: MIX_PRESETS[0].originalAudioLevel
  });

  // ---- Render ----
  const [renderJobId, setRenderJobId] = useState<`rnd_${string}` | null>(null);
  const [renderStatus, setRenderStatus] = useState<JobStatus | "idle">("idle");
  const [renderProgress, setRenderProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  // ---- Config (honest provider disclosure) ----
  const [config, setConfig] = useState<ConfigResponse | null>(null);

  // ---- UX ----
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const uploadLock = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchConfig()
      .then((c) => {
        if (!cancelled) setConfig(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.id === selectedCandidateId) ?? null,
    [candidates, selectedCandidateId]
  );

  const currentStep: StudioStep = useMemo(() => {
    if (!videoAssetId) return "upload";
    if (compositionStatus === "idle") return "direct";
    if (compositionStatus !== "completed") return "generate";
    if (!selectedCandidateId) return "mix";
    return "export";
  }, [compositionStatus, selectedCandidateId, videoAssetId]);

  const rendererMode: RendererMode = config?.renderer?.mode ?? null;

  // ---- Flow ----

  const handleFile = async (file: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setErrorMessage(null);

    // Reset downstream state on new source.
    setVideoAssetId(null);
    setVideoDims(null);
    setCompositionId(null);
    setCompositionStatus("idle");
    setCompositionProgress(0);
    setCandidates([]);
    setAnalysis(null);
    setSelectedCandidateId(null);
    setRenderJobId(null);
    setRenderStatus("idle");
    setRenderProgress(0);
    setOutputUrl(null);

    const meta = await readVideoMeta(objectUrl);
    if (meta.width && meta.height) {
      setVideoDims({ width: meta.width, height: meta.height });
    }
    if (uploadLock.current) return;
    uploadLock.current = true;
    try {
      setUploading(true);
      const res = await uploadVideoFile({
        file,
        durationSec: meta.durationSec,
        width: meta.width,
        height: meta.height
      });
      setVideoAssetId(res.videoAsset.id);
      if (res.videoAsset.width && res.videoAsset.height) {
        setVideoDims({
          width: res.videoAsset.width,
          height: res.videoAsset.height
        });
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Upload failed.");
      setSelectedFile(null);
      URL.revokeObjectURL(objectUrl);
      setPreviewUrl(null);
    } finally {
      setUploading(false);
      uploadLock.current = false;
    }
  };

  const applyComposition = (composition: CompositionJob) => {
    setCompositionStatus(composition.status);
    setCompositionProgress(composition.progress);
    setAnalysis(composition.analysis);
    setCandidates(mapCandidates(composition.candidates));
    if (composition.selectedCandidateId) {
      setSelectedCandidateId(composition.selectedCandidateId);
    }
    if (composition.status === "failed") {
      setErrorMessage(composition.error ?? "Composition failed.");
    }
  };

  const pollComposition = async () => {
    if (!compositionId) return;
    try {
      const { composition } = await getComposition(compositionId);
      applyComposition(composition);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Poll failed.");
    }
  };

  const pollRender = async () => {
    if (!renderJobId) return;
    try {
      const { renderJob } = await getRender(renderJobId);
      setRenderStatus(renderJob.status);
      setRenderProgress(renderJob.progress);
      if (renderJob.status === "completed") {
        setOutputUrl(renderJob.outputUrl ?? null);
      }
      if (renderJob.status === "failed") {
        setErrorMessage(renderJob.error ?? "Render failed.");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Render poll failed.");
    }
  };

  useJobPolling(
    compositionStatus === "queued" || compositionStatus === "processing",
    pollComposition,
    1200
  );
  useJobPolling(
    renderStatus === "queued" || renderStatus === "processing",
    pollRender,
    1000
  );

  const compose = async () => {
    if (!videoAssetId) return;
    try {
      setBusy(true);
      setErrorMessage(null);
      const direction = {
        freeText: freeText.trim() || undefined,
        desiredVibe: vibe.length > 0 ? vibe : undefined,
        exclusions: exclusions
          ? exclusions.split(",").map((x) => x.trim()).filter(Boolean)
          : undefined,
        vocalPreference: vocal
      };
      const { composition } = await createComposition({
        videoAssetId,
        direction,
        candidateCount: 3
      });
      setCompositionId(composition.id);
      applyComposition(composition);
      setSelectedCandidateId(null);
      setOutputUrl(null);
      setRenderStatus("idle");
      setRenderJobId(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not compose.");
    } finally {
      setBusy(false);
    }
  };

  const chooseCandidate = async (candidateId: `gsc_${string}`) => {
    if (!compositionId) return;
    try {
      setBusy(true);
      setErrorMessage(null);
      const { composition } = await selectCandidate({ compositionId, candidateId });
      applyComposition(composition);
      setSelectedCandidateId(candidateId);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not select track.");
    } finally {
      setBusy(false);
    }
  };

  const markNotFit = (_candidateId: `gsc_${string}`) => {
    // No feedback store in this MVP; keep the UI affordance for user clarity.
    void _candidateId;
  };

  const startRender = async () => {
    if (!compositionId || !selectedCandidateId) return;
    try {
      setBusy(true);
      setErrorMessage(null);
      const { renderJob } = await createRender({
        compositionId,
        mix: {
          preset,
          originalAudioLevel: levels.original,
          musicLevel: levels.music
        }
      });
      setRenderJobId(renderJob.id);
      setRenderStatus(renderJob.status);
      setRenderProgress(renderJob.progress);
      setOutputUrl(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not start render.");
    } finally {
      setBusy(false);
    }
  };

  // ---- Render branches ----

  if (!selectedFile) {
    return <UploadHero onFile={handleFile} errorMessage={errorMessage} />;
  }

  const canCompose =
    Boolean(videoAssetId) &&
    !busy &&
    compositionStatus !== "queued" &&
    compositionStatus !== "processing";

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1240px] px-4 pb-24 pt-6 sm:px-6 sm:pt-8 md:px-10">
      <header className="mb-6 flex flex-col gap-4 pb-2 md:mb-0 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-6 md:pb-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-display text-[22px] leading-none tracking-tightest text-ink">
            Evva
          </span>
          <span className="text-[11px] uppercase tracking-[0.18em] text-ink-4">Studio</span>
          {config?.music ? (
            <span
              title={config.music.note}
              className={cn(
                "ml-1 rounded-full border px-2 py-0.5 text-[11px]",
                config.music.mode === "mock"
                  ? "border-accent/30 bg-accent-soft text-accent-ink"
                  : "border-line bg-paper text-ink-2"
              )}
            >
              {config.music.mode === "elevenlabs"
                ? "ElevenLabs"
                : config.music.mode === "replicate"
                  ? "Replicate"
                  : "Preview music"}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (previewUrl) URL.revokeObjectURL(previewUrl);
              setSelectedFile(null);
              setPreviewUrl(null);
            }}
            className="ml-auto inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition hover:text-ink md:hidden"
          >
            <IconUpload className="h-3.5 w-3.5" />
            New reel
          </button>
        </div>
        <ProgressRail current={currentStep} />
        <button
          type="button"
          onClick={() => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            setSelectedFile(null);
            setPreviewUrl(null);
          }}
          className="hidden items-center gap-2 text-[12px] text-ink-3 transition hover:text-ink md:inline-flex"
        >
          <IconUpload className="h-3.5 w-3.5" />
          New reel
        </button>
      </header>

      {errorMessage ? (
        <div className="mb-6 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-[13px] text-accent-ink">
          {errorMessage}
        </div>
      ) : null}

      {uploading ? (
        <div className="mb-6 rounded-xl border border-line bg-paper px-4 py-3 text-[13px] text-ink-2">
          Uploading reel…
        </div>
      ) : null}

      <div className="grid gap-8 md:gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="space-y-8 md:space-y-10">
          <section className="space-y-5">
            <SectionLabel number="01" title="Stage" />
            {previewUrl ? (
              <Stage
                videoUrl={previewUrl}
                fileName={selectedFile.name}
                selectedCandidate={selectedCandidate}
                analysis={analysisToStageShape(analysis)}
                levels={levels}
                onLevelsChange={setLevels}
                preset={preset}
                onPresetChange={setPreset}
                initialDimensions={videoDims}
                onDimensionsDetected={setVideoDims}
              />
            ) : null}
          </section>

          <ExportSection
            canRender={Boolean(selectedCandidateId)}
            rendererMode={rendererMode}
            renderStatus={renderStatus === "idle" ? "idle" : renderStatus}
            renderProgress={renderProgress}
            outputUrl={outputUrl}
            busy={busy}
            onRender={() => void startRender()}
            videoDims={videoDims}
          />
        </div>

        <div className="space-y-10">
          <DirectionSection
            freeText={freeText}
            vibe={vibe}
            exclusions={exclusions}
            vocal={vocal}
            onFreeText={setFreeText}
            onVibe={setVibe}
            onExclusions={setExclusions}
            onVocal={setVocal}
          />

          <div className="rounded-2xl border border-line bg-paper p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-[18px] tracking-tighter text-ink">
                  Compose soundtrack options
                </p>
                <p className="mt-1 text-[13px] text-ink-3">
                  {compositionStatus === "idle"
                    ? "Generate original tracks tuned to this reel."
                    : compositionStatus === "completed"
                      ? `${candidates.length} options ready. Select one to audition.`
                      : "Generating…"}
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => void compose()}
                disabled={!canCompose}
                className="w-full sm:w-auto"
              >
                <IconSparkle className="h-4 w-4" />
                {compositionStatus === "completed" ? "Compose again" : "Compose"}
              </Button>
            </div>
          </div>

          <CandidatesSection
            candidates={candidates}
            selectedId={selectedCandidateId}
            onSelect={(id) => void chooseCandidate(id)}
            onNotFit={markNotFit}
            generationStatus={compositionStatus === "idle" ? "idle" : compositionStatus}
            generationProgress={compositionProgress}
            onRegenerate={() => void compose()}
            canRegenerate={Boolean(compositionId)}
            busy={busy}
          />
        </div>
      </div>
    </div>
  );
}

// ---- helpers ----

async function readVideoMeta(objectUrl: string): Promise<{
  durationSec: number;
  width?: number;
  height?: number;
}> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.src = objectUrl;
    v.onloadedmetadata = () => {
      resolve({
        durationSec: Number(v.duration.toFixed(2)) || 15,
        width: v.videoWidth || undefined,
        height: v.videoHeight || undefined
      });
    };
    v.onerror = () => resolve({ durationSec: 15 });
  });
}

function mapCandidates(items: DomainCandidate[]): UiCandidate[] {
  return items.map((c) => ({
    id: c.id,
    title: c.title,
    tags: c.tags,
    whyItFits: c.prompt,
    isInstrumental: c.isInstrumental,
    audioUrl: c.audioUrl,
    durationSec: c.durationSec
  }));
}

type StageAnalysis = {
  themes: string[];
  moods: string[];
  energy: number;
  pacing: "slow" | "medium" | "fast";
  summary: string;
};

/**
 * The Stage component was previously fed a rich (fake) analysis. We now feed
 * it honest minimal analysis by mapping into the shape it expects with sane
 * neutral defaults — no invented moods/themes.
 */
function analysisToStageShape(a: DomainAnalysis | null): StageAnalysis | null {
  if (!a) return null;
  return {
    themes: a.aspectRatio ? [a.aspectRatio] : [],
    moods: [],
    energy: 0.5,
    pacing: a.durationSec < 10 ? "fast" : a.durationSec > 25 ? "slow" : "medium",
    summary: a.summary
  };
}
