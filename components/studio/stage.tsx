"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Analysis, Candidate, MixPresetKey } from "./models";
import { MIX_PRESETS, formatSeconds } from "./models";
import { IconPause, IconPlay, IconWaveform } from "./icons";
import { Button, Chip, cn } from "./primitives";

type Levels = { music: number; original: number };

export type StageDimensions = {
  width: number;
  height: number;
};

export function Stage({
  videoUrl,
  fileName,
  selectedCandidate,
  analysis,
  levels,
  onLevelsChange,
  preset,
  onPresetChange,
  initialDimensions,
  onDimensionsDetected
}: {
  videoUrl: string;
  fileName: string;
  selectedCandidate: Candidate | null;
  analysis: Analysis | null;
  levels: Levels;
  onLevelsChange: (levels: Levels) => void;
  preset: MixPresetKey;
  onPresetChange: (preset: MixPresetKey) => void;
  /** Known dimensions from the server/client metadata pass, if any. */
  initialDimensions?: StageDimensions | null;
  /** Fires once we know the video's natural dimensions. */
  onDimensionsDetected?: (dims: StageDimensions) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dims, setDims] = useState<StageDimensions | null>(
    initialDimensions ?? null
  );
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Apply volume levels live
  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = clamp01(levels.original);
    if (audioRef.current) audioRef.current.volume = clamp01(levels.music);
  }, [levels.music, levels.original]);

  // When candidate changes, restart audio alignment
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (!audio || !video) return;

    audio.pause();
    audio.currentTime = 0;
    if (!video.paused) {
      audio.play().catch(() => undefined);
    }
  }, [selectedCandidate?.audioUrl]);

  const handlePlayToggle = () => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;
    if (video.paused) {
      // On iOS Safari, each media element needs its own user-gesture
      // play() to be unlocked. We start both within this tap handler and
      // surface any rejection so the user sees a real error instead of a
      // silently-stalled video.
      const videoPlay = video.play();
      const audioPlay =
        audio && selectedCandidate ? audio.play() : Promise.resolve();

      Promise.all([
        videoPlay ?? Promise.resolve(),
        audioPlay ?? Promise.resolve()
      ]).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        // Pause both so UI state stays consistent with reality.
        video.pause();
        audio?.pause();
        setPlaybackError(msg || "Playback was blocked by the browser.");
      });
    } else {
      video.pause();
      audio?.pause();
    }
  };

  const handleSeek = (t: number) => {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video) return;
    video.currentTime = t;
    if (audio && selectedCandidate) {
      const loopLen = selectedCandidate.durationSec || audio.duration || 0;
      audio.currentTime = loopLen > 0 ? t % loopLen : 0;
    }
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  // Honest aspect layout: we always render the video at its natural ratio —
  // no forced 16:9 box, no pillarboxing, no letterboxing. Vertical reels read
  // as vertical, landscape reads as landscape, square as square.
  const aspectRatio = dims ? `${dims.width} / ${dims.height}` : undefined;
  const isPortrait = dims ? dims.height > dims.width : false;
  const stageMaxWidth = isPortrait ? "min(420px, 100%)" : "100%";

  return (
    <div className="space-y-5">
      <div
        className="relative mx-auto overflow-hidden rounded-2xl border border-line bg-paper"
        style={{
          aspectRatio,
          width: stageMaxWidth,
          maxHeight: "72vh"
        }}
      >
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          // "auto" ensures mobile browsers have buffered enough on first
          // tap that video.play() resolves quickly instead of stalling —
          // "metadata" was causing visible freezes on 4G/LTE phones.
          preload="auto"
          controlsList="nodownload"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            setDuration(v.duration || 0);
            if (v.videoWidth > 0 && v.videoHeight > 0) {
              const next = { width: v.videoWidth, height: v.videoHeight };
              setDims(next);
              onDimensionsDetected?.(next);
            }
          }}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime || 0)}
          onPlay={() => {
            setIsPlaying(true);
            if (audioRef.current && selectedCandidate) {
              void audioRef.current.play().catch(() => undefined);
            }
          }}
          onPause={() => {
            setIsPlaying(false);
            audioRef.current?.pause();
          }}
          onSeeked={(e) => {
            const audio = audioRef.current;
            if (!audio || !selectedCandidate) return;
            const loopLen = selectedCandidate.durationSec || audio.duration || 0;
            audio.currentTime = loopLen > 0 ? e.currentTarget.currentTime % loopLen : 0;
          }}
          className="block h-full w-full"
        />

        {selectedCandidate ? (
          <audio
            ref={audioRef}
            src={selectedCandidate.audioUrl}
            preload="auto"
            loop
          />
        ) : null}

        {/* Overlay playback controls */}
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-canvas">
          <button
            type="button"
            onClick={handlePlayToggle}
            // Larger hit area on mobile — iOS + Android HIG both ask for
            // at least 44x44pt. The previous 36px target was tappable but
            // easy to miss, which is part of why the video appeared not
            // to play on some phones.
            className="flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-ink transition hover:scale-[1.03] sm:h-9 sm:w-9"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
          </button>

          <div className="flex-1">
            <div
              className="group relative h-1.5 cursor-pointer rounded-full bg-white/20"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = (e.clientX - rect.left) / rect.width;
                handleSeek(pct * duration);
              }}
            >
              <div
                className="h-full rounded-full bg-canvas"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>

          <span className="font-mono text-[11px] tabular-nums text-canvas/90">
            {formatSeconds(currentTime)} / {formatSeconds(duration)}
          </span>
        </div>

        {/* Live badge when playing with candidate */}
        {selectedCandidate && isPlaying ? (
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium tracking-tight text-canvas backdrop-blur-sm">
            <span className="evva-live-dot h-1.5 w-1.5 rounded-full bg-accent" />
            Auditioning mix
          </div>
        ) : null}
      </div>

      {playbackError ? (
        <div className="rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 text-[13px] text-accent-ink">
          <p className="font-medium">Couldn&apos;t start playback.</p>
          <p className="mt-0.5 text-[12px] text-accent-ink/80">{playbackError}</p>
          <p className="mt-1 text-[12px] text-accent-ink/80">
            Try tapping play once more, unmute your phone, or reload the page.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
        <SourceMeta fileName={fileName} analysis={analysis} />
        <MixDock
          selectedCandidate={selectedCandidate}
          levels={levels}
          onLevelsChange={onLevelsChange}
          preset={preset}
          onPresetChange={onPresetChange}
        />
      </div>
    </div>
  );
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function SourceMeta({
  fileName,
  analysis
}: {
  fileName: string;
  analysis: Analysis | null;
}) {
  const tags = useMemo(() => {
    if (!analysis) return [] as string[];
    return [...analysis.moods, ...analysis.themes].slice(0, 6);
  }, [analysis]);

  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <div className="flex items-baseline justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">
            Source
          </p>
          <p className="mt-1 truncate font-display text-[18px] tracking-tighter text-ink">
            {fileName}
          </p>
        </div>
      </div>

      {analysis ? (
        <>
          <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{analysis.summary}</p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-[12px] text-ink-3">
            <MetaRow label="Energy" value={renderEnergy(analysis.energy)} />
            <MetaRow label="Pacing" value={analysis.pacing} />
          </div>
        </>
      ) : (
        <p className="mt-3 text-[13px] text-ink-3">
          Reading footage mood, pacing, and energy…
        </p>
      )}
    </div>
  );
}

