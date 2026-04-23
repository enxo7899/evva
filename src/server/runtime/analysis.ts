import { spawn } from "node:child_process";
import { env } from "@/lib/env";
import type {
  Orientation,
  VideoAnalysis,
  VideoAsset
} from "@/domain/contracts";

/**
 * Honest, minimal analysis. Extracts real facts from the uploaded file
 * via ffprobe when available; otherwise falls back to the client-reported
 * values. No invented moods, themes, or energy scores.
 *
 * Width, height, aspect ratio, and orientation are treated as first-class
 * data so the UI and render pipeline can respect the reel's native shape
 * without forcing it into a generic 16:9 box.
 */
export async function analyzeVideo(asset: VideoAsset): Promise<VideoAnalysis> {
  const probed = await tryFfprobe(asset.sourceUrl).catch(() => null);

  const durationSec = probed?.durationSec ?? asset.durationSec;
  const width = probed?.width ?? asset.width;
  const height = probed?.height ?? asset.height;
  const aspectRatio =
    probed?.aspectRatio ??
    asset.aspectRatio ??
    (width && height ? simplifyAspect(width, height) : undefined);
  const orientation = deriveOrientation(width, height) ?? asset.orientation;

  const parts: string[] = [];
  parts.push(`${durationSec.toFixed(1)}s clip`);
  if (width && height) parts.push(`${width}×${height}`);
  if (aspectRatio) parts.push(aspectRatio);
  parts.push(asset.mimeType.replace("video/", ""));

  return {
    durationSec,
    width,
    height,
    aspectRatio,
    orientation,
    summary: parts.join(" · ")
  };
}

async function tryFfprobe(publicSourceUrl: string): Promise<{
  durationSec: number;
  width?: number;
  height?: number;
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
          width,
          height,
          aspectRatio
        });
      } catch {
        resolve(null);
      }
    });
  });
}

export function simplifyAspect(w: number, h: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(w, h) || 1;
  return `${w / d}:${h / d}`;
}

export function deriveOrientation(
  width?: number,
  height?: number
): Orientation | undefined {
  if (!width || !height) return undefined;
  const ratio = width / height;
  if (Math.abs(ratio - 1) < 0.02) return "square";
  return ratio > 1 ? "landscape" : "portrait";
}
