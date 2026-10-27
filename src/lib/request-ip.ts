import { headers } from "next/headers";

/**
 * Best-effort client IP for the per-IP rate limits.
 *
 * Headers come from whoever connected: without a reverse proxy in front, a client can
 * send any `x-forwarded-for` it likes, so these limits only ever raise the cost of an
 * attack. The limits that matter (wrong guesses per account, pending sign-ups) are keyed
 * on something the client cannot choose.
 *
 * Behind a reverse proxy that appends the real address (nginx `proxy_add_x_forwarded_for`,
 * Caddy, Traefik), set TRUST_PROXY=1: the last entry is then the proxy's own observation
 * and cannot be forged by the client.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h
    .get("x-forwarded-for")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (forwarded?.length) return process.env.TRUST_PROXY === "1" ? forwarded[forwarded.length - 1] : forwarded[0];
  return h.get("x-real-ip") ?? "unknown";
}
