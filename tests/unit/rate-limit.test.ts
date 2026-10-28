import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/lib/rate-limit";

describe("RateLimiter", () => {
  it("forgets a key on clear", () => {
    const limiter = new RateLimiter(1, 60_000);
    limiter.check("k");
    expect(limiter.check("k").ok).toBe(false);
    limiter.clear("k");
    expect(limiter.check("k").ok).toBe(true);
  });

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

  it("peek reads the budget without spending it", () => {
    let now = 0;
    const limiter = new RateLimiter(2, 1000, () => now);
    expect(limiter.peek("ip")).toEqual({ ok: true, remaining: 2, retryAfterSeconds: 0 });
    limiter.check("ip");
    expect(limiter.peek("ip").ok).toBe(true);
    expect(limiter.peek("ip").remaining).toBe(1);
    limiter.check("ip");
    // Budget spent: blocked before another attempt is made, with the time to wait.
    const blocked = limiter.peek("ip");
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(1);
    now = 1000;
    expect(limiter.peek("ip").ok).toBe(true);
  });

  it("keeps keys independent", () => {
    const limiter = new RateLimiter(1, 1000, () => 0);
    expect(limiter.check("a").ok).toBe(true);
    expect(limiter.check("b").ok).toBe(true);
    expect(limiter.check("a").ok).toBe(false);
  });
});
