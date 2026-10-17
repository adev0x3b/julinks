import { describe, expect, it, vi } from "vitest";

// session.ts imports server-only and next/headers; neither is needed to test the token helpers.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

const { signSessionToken, verifySessionToken } = await import("@/lib/session");

describe("session tokens", () => {
  it("round-trips the user id", async () => {
    const token = await signSessionToken("user_1");
    expect(await verifySessionToken(token)).toBe("user_1");
  });

  it("rejects an expired token", async () => {
    const token = await signSessionToken("user_1", -10);
    expect(await verifySessionToken(token)).toBeNull();
  });

  it("rejects a tampered token", async () => {
    const token = await signSessionToken("user_1");
    const [header, payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "user_2" })).toString("base64url");
    expect(await verifySessionToken(`${header}.${forged}.${signature}`)).toBeNull();
    expect(await verifySessionToken(`${header}.${payload}.AAAA`)).toBeNull();
  });
});
