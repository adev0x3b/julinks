import { headers } from "next/headers";

/**
 * Best-effort client IP for the per-IP rate limits.
 *
 * Headers come from whoever connected: without a reverse proxy in front, a client can
 * send any `x-forwarded-for` it likes, so these limits only ever raise the cost of an
 * attack. The limits that matter (wrong guesses per account, pending sign-ups) are keyed
 * on something the client cannot choose.
 *
 * TRUST_PROXY says which header to believe, and is only safe when nothing but that proxy
 * can reach the app:
 * - `1`: a reverse proxy that appends the real address to `x-forwarded-for` (nginx with
 *   `proxy_add_x_forwarded_for`, Caddy, Traefik); the last entry is the proxy's own observation.
 * - `cloudflare`: a Cloudflare Tunnel or proxied DNS record; Cloudflare sets `cf-connecting-ip`.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const trust = process.env.TRUST_PROXY;
  if (trust === "cloudflare") {
    const cf = h.get("cf-connecting-ip")?.trim();
    if (cf) return cf;
  }
  const forwarded = h
    .get("x-forwarded-for")
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (forwarded?.length) return trust === "1" || trust === "cloudflare" ? forwarded[forwarded.length - 1] : forwarded[0];
  return h.get("x-real-ip") ?? "unknown";
}
