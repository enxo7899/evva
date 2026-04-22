"use client";

import { Button, cn, SectionLabel } from "./primitives";
import { IconAlert, IconDownload, IconInfo } from "./icons";

export type RendererMode = "ffmpeg" | "preview-copy" | null;

export function ExportSection({
  canRender,
  rendererMode,
  renderStatus,
  renderProgress,
  outputUrl,
  busy,
  onRender
}: {
  canRender: boolean;
  rendererMode: RendererMode;
  renderStatus: "idle" | "queued" | "processing" | "completed" | "failed";
  renderProgress: number;
  outputUrl: string | null;
  busy: boolean;
  onRender: () => void;
}) {
  const isRunning = renderStatus === "queued" || renderStatus === "processing";
  const isPreviewOnly = rendererMode === "preview-copy";

  return (
    <section className="space-y-5">
      <SectionLabel number="05" title="Export" />

      {isPreviewOnly ? (
        <Notice tone="warn" icon={<IconAlert className="h-4 w-4" />}>
          <strong className="font-medium">Preview render mode.</strong> Without ffmpeg
          installed, export produces a copy of the source reel only — your selected mix
          is audible in the live preview above but not baked into the file. Set{" "}
          <code className="font-mono text-[12px]">MEDIA_RENDERER_PROVIDER=ffmpeg</code> and
          install ffmpeg to produce a fully mixed MP4.
        </Notice>
      ) : rendererMode === "ffmpeg" ? (
        <Notice tone="info" icon={<IconInfo className="h-4 w-4" />}>
          ffmpeg mode active. Export will bake the selected track and your current mix
          levels into a final MP4.
        </Notice>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          disabled={!canRender || busy || isRunning}
          onClick={onRender}
        >
          <IconDownload className="h-4 w-4" />
          {isRunning ? "Rendering…" : isPreviewOnly ? "Export preview" : "Render final mix"}
        </Button>
        {outputUrl ? (
          <a
            href={outputUrl}
            download
            className="inline-flex h-12 items-center gap-2 rounded-full border border-line bg-paper px-5 text-[14px] font-medium text-ink transition hover:border-ink/40"
          >
            <IconDownload className="h-4 w-4" /> Download
          </a>
        ) : null}
      </div>

      {isRunning ? (
        <div className="h-1 overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full bg-ink transition-all duration-500"
            style={{ width: `${Math.max(4, Math.round(renderProgress * 100))}%` }}
          />
        </div>
      ) : null}

      {outputUrl ? (
        <div className="overflow-hidden rounded-2xl border border-line bg-black">
          <video controls src={outputUrl} className="aspect-video w-full" />
        </div>
      ) : null}
    </section>
  );
}

function Notice({
  tone,
  icon,
  children
}: {
  tone: "info" | "warn";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] leading-relaxed",
        tone === "warn"
          ? "border-accent/30 bg-accent-soft text-accent-ink"
          : "border-line bg-paper text-ink-2"
      )}
    >
      <span className={tone === "warn" ? "text-accent-ink" : "text-ink-3"}>{icon}</span>
      <div>{children}</div>
    </div>
  );
}
