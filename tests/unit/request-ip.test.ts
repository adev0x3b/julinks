import { afterEach, describe, expect, it, vi } from "vitest";

const headerStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: (name: string) => headerStore.get(name.toLowerCase()) ?? null }),
}));

const { clientIp } = await import("@/lib/request-ip");

afterEach(() => {
  headerStore.clear();
  delete process.env.TRUST_PROXY;
});

describe("clientIp", () => {
  it("takes the first forwarded entry when no proxy is trusted", async () => {
    headerStore.set("x-forwarded-for", "203.0.113.9, 10.0.0.1");
    expect(await clientIp()).toBe("203.0.113.9");
  });

  it("takes the entry the trusted proxy appended, so the client cannot pick its own", async () => {
    process.env.TRUST_PROXY = "1";
    headerStore.set("x-forwarded-for", "1.2.3.4, 203.0.113.9");
    expect(await clientIp()).toBe("203.0.113.9");
  });

  it("believes cf-connecting-ip only behind Cloudflare", async () => {
    headerStore.set("cf-connecting-ip", "203.0.113.9");
    headerStore.set("x-forwarded-for", "1.2.3.4");
    expect(await clientIp()).toBe("1.2.3.4");
    process.env.TRUST_PROXY = "cloudflare";
    expect(await clientIp()).toBe("203.0.113.9");
    headerStore.delete("cf-connecting-ip");
    headerStore.set("x-forwarded-for", "1.2.3.4, 203.0.113.10");
    expect(await clientIp()).toBe("203.0.113.10");
  });

  it("falls back to x-real-ip, then to a fixed key", async () => {
    headerStore.set("x-real-ip", "198.51.100.7");
    expect(await clientIp()).toBe("198.51.100.7");
    headerStore.clear();
    expect(await clientIp()).toBe("unknown");
  });
});
