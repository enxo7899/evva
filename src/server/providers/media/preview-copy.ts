import { readFile } from "node:fs/promises";
import { kvGet, kvSet } from "@/server/runtime/kv";
import { fetchToTmp, putBuffer } from "@/server/runtime/storage";
import type {
  MediaRenderer,
  RenderRequest,
  RenderStatus
} from "./interface";

/**
 * Honest fallback renderer used when ffmpeg is unavailable.
 *
 * Does NOT mix audio — it copies the source video bytes into the storage
 * layer (Blob or public/renders/) so the user still gets a downloadable
 * artifact. The live in-browser mix audition in the Studio remains the
 * authoritative preview of the chosen soundtrack. The UI surfaces this
 * mode via /api/v1/config so the user is never misled.
 */

type State = {
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  outputUrl?: string;
  error?: string;
};

const stateKey = (renderJobId: string) => `preview-render:${renderJobId}`;

export class PreviewCopyRenderer implements MediaRenderer {
  readonly mode = "preview-copy" as const;
  readonly mixesAudio = false;

  async enqueue(req: RenderRequest): Promise<void> {
    await kvSet<State>(
      stateKey(req.renderJobId),
      { status: "processing", progress: 0.3 },
      60 * 60 * 24
    );

    try {
      const srcPath = await fetchToTmp(req.videoSourceUrl, ".mp4");
      const buffer = await readFile(srcPath);
      const stored = await putBuffer(
        `renders/${req.renderJobId}.mp4`,
        buffer,
        "video/mp4"
      );
      await kvSet<State>(
        stateKey(req.renderJobId),
        { status: "completed", progress: 1, outputUrl: stored.url },
        60 * 60 * 24
      );
    } catch (error) {
      await kvSet<State>(
        stateKey(req.renderJobId),
        {
          status: "failed",
          progress: 1,
          error:
            error instanceof Error
              ? error.message
              : "Preview-copy renderer failed."
        },
        60 * 60 * 24
      );
    }
  }

  async getStatus(renderJobId: string): Promise<RenderStatus> {
    const state = await kvGet<State>(stateKey(renderJobId));
    if (!state) {
      return { status: "failed", progress: 1, error: "Render job not found" };
    }
    return state;
  }
}

export function createPreviewCopyRenderer(): PreviewCopyRenderer {
  return new PreviewCopyRenderer();
}
