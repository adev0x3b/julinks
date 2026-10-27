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

  /** Counts one attempt against the key and says whether it is still within the limit. */
  check(key: string): RateLimitResult {
    const now = this.now();
    const bucket = this.bucket(key, now);
    bucket.count += 1;
    return this.result(bucket, now);
  }

  /** Reads the key's state without counting an attempt: for callers that only want to count failures. */
  peek(key: string): RateLimitResult {
    const now = this.now();
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) return { ok: true, remaining: this.limit, retryAfterSeconds: 0 };
    // ok while there is budget for one more attempt.
    return { ...this.result(bucket, now), ok: bucket.count < this.limit };
  }

  private bucket(key: string, now: number): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
      if (this.buckets.size > 10_000) this.sweep(now);
    }
    return bucket;
  }

  private result(bucket: Bucket, now: number): RateLimitResult {
    return {
      ok: bucket.count <= this.limit,
      remaining: Math.max(0, this.limit - bucket.count),
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

/** 10 attempts per 15 minutes per IP: every sign-up, and failed logins only (a right password never spends the budget). */
export const authLimiter = limiter("auth", 10, 15 * 60 * 1000);
/** 120 redirects per minute per IP on the click endpoint. */
export const clickLimiter = limiter("click", 120, 60 * 1000);
/** 300 public page views per minute per IP. */
export const publicLimiter = limiter("public", 300, 60 * 1000);
/** Image uploads per user: each one is decoded and re-encoded, so keep the CPU honest. */
export const uploadLimiter = limiter("upload", 40, 15 * 60 * 1000);
