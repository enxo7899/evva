import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
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
 * ElevenLabs' music endpoint is synchronous: the request blocks until the
 * track is generated, then returns the audio bytes directly. To keep the
 * pollable job shape the rest of Evva expects, we:
 *
 *   - `submit`: kick off N fetches in parallel (one per candidate), save
 *     their in-flight promises in a process-local map, and return a
 *     ticket that references them by id.
 *   - `getStatus`: report how many of the N candidates have resolved.
 *   - `fetchResults`: return the already-written audio file URLs.
 *
 * Audio is saved under public/generated/<candidateId>.mp3 so the browser
 * can stream it directly.
 */

type JobState = {
  completed: boolean;
  failed: boolean;
  error?: string;
  resultUrl?: string;
  resultDurationSec: number;
  prompt: string;
  title: string;
  isInstrumental: boolean;
};

type G = typeof globalThis & {
  __evvaElevenJobs?: Map<string, JobState>;
};
const g = globalThis as G;
const jobs: Map<string, JobState> =
  g.__evvaElevenJobs ?? (g.__evvaElevenJobs = new Map());

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

    const outputDir = path.join(process.cwd(), "public", "generated");
    await mkdir(outputDir, { recursive: true });

    // Seed job state, then fire-and-forget the generation requests. The
    // service polls getStatus to learn when everything is done.
    prompts.forEach((prompt, i) => {
      jobs.set(providerJobIds[i], {
        completed: false,
        failed: false,
        resultDurationSec: durationSec,
        prompt,
        title: titles[i] ?? `Track ${i + 1}`,
        isInstrumental
      });
    });

    prompts.forEach((prompt, i) => {
      const jobId = providerJobIds[i];
      void this.generateOne({
        jobId,
        prompt,
        musicLengthMs,
        outputDir
      }).catch((error) => {
        const state = jobs.get(jobId);
        if (!state) return;
        jobs.set(jobId, {
          ...state,
          failed: true,
          completed: true,
          error: error instanceof Error ? error.message : "Generation failed"
        });
      });
    });

    return {
      providerJobIds,
      prompts,
      titles,
      isInstrumental,
      targetDurationSec: durationSec
    };
  }

  async getStatus(ticket: MusicGenerationTicket): Promise<MusicGenerationStatus> {
    let completed = 0;
    let failed = 0;
    let lastError: string | undefined;

    for (const id of ticket.providerJobIds) {
      const state = jobs.get(id);
      if (!state) {
        failed++;
        lastError = "Job state missing";
        continue;
      }
      if (state.completed) completed++;
      if (state.failed) {
        failed++;
        lastError = state.error ?? lastError;
      }
    }

    const total = ticket.providerJobIds.length;
    const succeeded = completed - failed;

    if (failed === total) {
      return {
        status: "failed",
        progress: 1,
        error: lastError ?? "All ElevenLabs generations failed."
      };
    }

    if (completed === total) {
      return { status: "completed", progress: 1 };
    }

    return {
      status: succeeded > 0 || completed > 0 ? "processing" : "queued",
      progress: Number((0.1 + (completed / total) * 0.85).toFixed(2))
    };
  }

  async fetchResults(ticket: MusicGenerationTicket): Promise<MusicGenerationResult[]> {
    const results: MusicGenerationResult[] = [];

    for (const id of ticket.providerJobIds) {
      const state = jobs.get(id);
      if (!state || !state.completed || state.failed || !state.resultUrl) continue;

      const suffix = state.prompt.split(",").slice(-3).join(",");

      results.push({
        externalId: id,
        title: state.title,
        prompt: state.prompt,
        audioUrl: state.resultUrl,
        durationSec: state.resultDurationSec,
        tags: deriveTags({}, suffix),
        isInstrumental: state.isInstrumental
      });
    }

    return results;
  }

  // ---- internals ----

  private async generateOne(input: {
    jobId: string;
    prompt: string;
    musicLengthMs: number;
    outputDir: string;
  }): Promise<void> {
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
    const filename = `${input.jobId}.mp3`;
    await writeFile(path.join(input.outputDir, filename), buffer);

    const state = jobs.get(input.jobId);
    if (!state) return;
    jobs.set(input.jobId, {
      ...state,
      completed: true,
      failed: false,
      resultUrl: `/generated/${filename}`
    });
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
