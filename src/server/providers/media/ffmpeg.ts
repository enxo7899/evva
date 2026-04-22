import { access, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { env } from "@/lib/env";
import type {
  MediaRenderer,
  RenderRequest,
  RenderStatus
} from "./interface";

/**
 * Real media renderer. Uses ffmpeg to mix the uploaded reel's audio with the
 * selected generated track at the user's chosen levels. Writes output to
 * public/renders/<renderJobId>.mp4 so the browser can download it directly.
 *
 * This is the primary export path. The preview-copy fallback exists only for
 * environments without ffmpeg, and the UI labels that case honestly.
 */

type State = {
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  outputUrl?: string;
  error?: string;
};

type G = typeof globalThis & {
  __evvaFfmpegJobs?: Map<string, State>;
};
const g = globalThis as G;
const jobs: Map<string, State> = g.__evvaFfmpegJobs ?? (g.__evvaFfmpegJobs = new Map());

export class FfmpegMediaRenderer implements MediaRenderer {
  readonly mode = "ffmpeg" as const;
  readonly mixesAudio = true;

  async enqueue(req: RenderRequest): Promise<void> {
    jobs.set(req.renderJobId, { status: "queued", progress: 0.05 });

    const sourceVideo = urlToPublicPath(req.videoSourceUrl);
    const sourceMusic = urlToPublicPath(req.generatedAudioUrl);

    try {
      await access(sourceVideo);
      await access(sourceMusic);
    } catch {
      jobs.set(req.renderJobId, {
        status: "failed",
        progress: 1,
        error: "Missing source video or generated audio file for ffmpeg render."
      });
      return;
    }

    const renderDir = path.join(process.cwd(), "public", "renders");
    await mkdir(renderDir, { recursive: true });

    const outputName = `${req.renderJobId}.mp4`;
    const outputPath = path.join(renderDir, outputName);

    const fadeIn = req.mix.fadeInSec ?? 0;
    const fadeOut = req.mix.fadeOutSec ?? 0;

    // Keep the reel's length as the master duration. Loop the music under
    // the video with -stream_loop -1, then -shortest clamps to the reel.
    const musicChain = [
      `volume=${req.mix.musicLevel.toFixed(3)}`,
      fadeIn > 0 ? `afade=t=in:st=0:d=${fadeIn}` : null,
      fadeOut > 0 ? `afade=t=out:st=20:d=${fadeOut}` : null
    ]
      .filter(Boolean)
      .join(",");

    const filter = [
      `[0:a]volume=${req.mix.originalAudioLevel.toFixed(3)}[orig]`,
      `[1:a]${musicChain || "anull"}[mus]`,
      "[orig][mus]amix=inputs=2:normalize=0:dropout_transition=2[mixout]"
    ].join(";");

    jobs.set(req.renderJobId, { status: "processing", progress: 0.2 });

    const child = spawn(env.ffmpegPath || "ffmpeg", [
      "-y",
      "-i",
      sourceVideo,
      "-stream_loop",
      "-1",
      "-i",
      sourceMusic,
      "-filter_complex",
      filter,
      "-map",
      "0:v:0",
      "-map",
      "[mixout]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-shortest",
      outputPath
    ]);

    child.stderr.on("data", () => {
      const current = jobs.get(req.renderJobId);
      if (!current || current.status !== "processing") return;
      jobs.set(req.renderJobId, {
        ...current,
        progress: Math.min(0.95, Number((current.progress + 0.02).toFixed(2)))
      });
    });

    child.on("error", (error) => {
      jobs.set(req.renderJobId, {
        status: "failed",
        progress: 1,
        error: `ffmpeg failed to start: ${error.message}. Is ffmpeg installed and on PATH?`
      });
    });

    child.on("exit", (code) => {
      if (code === 0) {
        jobs.set(req.renderJobId, {
          status: "completed",
          progress: 1,
          outputUrl: `/renders/${outputName}`
        });
        return;
      }
      jobs.set(req.renderJobId, {
        status: "failed",
        progress: 1,
        error: `ffmpeg exited with code ${code ?? "unknown"}.`
      });
    });
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
      "ffmpeg renderer only supports local /public assets in this MVP."
    );
  }
  return path.join(process.cwd(), "public", url.replace(/^\//, ""));
}

export function createFfmpegRenderer(): FfmpegMediaRenderer {
  return new FfmpegMediaRenderer();
}
