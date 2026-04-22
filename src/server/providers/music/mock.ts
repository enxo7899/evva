import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildPrompts, deriveTags } from "./prompting";
import type {
  MusicGenerationRequest,
  MusicGenerationResult,
  MusicGenerationStatus,
  MusicGenerationTicket,
  MusicProvider
} from "./interface";

/**
 * Local-only fallback provider.
 *
 * Writes short seeded sine-wave WAV stems to public/generated/ so the full
 * UX (selection, mix preview, render) is exercisable end-to-end without any
 * external API key. Candidates will NOT sound musical — the UI labels this
 * explicitly as "preview mode" in the config banner.
 */

type MockJobState = {
  createdAtMs: number;
  processingAtMs: number;
  completedAtMs: number;
  results: MusicGenerationResult[];
};

type G = typeof globalThis & {
  __evvaMockJobs?: Map<string, MockJobState>;
};
const g = globalThis as G;
const jobs: Map<string, MockJobState> = g.__evvaMockJobs ?? (g.__evvaMockJobs = new Map());

export class MockMusicProvider implements MusicProvider {
  readonly name = "mock" as const;

  async submit(req: MusicGenerationRequest): Promise<MusicGenerationTicket> {
    const { prompts, titles } = buildPrompts(req.direction, req.candidateCount);
    const isInstrumental = req.direction.vocalPreference !== "vocals_preferred";

    const providerJobIds = prompts.map(
      (_, i) => `mock_${req.compositionId}_${i + 1}`
    );

    const createdAtMs = Date.now();
    const processingAtMs = createdAtMs + 600;
    const completedAtMs = processingAtMs + 1800;

    const outputDir = path.join(process.cwd(), "public", "generated");
    await mkdir(outputDir, { recursive: true });

    const results: MusicGenerationResult[] = [];

    for (let i = 0; i < providerJobIds.length; i++) {
      const localName = `${providerJobIds[i]}.wav`;
      const filePath = path.join(outputDir, localName);
      const durationSec = Math.min(24, req.targetDurationSec);
      const frequency = 180 + (i + 1) * 48;

      const wav = createToneWav({
        frequency,
        durationSec
      });
      await writeFile(filePath, wav);

      const suffix = prompts[i].split(",").slice(-2).join(",");

      results.push({
        externalId: providerJobIds[i],
        title: titles[i] ?? `Sketch ${i + 1}`,
        prompt: prompts[i],
        audioUrl: `/generated/${localName}`,
        durationSec,
        tags: ["preview", ...deriveTags({}, suffix)].slice(0, 5),
        isInstrumental
      });
    }

    providerJobIds.forEach((id) => {
      jobs.set(id, { createdAtMs, processingAtMs, completedAtMs, results });
    });

    return {
      providerJobIds,
      prompts,
      titles,
      isInstrumental,
      targetDurationSec: req.targetDurationSec
    };
  }

  async getStatus(ticket: MusicGenerationTicket): Promise<MusicGenerationStatus> {
    const now = Date.now();
    const state = jobs.get(ticket.providerJobIds[0]);
    if (!state) return { status: "failed", progress: 1, error: "Mock job not found" };

    if (now < state.processingAtMs) {
      return {
        status: "queued",
        progress: Number(
          Math.max(0.05, (now - state.createdAtMs) / (state.processingAtMs - state.createdAtMs) / 3).toFixed(2)
        )
      };
    }
    if (now < state.completedAtMs) {
      return {
        status: "processing",
        progress: Number(
          (
            0.3 +
            ((now - state.processingAtMs) / (state.completedAtMs - state.processingAtMs)) * 0.65
          ).toFixed(2)
        )
      };
    }
    return { status: "completed", progress: 1 };
  }

  async fetchResults(ticket: MusicGenerationTicket): Promise<MusicGenerationResult[]> {
    const state = jobs.get(ticket.providerJobIds[0]);
    return state ? state.results : [];
  }
}

function createToneWav(input: { frequency: number; durationSec: number }) {
  const sampleRate = 22050;
  const sampleCount = Math.floor(sampleRate * input.durationSec);
  const bytesPerSample = 2;
  const dataSize = sampleCount * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
  buffer.writeUInt16LE(bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t / 3.2);
    const sample = Math.sin(2 * Math.PI * input.frequency * t) * envelope;
    buffer.writeInt16LE(Math.round(sample * 0.32 * 32767), 44 + i * bytesPerSample);
  }

  return buffer;
}

export function createMockMusicProvider(): MockMusicProvider {
  return new MockMusicProvider();
}
