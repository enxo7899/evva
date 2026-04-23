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
  onRender,
  videoDims
}: {
  canRender: boolean;
  rendererMode: RendererMode;
  renderStatus: "idle" | "queued" | "processing" | "completed" | "failed";
  renderProgress: number;
  outputUrl: string | null;
  busy: boolean;
  onRender: () => void;
  /**
   * Source video pixel dimensions. Used to render the output preview at its
   * natural aspect ratio so vertical reels don't get pillarboxed by a
   * hardcoded 16:9 container. The exported MP4 always preserves source dims
   * via ffmpeg stream copy; this prop only affects the on-page preview.
   */
  videoDims?: { width: number; height: number } | null;
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
        <OutputPreview outputUrl={outputUrl} videoDims={videoDims ?? null} />
      ) : null}
    </section>
  );
}

function OutputPreview({
  outputUrl,
  videoDims
}: {
  outputUrl: string;
  videoDims: { width: number; height: number } | null;
}) {
  // Respect the source's natural aspect ratio so vertical reels display
  // edge-to-edge without pillarbox. Portrait gets constrained width so the
  // player doesn't balloon to full column height on wide screens.
  const aspectRatio = videoDims ? `${videoDims.width} / ${videoDims.height}` : undefined;
  const isPortrait = videoDims ? videoDims.height > videoDims.width : false;
  const containerStyle: React.CSSProperties = {
    aspectRatio,
    width: isPortrait ? "min(360px, 100%)" : "100%",
    maxHeight: "70vh"
  };

  return (
    <div
      className="mx-auto overflow-hidden rounded-2xl border border-line bg-paper"
      style={containerStyle}
    >
      <video controls src={outputUrl} className="block h-full w-full" />
    </div>
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
