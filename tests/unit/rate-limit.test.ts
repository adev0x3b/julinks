import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  it("allows up to the limit inside a window, then blocks", () => {
    let now = 0;
    const limiter = new RateLimiter(3, 1000, () => now);
    expect(limiter.check("ip").ok).toBe(true);
    expect(limiter.check("ip").ok).toBe(true);
    expect(limiter.check("ip").remaining).toBe(0);
    const blocked = limiter.check("ip");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    now = 1000;
    expect(limiter.check("ip").ok).toBe(true);
  });

  it("keeps keys independent", () => {
    const limiter = new RateLimiter(1, 1000, () => 0);
    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("b").ok).toBe(true);
    expect(limiter.check("a").ok).toBe(false);
  });
});
