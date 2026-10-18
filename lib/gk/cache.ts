import { SourceError } from "./http";

// Transient in-memory cache for public source data (per server process, lost on restart or redeploy).
// It only exists to avoid hitting OpenTDB, PIB and Wikipedia on every click. It is never written to Supabase,
// the progress store or disk.

interface Entry<T> {
  value: T;
  fetchedAt: number;
  expiresAt: number;
}

export interface Cached<T> {
  value: T;
  /** When the source was actually fetched (ISO). */
  fetchedAt: string;
  /** True when the refresh failed and an earlier successful fetch is being served instead. */
  stale: boolean;
}

export interface CacheOptions {
  ttlMs: number;
  /** How long after expiry an old value may still be served when the source fails. */
  maxStaleMs: number;
  /** After a failure, wait this long before asking the source again (stale value or the error is returned meanwhile). */
  failureCooldownMs?: number;
}

const MAX_ENTRIES = 600;
const entries = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<Cached<unknown>>>();
const failures = new Map<string, { at: number; error: SourceError }>();

function remember(key: string, entry: Entry<unknown>) {
  entries.delete(key);
  entries.set(key, entry);
  // Map keeps insertion order, so the first key is the least recently stored one.
  while (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
}

/**
 * Returns the cached value for `key`, loading it when missing or expired. Concurrent callers share one load.
 * When a load fails, a previous value younger than `maxStaleMs` past expiry is returned with `stale: true`;
 * otherwise the error is thrown. A failed fetch is never reported as a successful one.
 */
export async function cached<T>(key: string, opts: CacheOptions, load: () => Promise<T>): Promise<Cached<T>> {
  const now = Date.now();
  const hit = entries.get(key) as Entry<T> | undefined;
  if (hit && hit.expiresAt > now) return { value: hit.value, fetchedAt: new Date(hit.fetchedAt).toISOString(), stale: false };

  const usable = hit && now - hit.expiresAt < opts.maxStaleMs ? hit : undefined;
  const staleResult = (): Cached<T> | null =>
    usable ? { value: usable.value, fetchedAt: new Date(usable.fetchedAt).toISOString(), stale: true } : null;

  const failed = failures.get(key);
  if (failed && now - failed.at < (opts.failureCooldownMs ?? 30_000)) {
    const s = staleResult();
    if (s) return s;
    throw failed.error;
  }

  const running = inflight.get(key) as Promise<Cached<T>> | undefined;
  if (running) return running;

  const p = (async (): Promise<Cached<T>> => {
    try {
      const value = await load();
      const fetchedAt = Date.now();
      remember(key, { value, fetchedAt, expiresAt: fetchedAt + opts.ttlMs });
      failures.delete(key);
      return { value, fetchedAt: new Date(fetchedAt).toISOString(), stale: false };
    } catch (e) {
      const error = e instanceof SourceError ? e : new SourceError("invalid", "The source returned unusable data.");
      if (!(e instanceof SourceError)) console.error(e);
      failures.set(key, { at: Date.now(), error });
      const s = staleResult();
      if (s) return s;
      throw error;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** Synchronous lookup without loading (used for per-item enrichment that may be skipped). */
export function peek<T>(key: string): T | undefined {
  const hit = entries.get(key) as Entry<T> | undefined;
  return hit && hit.expiresAt > Date.now() ? hit.value : undefined;
}

export function put<T>(key: string, value: T, ttlMs: number) {
  const now = Date.now();
  remember(key, { value, fetchedAt: now, expiresAt: now + ttlMs });
}

/** Tests only. */
export function clearCache() {
  entries.clear();
  inflight.clear();
  failures.clear();
}
