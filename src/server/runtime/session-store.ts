import type { CompositionJob, RenderJob, VideoAsset } from "@/domain/contracts";

/**
 * Single-process in-memory store for the current MVP.
 * Restart == new session. No cross-session persistence by design.
 *
 * If we later add accounts / history, swap these three caches for a
 * proper repository implementation without changing call sites.
 */

const DEFAULT_TTL_MS = 1000 * 60 * 60 * 6; // 6h per entry

type Entry<T> = { value: T; expiresAt: number };

class Store<T> {
  private readonly data = new Map<string, Entry<T>>();

  set(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): T {
    this.data.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  get(key: string): T | null {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.data.delete(key);
      return null;
    }
    return entry.value;
  }

  update(key: string, mutator: (prev: T) => T): T | null {
    const current = this.get(key);
    if (!current) return null;
    return this.set(key, mutator(current));
  }

  delete(key: string): void {
    this.data.delete(key);
  }
}

// Module-level singletons. In dev, Next.js HMR may re-evaluate modules;
// we cache on globalThis to survive that.
type G = typeof globalThis & {
  __evvaVideos?: Store<VideoAsset>;
  __evvaCompositions?: Store<CompositionJob>;
  __evvaRenders?: Store<RenderJob>;
};

const g = globalThis as G;

export const videoStore: Store<VideoAsset> =
  g.__evvaVideos ?? (g.__evvaVideos = new Store<VideoAsset>());

export const compositionStore: Store<CompositionJob> =
  g.__evvaCompositions ?? (g.__evvaCompositions = new Store<CompositionJob>());

export const renderStore: Store<RenderJob> =
  g.__evvaRenders ?? (g.__evvaRenders = new Store<RenderJob>());