function renderEnergy(e: number) {
  if (e > 0.7) return "high";
  if (e > 0.4) return "medium";
  return "low";
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between border-t border-line-soft pt-2">
      <span className="text-ink-4">{label}</span>
      <span className="text-ink-2">{value}</span>
    </div>
  );
}

function MixDock({
  selectedCandidate,
  levels,
  onLevelsChange,
  preset,
  onPresetChange
}: {
  selectedCandidate: Candidate | null;
  levels: Levels;
  onLevelsChange: (levels: Levels) => void;
  preset: MixPresetKey;
  onPresetChange: (preset: MixPresetKey) => void;
}) {
  const applyPreset = (key: MixPresetKey) => {
    const p = MIX_PRESETS.find((x) => x.value === key);
    if (!p) return;
    onPresetChange(key);
    onLevelsChange({ music: p.musicLevel, original: p.originalAudioLevel });
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition",
        selectedCandidate ? "border-line bg-paper" : "border-line-soft bg-paper/60"
      )}
    >
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-4">Mix</p>
        {selectedCandidate ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-3">
            <IconWaveform className="h-3.5 w-3.5" />
            {selectedCandidate.title}
          </span>
        ) : (
          <span className="text-[11px] text-ink-4">Select a track to audition</span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {MIX_PRESETS.map((p) => (
          <Chip
            key={p.value}
            active={preset === p.value}
            onClick={() => applyPreset(p.value)}
          >
            {p.label}
          </Chip>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        <Slider
          label="Music"
          value={levels.music}
          onChange={(v) => onLevelsChange({ ...levels, music: v })}
        />
        <Slider
          label="Original audio"
          value={levels.original}
          onChange={(v) => onLevelsChange({ ...levels, original: v })}
        />
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] text-ink-2">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-ink-4">
          {Math.round(value * 100)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
      />
    </div>
  );
}

export function PlayControls({ onPlay }: { onPlay: () => void }) {
  return (
    <Button variant="primary" size="lg" onClick={onPlay}>
      <IconPlay className="h-4 w-4" /> Play with selected track
    </Button>
  );
}
