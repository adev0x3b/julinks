import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Lands here when a request carried a session cookie that no longer maps to a
 * user (the token expired, or the database was reset while the browser kept
 * the cookie). Clears the cookie, then shows the login page with a notice.
 * Without this step the proxy would send the cookie-carrying request for
 * /login straight back to /dashboard, and the two would loop forever.
 */
export function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "?expired=1";
  const response = NextResponse.redirect(url, 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
