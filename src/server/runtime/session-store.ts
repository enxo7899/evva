import type { CompositionJob, RenderJob, VideoAsset } from "@/domain/contracts";
import { kvGet, kvSet, kvUpdate } from "./kv";

/**
 * Async session store backed by KV (Vercel KV / Upstash in production, an
 * in-memory Map in local dev — see `./kv`).
 *
 * All methods are async: this is a real over-the-network store when deployed,
 * and services must await accordingly. The interface is intentionally narrow
 * — get/set/update — so we don't accumulate Redis primitives leaking into the
 * domain layer.
 */

const TTL_SEC = 60 * 60 * 6; // 6h per entry

class AsyncStore<T> {
  constructor(private readonly prefix: string) {}

  async set(id: string, value: T): Promise<T> {
    await kvSet(`${this.prefix}:${id}`, value, TTL_SEC);
    return value;
  }

  async get(id: string): Promise<T | null> {
    return kvGet<T>(`${this.prefix}:${id}`);
  }

  async update(id: string, mutate: (prev: T) => T): Promise<T | null> {
    return kvUpdate<T>(`${this.prefix}:${id}`, mutate, TTL_SEC);
  }
}

export const videoStore = new AsyncStore<VideoAsset>("vid");
export const compositionStore = new AsyncStore<CompositionJob>("cmp");
export const renderStore = new AsyncStore<RenderJob>("rnd");
