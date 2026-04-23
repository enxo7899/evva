import { env } from "@/lib/env";
import { kvGet, kvSet } from "@/server/runtime/kv";
import { putBuffer } from "@/server/runtime/storage";
import { buildPrompts, deriveTags } from "./prompting";
import type {
  MusicGenerationRequest,
  MusicGenerationResult,
  MusicGenerationStatus,
  MusicGenerationTicket,
  MusicProvider
} from "./interface";

const ELEVENLABS_BASE = "https://api.elevenlabs.io";
const MUSIC_ENDPOINT = "/v1/music";

/**
 * Real music generation via ElevenLabs Music.
 *
 * ElevenLabs' /v1/music endpoint is synchronous — the request blocks until
 * the track is generated, then returns audio bytes. On Vercel serverless we
 * cannot reliably do fire-and-forget background work across invocations, so
 * `submit` awaits all N candidates to completion, uploads each to Blob
 * storage, and persists the results in KV before returning.
 *
 * `getStatus` / `fetchResults` then simply read from KV — they are fast and
 * stateless across containers.
 */

type JobBucket = {
  results: MusicGenerationResult[];
  totalFailed: number;
  totalRequested: number;
  lastError?: string;
};

const bucketKey = (providerJobId: string) => `el-music:${providerJobId}`;

export class ElevenLabsMusicProvider implements MusicProvider {
  readonly name = "elevenlabs" as const;

  constructor(
    private readonly apiKey: string,
    private readonly modelId: string | undefined
  ) {
    if (!apiKey) {
      throw new Error(
        "ELEVENLABS_API_KEY is missing. Set it to use the ElevenLabs music provider, " +
          "or set GENERATED_MUSIC_PROVIDER=mock to run the local fallback."
      );
    }
  }

  async submit(req: MusicGenerationRequest): Promise<MusicGenerationTicket> {
    const { prompts, titles } = buildPrompts(req.direction, req.candidateCount);
    const durationSec = clamp(req.targetDurationSec, 10, 120);
    const musicLengthMs = durationSec * 1000;
    const isInstrumental =
      (req.direction.vocalPreference ?? "instrumental_only") === "instrumental_only";

    const providerJobIds = prompts.map(
      (_, i) => `el_${req.compositionId}_${i + 1}`
    );

    // Fire every generation in parallel. Each resolved promise yields a
    // ready-to-serve MusicGenerationResult with an audio URL (Blob CDN or
    // /public fallback). Rejections become per-candidate failures; as long
    // as at least one succeeds, we still return a viable ticket.
    const settled = await Promise.allSettled(
      prompts.map((prompt, i) =>
        this.generateOne({
          jobId: providerJobIds[i],
          prompt,
          title: titles[i] ?? `Track ${i + 1}`,
          durationSec,
          musicLengthMs,
          isInstrumental
        })
      )
    );

    const results: MusicGenerationResult[] = [];
    let totalFailed = 0;
    let lastError: string | undefined;

    for (const s of settled) {
      if (s.status === "fulfilled") {
        results.push(s.value);
      } else {
        totalFailed++;
        lastError = String(s.reason);
      }
    }

    const bucket: JobBucket = {
      results,
      totalFailed,
      totalRequested: providerJobIds.length,
      lastError
    };
    await Promise.all(
      providerJobIds.map((id) => kvSet(bucketKey(id), bucket, 60 * 60 * 6))
    );

    return {
      providerJobIds,
      prompts,
      titles,
      isInstrumental,
      targetDurationSec: durationSec
    };
  }

  async getStatus(ticket: MusicGenerationTicket): Promise<MusicGenerationStatus> {
    const bucket = await kvGet<JobBucket>(bucketKey(ticket.providerJobIds[0]));
    if (!bucket) {
      return { status: "failed", progress: 1, error: "ElevenLabs job not found." };
    }
    if (bucket.results.length === 0) {
      return {
        status: "failed",
        progress: 1,
        error: bucket.lastError ?? "All ElevenLabs generations failed."
      };
    }
    return { status: "completed", progress: 1 };
  }

  async fetchResults(ticket: MusicGenerationTicket): Promise<MusicGenerationResult[]> {
    const bucket = await kvGet<JobBucket>(bucketKey(ticket.providerJobIds[0]));
    return bucket?.results ?? [];
  }

  // ---- internals ----

  private async generateOne(input: {
    jobId: string;
    prompt: string;
    title: string;
    durationSec: number;
    musicLengthMs: number;
    isInstrumental: boolean;
  }): Promise<MusicGenerationResult> {
    const body: Record<string, unknown> = {
      prompt: input.prompt,
      music_length_ms: input.musicLengthMs
    };
    if (this.modelId) body.model_id = this.modelId;

    const res = await fetch(`${ELEVENLABS_BASE}${MUSIC_ENDPOINT}`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await safeReadText(res);
      throw new Error(
        `ElevenLabs music failed (${res.status}): ${text.slice(0, 400)}`
      );
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const stored = await putBuffer(
      `generated/${input.jobId}.mp3`,
      buffer,
      "audio/mpeg"
    );

    const suffix = input.prompt.split(",").slice(-3).join(",");

    return {
      externalId: input.jobId,
      title: input.title,
      prompt: input.prompt,
      audioUrl: stored.url,
      durationSec: input.durationSec,
      tags: deriveTags({}, suffix),
      isInstrumental: input.isInstrumental
    };
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

export function createElevenLabsProvider(): ElevenLabsMusicProvider {
  return new ElevenLabsMusicProvider(
    env.elevenLabsApiKey ?? "",
    env.elevenLabsMusicModel
  );
}
