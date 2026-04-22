"use client";

import { useState, type DragEvent } from "react";
import { ACCEPTED_VIDEO_TYPES, MAX_UPLOAD_BYTES, formatBytes } from "./models";
import { IconUpload } from "./icons";
import { cn } from "./primitives";

export function UploadHero({
  onFile,
  errorMessage
}: {
  onFile: (file: File) => void;
  errorMessage?: string | null;
}) {
  const [drag, setDrag] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validate = (file: File): string | null => {
    if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
      return "Unsupported format. Use MP4, MOV, WEBM, or MKV.";
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return `File too large. Max ${formatBytes(MAX_UPLOAD_BYTES)}.`;
    }
    return null;
  };

  const handleFile = (file: File) => {
    const err = validate(file);
    if (err) {
      setLocalError(err);
      return;
    }
    setLocalError(null);
    onFile(file);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDrag(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const errorText = localError ?? errorMessage ?? null;

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-6">
      <div className="mx-auto w-full max-w-[680px]">
        <div className="mb-10 text-center">
          <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.22em] text-ink-3">
            Evva · Reel scoring studio
          </p>
          <h1 className="font-display text-[52px] leading-[0.98] tracking-tightest text-ink md:text-[64px]">
            Score your reel.
          </h1>
          <p className="mx-auto mt-4 max-w-[520px] text-[15px] leading-relaxed text-ink-2">
            Drop a short video. Evva reads its mood and pacing, composes original
            soundtrack options, and lets you mix the final cut without leaving the page.
          </p>
        </div>

        <div
          onDrop={onDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          className={cn(
            "evva-grain group relative overflow-hidden rounded-2xl border bg-paper px-10 py-14 text-center transition",
            drag ? "border-ink bg-white" : "border-line hover:border-ink/30"
          )}
        >
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-line bg-canvas text-ink">
            <IconUpload className="h-5 w-5" />
          </div>
          <p className="mt-5 font-display text-[22px] leading-tight tracking-tighter text-ink">
            Drop a reel to start
          </p>
          <p className="mt-1.5 text-[13px] text-ink-3">
            MP4 · MOV · WEBM · MKV · up to 200MB
          </p>

          <label className="mt-7 inline-flex cursor-pointer items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-canvas transition hover:bg-black">
            Choose video
            <input
              type="file"
              accept={ACCEPTED_VIDEO_TYPES.join(",")}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>

          <p className="mt-6 text-[12px] text-ink-4">
            Nothing leaves your machine in local mode. Files are written to
            <span className="mx-1 font-mono">public/uploads/</span> during your session.
          </p>
        </div>

        {errorText ? (
          <div className="mt-5 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-[13px] text-accent-ink">
            {errorText}
          </div>
        ) : null}

        <div className="mt-10 grid gap-6 text-left md:grid-cols-3">
          {[
            ["01", "Read", "Evva analyzes mood, pacing, and energy from the footage."],
            ["02", "Compose", "Four original tracks generated and ranked for this reel."],
            ["03", "Mix & export", "Audition live, balance levels, export a final cut."]
          ].map(([n, t, d]) => (
            <div key={n} className="border-t border-line pt-4">
              <p className="font-mono text-[11px] text-ink-4">{n}</p>
              <p className="mt-1 font-display text-[17px] tracking-tighter text-ink">{t}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
