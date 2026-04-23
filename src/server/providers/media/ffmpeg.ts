import { readFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "@/lib/env";
import { kvGet, kvSet } from "@/server/runtime/kv";
import { fetchToTmp, putBuffer } from "@/server/runtime/storage";
import type {
  MediaRenderer,
  RenderRequest,
  RenderStatus
} from "./interface";

/**
 * Real media renderer. Uses ffmpeg to mix the uploaded reel's audio with the
 * selected generated track at the user's chosen levels. Output is written to
 * the storage abstraction (Blob on Vercel, public/renders/ locally).
 *
 * On Vercel the ffmpeg binary is provided by `@ffmpeg-installer/ffmpeg`,
 * resolved lazily so it isn't bundled into client chunks. Locally, we honor
 * FFMPEG_PATH (or fall back to whatever is on PATH) so developers can use
 * their system install.
 *
 * `enqueue` runs the whole pipeline synchronously and persists the result in
 * KV. `getStatus` just reads KV — this is what makes the renderer work on
 * serverless platforms where fire-and-forget jobs don't survive the
 * response.
 */

type State = {
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  outputUrl?: string;
  error?: string;
};

const stateKey = (renderJobId: string) => `ffmpeg-render:${renderJobId}`;

async function setState(renderJobId: string, state: State): Promise<void> {
  await kvSet(stateKey(renderJobId), state, 60 * 60 * 24);
}

async function resolveFfmpegBinary(): Promise<string> {
  if (env.ffmpegPath && env.ffmpegPath !== "ffmpeg") return env.ffmpegPath;
  try {
    const installer = (await import("@ffmpeg-installer/ffmpeg")) as unknown as {
      default?: { path?: string };
      path?: string;
    };
    return (installer.default?.path ?? installer.path) ?? "ffmpeg";
  } catch {
    return env.ffmpegPath || "ffmpeg";
  }
}

export class FfmpegMediaRenderer implements MediaRenderer {
  readonly mode = "ffmpeg" as const;
  readonly mixesAudio = true;

  async enqueue(req: RenderRequest): Promise<void> {
    await setState(req.renderJobId, { status: "queued", progress: 0.05 });

    const tmpDir = os.tmpdir();
    const tmpOutputPath = path.join(
      tmpDir,
      `evva-render-${crypto.randomUUID()}.mp4`
    );

    let sourceVideoPath: string;
    let sourceMusicPath: string;
    const cleanupPaths: string[] = [tmpOutputPath];

    try {
      sourceVideoPath = await fetchToTmp(req.videoSourceUrl, ".mp4");
      if (!req.videoSourceUrl.startsWith("/")) cleanupPaths.push(sourceVideoPath);
    } catch (err) {
      await setState(req.renderJobId, {
        status: "failed",
        progress: 1,
        error: `Could not fetch source video: ${String(err)}`
      });
      return;
    }

    try {
      const suffix = req.generatedAudioUrl.toLowerCase().includes(".mp3")
        ? ".mp3"
        : ".wav";
      sourceMusicPath = await fetchToTmp(req.generatedAudioUrl, suffix);
      if (!req.generatedAudioUrl.startsWith("/")) cleanupPaths.push(sourceMusicPath);
    } catch (err) {
      await setState(req.renderJobId, {
        status: "failed",
        progress: 1,
        error: `Could not fetch generated audio: ${String(err)}`
      });
      return;
    }

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

    await setState(req.renderJobId, { status: "processing", progress: 0.2 });

    const ffmpegBinary = await resolveFfmpegBinary();

    const exitCode = await new Promise<number | null>((resolve) => {
      const child = spawn(ffmpegBinary, [
        "-y",
        "-i",
        sourceVideoPath,
        "-stream_loop",
        "-1",
        "-i",
        sourceMusicPath,
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
        tmpOutputPath
      ]);

      child.stderr.on("data", () => undefined);
      child.on("error", () => resolve(-1));
      child.on("exit", (code) => resolve(code));
    });

    if (exitCode !== 0) {
      await cleanup(cleanupPaths);
      await setState(req.renderJobId, {
        status: "failed",
        progress: 1,
        error: `ffmpeg exited with code ${exitCode ?? "unknown"}.`
      });
      return;
    }

    // Upload the result to storage and persist final state.
    try {
      const buffer = await readFile(tmpOutputPath);
      const stored = await putBuffer(
        `renders/${req.renderJobId}.mp4`,
        buffer,
        "video/mp4"
      );
      await setState(req.renderJobId, {
        status: "completed",
        progress: 1,
        outputUrl: stored.url
      });
    } catch (err) {
      await setState(req.renderJobId, {
        status: "failed",
        progress: 1,
        error: `Could not persist rendered MP4: ${String(err)}`
      });
    } finally {
      await cleanup(cleanupPaths);
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

async function cleanup(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map((p) => unlink(p).catch(() => undefined))
  );
}

export function createFfmpegRenderer(): FfmpegMediaRenderer {
  return new FfmpegMediaRenderer();
}
