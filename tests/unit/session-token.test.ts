import { afterEach, describe, expect, it, vi } from "vitest";

// session.ts imports server-only and next/headers; neither is needed to test the token helpers.
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

const { signSessionToken, verifySessionToken } = await import("@/lib/session");

const COMPOSE_DEFAULT = "compose-demo-secret-change-me-for-anything-real";
const originalEnv = { SESSION_SECRET: process.env.SESSION_SECRET, APP_URL: process.env.APP_URL };

afterEach(() => {
  process.env.SESSION_SECRET = originalEnv.SESSION_SECRET;
  process.env.APP_URL = originalEnv.APP_URL;
});

describe("session tokens", () => {
  it("round-trips the user id and session version", async () => {
    const token = await signSessionToken("user_1", 60, 3);
    expect(await verifySessionToken(token)).toEqual({ userId: "user_1", version: 3 });
  });

  it("treats a token issued before versions existed as version 0", async () => {
    const token = await signSessionToken("user_1");
    expect(await verifySessionToken(token)).toEqual({ userId: "user_1", version: 0 });
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

  it("refuses the compose demo secret unless the app is served on localhost", async () => {
    process.env.SESSION_SECRET = COMPOSE_DEFAULT;
    process.env.APP_URL = "http://localhost:3000";
    await expect(signSessionToken("user_1")).resolves.toBeTypeOf("string");
    process.env.APP_URL = "https://links.example.com";
    await expect(signSessionToken("user_1")).rejects.toThrow(/compose demo default/);
    await expect(verifySessionToken("x.y.z")).rejects.toThrow(/compose demo default/);
  });

  it("refuses a short secret", async () => {
    process.env.SESSION_SECRET = "short";
    await expect(signSessionToken("user_1")).rejects.toThrow(/at least 32/);
  });
});
