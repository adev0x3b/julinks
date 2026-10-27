import { NextResponse } from "next/server";
import { completeSetup, NoSetupCode, SetupDone, WrongSetupCode } from "@/lib/data/setup";
import { UniqueViolation } from "@/lib/data/users";
import { authLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { createSession } from "@/lib/session";
import { fieldErrors, setupSchema } from "@/lib/validation";

/**
 * Receives the /setup form. Plain form POST rather than a server action so the page works
 * without JavaScript and from curl (the compose smoke test). Every outcome is a redirect:
 * back to /setup with ?error= (and the typed username and email, never the password), or
 * on to the dashboard, logged in as the new admin.
 */
export async function POST(request: Request) {
  // A browser sends Origin on a cross-site form POST; refuse one from another site. curl sends none.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  const form = await request.formData();
  const typed = { username: String(form.get("username") ?? ""), email: String(form.get("email") ?? "") };
  const back = (error: string) => {
    const query = new URLSearchParams({ error });
    if (typed.username) query.set("username", typed.username);
    if (typed.email) query.set("email", typed.email);
    return seeOther(`/setup?${query}`);
  };

  if (!authLimiter.check(`setup:${await clientIp()}`).ok) return back("limit");
  const parsed = setupSchema.safeParse({
    code: form.get("code"),
    username: form.get("username"),
    email: form.get("email"),
    password: form.get("password"),
    confirmPassword: form.get("confirmPassword"),
  });
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error);
    const field = ["code", "username", "email", "password", "confirmPassword"].find((f) => errors[f]);
    return back(field === "confirmPassword" ? "confirm" : (field ?? "form"));
  }
  const { code, username, email, password } = parsed.data;
  try {
    const user = await completeSetup(code, { username, email, password, displayName: username });
    await createSession(user.id);
  } catch (error) {
    if (error instanceof SetupDone) return seeOther("/setup");
    if (error instanceof NoSetupCode) return back("none");
    if (error instanceof WrongSetupCode) return back(error.attemptsLeft > 0 ? "code" : "locked");
    if (error instanceof UniqueViolation) return back(error.field);
    throw error;
  }
  return seeOther("/dashboard");
}

/** A relative Location: the browser keeps whatever host and scheme it used, which a tunnel or proxy may have rewritten. */
function seeOther(path: string) {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}
