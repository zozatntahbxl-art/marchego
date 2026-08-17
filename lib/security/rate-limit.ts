/**
 * Rate limiting en mémoire.
 *
 * Suffisant pour une instance unique (Vercel serverless : chaque isolate a
 * son propre store, donc le plafond est par isolate). En production à fort
 * trafic, remplacer par Upstash Redis sans changer l'API `consume()`.
 *
 * Algorithme : sliding window par clé (IP + route).
 */

interface Bucket {
  hits: number[];
}

const store = new Map<string, Bucket>();

const DEFAULTS = {
  windowMs: 60_000,
  max: 60,
};

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function consume(
  key: string,
  opts: { windowMs?: number; max?: number } = {},
): RateLimitResult {
  const windowMs = opts.windowMs ?? DEFAULTS.windowMs;
  const max = opts.max ?? DEFAULTS.max;
  const now = Date.now();
  const cutoff = now - windowMs;

  let bucket = store.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    store.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= max) {
    const retryAfterMs = bucket.hits[0] + windowMs - now;
    return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
  }

  bucket.hits.push(now);
  return { allowed: true, remaining: max - bucket.hits.length, retryAfterMs: 0 };
}

export function rateLimitHeaders(result: RateLimitResult, max: number) {
  return {
    'X-RateLimit-Limit': String(max),
    'X-RateLimit-Remaining': String(result.remaining),
    ...(result.allowed ? {} : { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) }),
  };
}

/** Nettoyage opportuniste pour ne pas laisser grossir le Map indéfiniment. */
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const cutoff = Date.now() - 5 * 60_000;
    for (const [k, b] of store) {
      b.hits = b.hits.filter((t) => t > cutoff);
      if (b.hits.length === 0) store.delete(k);
    }
  }, 60_000);
  timer.unref?.();
}
