import { spawn } from "node:child_process";
import { env } from "@/lib/env";
import type { VideoAnalysis, VideoAsset } from "@/domain/contracts";

/**
 * Honest, minimal analysis. Extracts real facts from the uploaded file
 * via ffprobe when available; otherwise falls back to the client-reported
 * duration. No invented moods, themes, or energy scores.
 */
export async function analyzeVideo(asset: VideoAsset): Promise<VideoAnalysis> {
  const probed = await tryFfprobe(asset.sourceUrl).catch(() => null);

  const durationSec = probed?.durationSec ?? asset.durationSec;
  const aspectRatio = probed?.aspectRatio;

  const parts: string[] = [];
  parts.push(`${durationSec.toFixed(1)}s clip`);
  if (aspectRatio) parts.push(aspectRatio);
  parts.push(asset.mimeType.replace("video/", ""));

  return {
    durationSec,
    aspectRatio,
    summary: parts.join(" · ")
  };
}

async function tryFfprobe(publicSourceUrl: string): Promise<{
  durationSec: number;
  aspectRatio?: string;
} | null> {
  if (!publicSourceUrl.startsWith("/")) return null;

  const path = await import("node:path");
  const fileAbsPath = path.join(
    process.cwd(),
    "public",
    publicSourceUrl.replace(/^\//, "")
  );

  const ffprobe = env.ffprobePath || "ffprobe";

  return new Promise((resolve) => {
    const child = spawn(ffprobe, [
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=width,height:format=duration",
      "-of",
      "json",
      fileAbsPath
    ]);

    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.on("error", () => resolve(null));
    child.on("exit", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }
      try {
        const parsed = JSON.parse(stdout) as {
          streams?: Array<{ width?: number; height?: number }>;
          format?: { duration?: string };
        };
        const duration = Number(parsed.format?.duration);
        const width = parsed.streams?.[0]?.width;
        const height = parsed.streams?.[0]?.height;
        const aspectRatio =
          width && height ? simplifyAspect(width, height) : undefined;
        resolve({
          durationSec: Number.isFinite(duration) && duration > 0 ? duration : 0,
          aspectRatio
        });
      } catch {
        resolve(null);
      }
    });
  });
}

function simplifyAspect(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h);
  return `${w / d}:${h / d}`;
}
