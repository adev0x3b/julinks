import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { canReview, type Role } from "@/lib/roles";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export { SESSION_COOKIE };
/**
 * Where a request with a cookie that no longer maps to a user is sent. The route
 * clears the cookie before showing /login; sending such a request straight to
 * /login would loop, because the proxy bounces any cookie-carrying request for
 * /login back to /dashboard.
 */
export const SESSION_EXPIRED_PATH = "/login/expired";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters long");
  }
  return new TextEncoder().encode(secret);
}

/** Signs a session token for a user id. Exported for tests; the app uses createSession. */
export async function signSessionToken(userId: string, ttlSeconds = SESSION_TTL_SECONDS): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secretKey());
}

/** Returns the user id inside a valid, unexpired token, or null. */
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<void> {
  const token = await signSessionToken(userId);
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
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  // Only approved accounts have a session; one denied after logging in is treated like a stale cookie.
  const user = await prisma.user.findFirst({
    where: { id: userId, status: "approved" },
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
