import { after, NextResponse } from "next/server";
import { findRedirectTarget, recordClick } from "@/lib/data/clicks";
import { clickLimiter } from "@/lib/rate-limit";
import { referrerHost } from "@/lib/referrer";
import { clientIp } from "@/lib/request-ip";

/**
 * GET /l/:id -> 302 to the link's URL. The click is recorded after the
 * response is sent (after()), so a slow insert never delays the redirect.
 */
export async function GET(request: Request, ctx: RouteContext<"/l/[id]">) {
  const limit = clickLimiter.check(await clientIp());
  if (!limit.ok) {
    return new NextResponse("Too many requests", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });
  }
  const { id } = await ctx.params;
  const link = await findRedirectTarget(id);
  if (!link) {
    return new NextResponse("Not found", { status: 404 });
  }
  const referrer = request.headers.get("referer");
  after(() => recordClick(link.id, referrerHost(referrer)));
  return NextResponse.redirect(link.url, { status: 302, headers: { "Cache-Control": "no-store" } });
}
