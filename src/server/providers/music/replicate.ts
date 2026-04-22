import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import { deriveTags, buildPrompts } from "./prompting";
import type {
  MusicGenerationRequest,
  MusicGenerationResult,
  MusicGenerationStatus,
  MusicGenerationTicket,
  MusicProvider
} from "./interface";

const REPLICATE_API = "https://api.replicate.com/v1";

type ReplicatePrediction = {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
  input?: Record<string, unknown>;
};

/**
 * Real music generation via Replicate.
 *
 * Each Evva CompositionJob maps to N parallel Replicate predictions (one per
 * requested candidate). We submit concurrently, then poll via `getStatus`.
 * When all predictions are done, `fetchResults` downloads each output WAV
 * into public/generated/<cmp>-<i>.wav so the browser can stream it directly.
 *
 * Default model: meta/musicgen (instrumental music from text prompt).
 */
export class ReplicateMusicProvider implements MusicProvider {
  readonly name = "replicate" as const;

  constructor(
    private readonly token: string,
    private readonly model: string
  ) {
    if (!token) {
      throw new Error(
        "REPLICATE_API_TOKEN is missing. Set it to use the Replicate music provider, " +
          "or set GENERATED_MUSIC_PROVIDER=mock to run the local fallback."
      );
    }
  }

  async submit(req: MusicGenerationRequest): Promise<MusicGenerationTicket> {
    const { prompts, titles } = buildPrompts(req.direction, req.candidateCount);
    const duration = clamp(req.targetDurationSec, 5, 30);
    const isInstrumental =
      (req.direction.vocalPreference ?? "instrumental_only") === "instrumental_only";

    // Fire predictions in parallel. If any single one fails to queue, we
    // still keep the ones that succeeded — the composition will simply
    // produce fewer candidates.
    const settled = await Promise.allSettled(
      prompts.map((prompt) => this.createPrediction(prompt, duration))
    );

    const providerJobIds: string[] = [];
    const keptPrompts: string[] = [];
    const keptTitles: string[] = [];

    settled.forEach((result, i) => {
      if (result.status === "fulfilled") {
        providerJobIds.push(result.value.id);
        keptPrompts.push(prompts[i]);
        keptTitles.push(titles[i]);
      }
    });

    if (providerJobIds.length === 0) {
      const firstRejection = settled.find((s) => s.status === "rejected");
      const message =
        firstRejection && firstRejection.status === "rejected"
          ? String(firstRejection.reason)
          : "Replicate refused every prediction request.";
      throw new Error(`Replicate submission failed: ${message}`);
    }

    return {
      providerJobIds,
      prompts: keptPrompts,
      titles: keptTitles,
      isInstrumental,
      targetDurationSec: duration
    };
  }

  async getStatus(ticket: MusicGenerationTicket): Promise<MusicGenerationStatus> {
    const predictions = await Promise.all(
      ticket.providerJobIds.map((id) => this.fetchPrediction(id))
    );

    let completed = 0;
    let failed = 0;
    let lastError: string | undefined;

    for (const p of predictions) {
      if (p.status === "succeeded") completed++;
      else if (p.status === "failed" || p.status === "canceled") {
        failed++;
        lastError = p.error ?? "Prediction failed";
      }
    }

    const total = predictions.length;
    const finished = completed + failed;

    // If everything failed, surface that as a hard job failure.
    if (failed === total) {
      return {
        status: "failed",
        progress: 1,
        error: lastError ?? "All predictions failed."
      };
    }

    // Done when every prediction has resolved one way or another AND at
    // least one succeeded.
    if (finished === total) {
      return { status: "completed", progress: 1 };
    }

    return {
      status: completed > 0 || finished > 0 ? "processing" : "queued",
      progress: Number((0.1 + (finished / total) * 0.85).toFixed(2))
    };
  }

  async fetchResults(ticket: MusicGenerationTicket): Promise<MusicGenerationResult[]> {
    const predictions = await Promise.all(
      ticket.providerJobIds.map((id) => this.fetchPrediction(id))
    );

    const outputDir = path.join(process.cwd(), "public", "generated");
    await mkdir(outputDir, { recursive: true });

    const results: MusicGenerationResult[] = [];

    for (let i = 0; i < predictions.length; i++) {
      const p = predictions[i];
      if (p.status !== "succeeded") continue;

      const remoteUrl = Array.isArray(p.output) ? p.output[0] : p.output;
      if (!remoteUrl) continue;

      const localName = `${ticket.providerJobIds[i]}.wav`;
      const audioUrl = `/generated/${localName}`;

      try {
        const audioRes = await fetch(remoteUrl);
        if (!audioRes.ok) continue;
        const buffer = Buffer.from(await audioRes.arrayBuffer());
        await writeFile(path.join(outputDir, localName), buffer);
      } catch {
        continue;
      }

      const prompt = ticket.prompts[i] ?? "";
      const suffix = prompt.split(",").slice(-3).join(",");

      results.push({
        externalId: p.id,
        title: ticket.titles[i] ?? `Track ${i + 1}`,
        prompt,
        audioUrl,
        durationSec: ticket.targetDurationSec,
        tags: deriveTags({}, suffix),
        isInstrumental: ticket.isInstrumental
      });
    }

    return results;
  }

  // ---- internals ----

  private async createPrediction(
    prompt: string,
    durationSec: number
  ): Promise<ReplicatePrediction> {
    const url = this.model.includes("/")
      ? `${REPLICATE_API}/models/${this.model}/predictions`
      : `${REPLICATE_API}/predictions`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Token ${this.token}`,
        "Content-Type": "application/json",
        Prefer: "respond-async"
      },
      body: JSON.stringify({
        input: {
          prompt,
          duration: durationSec,
          model_version: "stereo-large",
          output_format: "wav",
          normalization_strategy: "peak",
          temperature: 1,
          classifier_free_guidance: 3
        }
      })
    });

    if (!res.ok) {
      const body = await safeReadText(res);
      throw new Error(
        `Replicate create prediction failed (${res.status}): ${body.slice(0, 400)}`
      );
    }

    return (await res.json()) as ReplicatePrediction;
  }

  private async fetchPrediction(id: string): Promise<ReplicatePrediction> {
    const res = await fetch(`${REPLICATE_API}/predictions/${id}`, {
      headers: { Authorization: `Token ${this.token}` },
      cache: "no-store"
    });
    if (!res.ok) {
      const body = await safeReadText(res);
      throw new Error(
        `Replicate get prediction failed (${res.status}): ${body.slice(0, 400)}`
      );
    }
    return (await res.json()) as ReplicatePrediction;
  }
}

async function safeReadText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return "";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function createReplicateProvider(): ReplicateMusicProvider {
  return new ReplicateMusicProvider(
    env.replicateApiToken ?? "",
    env.replicateMusicModel ?? "meta/musicgen"
  );
}
