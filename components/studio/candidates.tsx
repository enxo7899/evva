"use client";

import { useEffect, useRef, useState } from "react";
import type { Candidate } from "./models";
import { formatSeconds } from "./models";
import { IconCheck, IconPause, IconPlay, IconRefresh, IconSparkle, IconX } from "./icons";
import { Button, Chip, cn, SectionLabel } from "./primitives";

export function CandidatesSection({
  candidates,
  selectedId,
  onSelect,
  onNotFit,
  generationStatus,
  generationProgress,
  onRegenerate,
  canRegenerate,
  busy
}: {
  candidates: Candidate[];
  selectedId: `gsc_${string}` | null;
  onSelect: (id: `gsc_${string}`) => void;
  onNotFit: (id: `gsc_${string}`) => void;
  generationStatus: "idle" | "queued" | "processing" | "completed" | "failed";
  generationProgress: number;
  onRegenerate: () => void;
  canRegenerate: boolean;
  busy: boolean;
}) {
  const isRunning = generationStatus === "queued" || generationStatus === "processing";

  return (
    <section className="space-y-5">
      <SectionLabel
        number="03"
        title="Candidates"
        trailing={
          candidates.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              disabled={!canRegenerate || busy || isRunning}
            >
              <IconRefresh className="h-3.5 w-3.5" /> Regenerate
            </Button>
          ) : null
        }
      />

      {isRunning ? (
        <GeneratingState progress={generationProgress} />
      ) : candidates.length === 0 ? (
        <EmptyCandidates />
      ) : (
        <ul className="space-y-2">
          {candidates.map((c) => (
            <CandidateRow
              key={c.id}
              candidate={c}
              selected={selectedId === c.id}
              onSelect={() => onSelect(c.id)}
              onNotFit={() => onNotFit(c.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function GeneratingState({ progress }: { progress: number }) {
  return (
    <div className="rounded-2xl border border-line bg-paper p-6">
      <div className="flex items-center gap-3">
        <div className="relative flex h-8 w-8 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
          <IconSparkle className="relative h-4 w-4 text-accent" />
        </div>
        <p className="font-display text-[18px] tracking-tighter text-ink">Composing…</p>
      </div>
      <p className="mt-2 text-[13px] text-ink-3">
        Evva is generating soundtrack options tuned to your reel.
      </p>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full bg-ink transition-all duration-500"
          style={{ width: `${Math.max(4, Math.round(progress * 100))}%` }}
        />
      </div>
      <div className="mt-4 grid gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-black/[0.04]" />
        ))}
      </div>
    </div>
  );
}

function EmptyCandidates() {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper/40 p-6 text-center">
      <p className="font-display text-[17px] tracking-tighter text-ink">No tracks yet</p>
      <p className="mt-1 text-[13px] text-ink-3">
        Set direction (optional) and compose to generate candidates.
      </p>
    </div>
  );
}

function CandidateRow({
  candidate,
  selected,
  onSelect,
  onNotFit
}: {
  candidate: Candidate;
  selected: boolean;
  onSelect: () => void;
  onNotFit: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [solo, setSolo] = useState(false);

  // Stop solo preview on unmount
  useEffect(() => {
    const el = audioRef.current;
    return () => {
      el?.pause();
    };
  }, []);

  const toggleSolo = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.currentTime = 0;
      void el.play();
      setSolo(true);
    } else {
      el.pause();
      setSolo(false);
    }
  };

  return (
    <li
      className={cn(
        "group rounded-xl border bg-paper p-4 transition",
        selected ? "border-ink bg-canvas" : "border-line hover:border-ink/30"
      )}
    >
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={toggleSolo}
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition",
            solo ? "border-ink bg-ink text-canvas" : "border-line bg-paper text-ink hover:border-ink/40"
          )}
          aria-label={solo ? "Stop solo preview" : "Solo preview"}
        >
          {solo ? <IconPause className="h-3.5 w-3.5" /> : <IconPlay className="h-3.5 w-3.5" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate font-display text-[17px] tracking-tighter text-ink">
              {candidate.title}
            </p>
            <span className="font-mono text-[11px] tabular-nums text-ink-4">
              {formatSeconds(candidate.durationSec)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-ink-3">
            {candidate.whyItFits}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {candidate.tags.slice(0, 4).map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] text-ink-4">
              {candidate.isInstrumental ? "Instrumental" : "Vocal-ready"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onNotFit}>
          <IconX className="h-3.5 w-3.5" /> Not it
        </Button>
        <Button
          variant={selected ? "primary" : "secondary"}
          size="sm"
          onClick={onSelect}
        >
          {selected ? (
            <>
              <IconCheck className="h-3.5 w-3.5" /> Selected
            </>
          ) : (
            "Use this track"
          )}
        </Button>
      </div>

      <audio ref={audioRef} src={candidate.audioUrl} preload="none" onEnded={() => setSolo(false)} />
    </li>
  );
}
