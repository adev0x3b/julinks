/**
 * Fixed-window rate limiter kept in process memory.
 *
 * JuLinks runs as a single container (docker compose), so an in-memory map is
 * enough and keeps the dependency list short. Behind several replicas this
 * would need a shared store such as Redis; the interface stays the same.
 */
export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

type Bucket = { count: number; resetAt: number };

export class RateLimiter {
  private buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
      if (this.buckets.size > 10_000) this.sweep(now);
    }
    bucket.count += 1;
    const remaining = Math.max(0, this.limit - bucket.count);
    return {
      ok: bucket.count <= this.limit,
      remaining,
      retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  /** Drops expired buckets so the map cannot grow without bound. */
  private sweep(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

const globalLimiters = globalThis as unknown as { __julinksLimiters?: Record<string, RateLimiter> };
const limiters = (globalLimiters.__julinksLimiters ??= {});

function limiter(name: string, limit: number, windowMs: number): RateLimiter {
  return (limiters[name] ??= new RateLimiter(limit, windowMs));
}

/** 10 attempts per 15 minutes per IP on login and signup. */
export const authLimiter = limiter("auth", 10, 15 * 60 * 1000);
/** 120 redirects per minute per IP on the click endpoint. */
export const clickLimiter = limiter("click", 120, 60 * 1000);
/** 300 public page views per minute per IP. */
export const publicLimiter = limiter("public", 300, 60 * 1000);
/** Image uploads per user: each one is decoded and re-encoded, so keep the CPU honest. */
export const uploadLimiter = limiter("upload", 40, 15 * 60 * 1000);
