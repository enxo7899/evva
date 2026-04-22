import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  MediaRenderer,
  RenderRequest,
  RenderStatus
} from "./interface";

/**
 * Honest fallback renderer used when ffmpeg is unavailable.
 *
 * Does NOT mix audio — it copies the source video to public/renders/ so the
 * user still gets a downloadable artifact. The live in-browser mix audition
 * in the Studio remains the authoritative preview of the chosen soundtrack.
 *
 * The UI surfaces this mode via /api/v1/config so the user is never misled.
 */

type State = {
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  outputUrl?: string;
  error?: string;
};

type G = typeof globalThis & {
  __evvaPreviewJobs?: Map<string, State>;
};
const g = globalThis as G;
const jobs: Map<string, State> = g.__evvaPreviewJobs ?? (g.__evvaPreviewJobs = new Map());

export class PreviewCopyRenderer implements MediaRenderer {
  readonly mode = "preview-copy" as const;
  readonly mixesAudio = false;

  async enqueue(req: RenderRequest): Promise<void> {
    jobs.set(req.renderJobId, { status: "processing", progress: 0.3 });

    try {
      const src = urlToPublicPath(req.videoSourceUrl);
      const dir = path.join(process.cwd(), "public", "renders");
      await mkdir(dir, { recursive: true });
      const outputName = `${req.renderJobId}.mp4`;
      await copyFile(src, path.join(dir, outputName));

      jobs.set(req.renderJobId, {
        status: "completed",
        progress: 1,
        outputUrl: `/renders/${outputName}`
      });
    } catch (error) {
      jobs.set(req.renderJobId, {
        status: "failed",
        progress: 1,
        error:
          error instanceof Error
            ? error.message
            : "Preview-copy renderer failed."
      });
    }
  }

  async getStatus(renderJobId: string): Promise<RenderStatus> {
    const state = jobs.get(renderJobId);
    if (!state) {
      return { status: "failed", progress: 1, error: "Render job not found" };
    }
    return state;
  }
}

function urlToPublicPath(url: string): string {
  if (!url.startsWith("/")) {
    throw new Error(
      "preview-copy renderer only supports local /public assets in this MVP."
    );
  }
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}

export function createPreviewCopyRenderer(): PreviewCopyRenderer {
  return new PreviewCopyRenderer();
}
