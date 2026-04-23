import { kv } from "@vercel/kv";

/**
 * KV abstraction with a dev-only in-memory fallback.
 *
 * - If KV_REST_API_URL is configured (Vercel KV / Upstash), all reads/writes
 *   go to the remote store and survive across serverless invocations.
 * - Otherwise, we cache on globalThis so a single `npm run dev` process can
 *   run end-to-end without provisioning a KV store.
 *
 * The fallback is NOT suitable for production — on Vercel each request may
 * land on a different container, so state must be externalized.
 */

export const hasKvStore = () => Boolean(process.env.KV_REST_API_URL);

type Entry<T> = { value: T; expiresAt: number };
type LocalMap = Map<string, Entry<unknown>>;

type G = typeof globalThis & { __evvaKvFallback?: LocalMap };
const g = globalThis as G;
const local: LocalMap = g.__evvaKvFallback ?? (g.__evvaKvFallback = new Map());

const DEFAULT_TTL_SEC = 60 * 60 * 6; // 6h

export async function kvGet<T>(key: string): Promise<T | null> {
  if (hasKvStore()) {
    return (await kv.get<T>(key)) ?? null;
  }
  const entry = local.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    local.delete(key);
    return null;
  }
  return entry.value as T;
}

export async function kvSet<T>(
  key: string,
  value: T,
  ttlSec: number = DEFAULT_TTL_SEC
): Promise<void> {
  if (hasKvStore()) {
    await kv.set(key, value, { ex: ttlSec });
    return;
  }
  local.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

export async function kvDelete(key: string): Promise<void> {
  if (hasKvStore()) {
    await kv.del(key);
    return;
  }
  local.delete(key);
}

export async function kvUpdate<T>(
  key: string,
  mutate: (prev: T) => T,
  ttlSec: number = DEFAULT_TTL_SEC
): Promise<T | null> {
  const cur = await kvGet<T>(key);
  if (cur === null) return null;
  const next = mutate(cur);
  await kvSet(key, next, ttlSec);
  return next;
}
