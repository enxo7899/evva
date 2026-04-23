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

/**
 * Local-only fallback provider.
 *
 * Writes short seeded sine-wave WAV stems via the storage abstraction (Blob
 * in production, `public/generated/` in dev) so the full UX (selection, mix
 * preview, render) is exercisable end-to-end without any music API key.
 * Candidates will NOT sound musical — the UI labels this explicitly as
 * "preview mode" in the config banner.
 *
 * Because generation is synchronous and fast, `submit` completes everything
 * before returning. Job state is persisted in KV so subsequent `getStatus`
 * / `fetchResults` calls (which may land on a different serverless
 * container) still see the results.
 */

type MockJobState = {
  results: MusicGenerationResult[];
};

const stateKey = (providerJobId: string) => `mock-music:${providerJobId}`;

export class MockMusicProvider implements MusicProvider {
  readonly name = "mock" as const;

  async submit(req: MusicGenerationRequest): Promise<MusicGenerationTicket> {
    const { prompts, titles } = buildPrompts(req.direction, req.candidateCount);
    const isInstrumental = req.direction.vocalPreference !== "vocals_preferred";

    const providerJobIds = prompts.map(
      (_, i) => `mock_${req.compositionId}_${i + 1}`
    );

    const results: MusicGenerationResult[] = [];

    for (let i = 0; i < providerJobIds.length; i++) {
      const pathname = `generated/${providerJobIds[i]}.wav`;
      const durationSec = Math.min(24, req.targetDurationSec);
      const frequency = 180 + (i + 1) * 48;

      const wav = createToneWav({ frequency, durationSec });
      const stored = await putBuffer(pathname, wav, "audio/wav");

      const suffix = prompts[i].split(",").slice(-2).join(",");

      results.push({
        externalId: providerJobIds[i],
        title: titles[i] ?? `Sketch ${i + 1}`,
        prompt: prompts[i],
        audioUrl: stored.url,
        durationSec,
        tags: ["preview", ...deriveTags({}, suffix)].slice(0, 5),
        isInstrumental
      });
    }

    const state: MockJobState = { results };
    await Promise.all(
      providerJobIds.map((id) => kvSet(stateKey(id), state, 60 * 60 * 6))
    );

    return {
      providerJobIds,
      prompts,
      titles,
      isInstrumental,
      targetDurationSec: req.targetDurationSec
    };
  }

  async getStatus(ticket: MusicGenerationTicket): Promise<MusicGenerationStatus> {
    const state = await kvGet<MockJobState>(stateKey(ticket.providerJobIds[0]));
    if (!state) return { status: "failed", progress: 1, error: "Mock job not found" };
    return { status: "completed", progress: 1 };
  }

  async fetchResults(ticket: MusicGenerationTicket): Promise<MusicGenerationResult[]> {
    const state = await kvGet<MockJobState>(stateKey(ticket.providerJobIds[0]));
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
