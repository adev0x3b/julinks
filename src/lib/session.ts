import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { canReview, type Role } from "@/lib/roles";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Where a request with a cookie that no longer maps to a user is sent. The route
 * clears the cookie before showing /login; sending such a request straight to
 * /login would loop, because the proxy bounces any cookie-carrying request for
 * /login back to /dashboard.
 */
const SESSION_EXPIRED_PATH = "/login/expired";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * Secrets everybody knows: the placeholder in .env.example, the value old .env files copied from
 * docker-compose's former default, and the ones the tests and CI use. Fine locally, a skeleton key
 * on the internet.
 */
const KNOWN_SECRETS = new Set([
  "compose-demo-secret-change-me-for-anything-real",
  "change-me-to-a-long-random-string-32chars",
  "ci-session-secret-that-is-long-enough-123456",
  "e2e-session-secret-that-is-long-enough-123456",
]);

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long");
  }
  if (KNOWN_SECRETS.has(secret) && (!isLocalAppUrl() || behindProxy())) {
    throw new Error("SESSION_SECRET is a placeholder everybody knows: put the output of `openssl rand -base64 48` in .env before serving JuLinks beyond localhost");
  }
  return new TextEncoder().encode(secret);
}

/** TRUST_PROXY set means a proxy or tunnel is in front, so "localhost" in APP_URL is not the whole story. */
function behindProxy(): boolean {
  const value = process.env.TRUST_PROXY;
  return value !== undefined && value !== "" && value !== "0" && value !== "false";
}

/** True when APP_URL points at this machine, where a known secret cannot be abused from outside. */
function isLocalAppUrl(): boolean {
  try {
    const host = new URL(process.env.APP_URL ?? "http://localhost:3000").hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

export type SessionClaims = { userId: string; version: number };

/**
 * Signs a session token: the user id and the account's session version. Bumping the
 * version (a password change) makes every older token invalid. Tokens issued before
 * the version existed carry none and count as version 0, so nobody is logged out by
 * the upgrade. Exported for tests; the app uses createSession.
 */
export async function signSessionToken(userId: string, ttlSeconds = SESSION_TTL_SECONDS, version = 0): Promise<string> {
  return new SignJWT({ sub: userId, v: version })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secretKey());
}

/** Returns the claims inside a valid, unexpired token, or null. */
export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  const key = secretKey(); // a misconfigured secret is an error, not an invalid token
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    return { userId: payload.sub, version: typeof payload.v === "number" ? payload.v : 0 };
  } catch {
    return null;
  }
}

export async function createSession(userId: string, version = 0): Promise<void> {
  const token = await signSessionToken(userId, SESSION_TTL_SECONDS, version);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export type CurrentUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string;
  avatarKey: string | null;
  avatarFocusX: number;
  avatarFocusY: number;
  themeId: string | null;
  role: Role;
};

/**
 * Data access layer entry point: reads the cookie, verifies it and loads the user.
 * Memoised per request with React.cache so pages and actions can call it freely.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  // Only approved accounts have a session; one denied after logging in, or one whose password
  // changed since the token was issued, is treated like a stale cookie.
  const user = await prisma.user.findFirst({
    where: { id: claims.userId, status: "approved", sessionVersion: claims.version },
    select: { id: true, username: true, email: true, displayName: true, bio: true, avatarKey: true, avatarFocusX: true, avatarFocusY: true, themeId: true, role: true },
  });
  return user;
});

/** The current user, or a redirect that clears a stale session cookie and lands on /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(SESSION_EXPIRED_PATH);
  return user;
}

/** The current user when they may review sign-up requests; anyone else gets a 404 so the page stays invisible. */
export async function requireReviewer(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!canReview(user.role)) notFound();
  return user;
}
