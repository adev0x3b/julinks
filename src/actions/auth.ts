"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { DENIED_MESSAGE, PENDING_MESSAGE } from "@/lib/auth-messages";
import { authenticate, createUser, RequestsFull, UniqueViolation } from "@/lib/data/users";
import { demoLoginAllowed } from "@/lib/config";
import { isSetupPending } from "@/lib/data/setup";
import { drainOutbox, queueAdminNotice } from "@/lib/mail/outbox";
import { accountLimiter, authLimiter, retryLater } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { createSession, destroySession } from "@/lib/session";
import { fieldErrors, loginSchema, signupSchema } from "@/lib/validation";

export type AuthFormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
  /** Set once a sign-up request has been stored: the form swaps for a confirmation. */
  requested?: { username: string };
  /** Login refused because of the account's status: shown as a toast. `at` keys the toast per attempt. */
  toast?: { tone: "info" | "danger"; message: string; at: number };
};

const SETUP_FIRST = "This site is not set up yet: complete /setup first";

function formValues(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

/**
 * Invite only: a sign-up stores a pending request and does not log the user in. The admin
 * who reviews requests was created at /setup, so there is always someone to do it.
 */
export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = formValues(formData, ["username", "email"]);
  // The pages redirect to /setup while it is pending; the actions refuse too, for a request posted straight at them.
  if (await isSetupPending()) return { values, errors: { form: SETUP_FIRST } };
  const limit = authLimiter.check(`signup:${await clientIp()}`);
  if (!limit.ok) {
    return { values, errors: { form: retryLater("attempts", limit) } };
  }
  const parsed = signupSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) {
    return { values, errors: fieldErrors(parsed.error) };
  }
  try {
    const user = await createUser({ ...parsed.data, displayName: parsed.data.username });
    // The admins hear about it by mail, after the response: one notice waits at a time, half an hour apart.
    after(async () => {
      await queueAdminNotice();
      await drainOutbox();
    });
    return { requested: { username: user.username } };
  } catch (error) {
    if (error instanceof UniqueViolation) {
      return { values, errors: { [error.field]: `That ${error.field} is already taken` } };
    }
    if (error instanceof RequestsFull) return { values, errors: { form: error.message } };
    throw error;
  }
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = formValues(formData, ["email"]);
  if (await isSetupPending()) return { values, errors: { form: SETUP_FIRST } };
  // Only wrong guesses count: the limit is against brute force, not against a household sharing one address.
  const ipKey = `login:${await clientIp()}`;
  const ipLimit = authLimiter.peek(ipKey);
  if (!ipLimit.ok) {
    return { values, errors: { form: retryLater("attempts", ipLimit) } };
  }
  const parsed = loginSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) {
    return { values, errors: fieldErrors(parsed.error) };
  }
  // The second budget is per account, so spreading guesses over many addresses does not help.
  const accountKey = `login:${parsed.data.email}`;
  const accountLimit = accountLimiter.peek(accountKey);
  if (!accountLimit.ok) {
    return { values, errors: { form: retryLater("attempts", accountLimit) } };
  }
  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    authLimiter.check(ipKey);
    accountLimiter.check(accountKey);
    return { values, errors: { form: "Wrong email or password" } };
  }
  if (user.status === "pending") return { values, toast: { tone: "info", message: PENDING_MESSAGE, at: Date.now() } };
  if (user.status === "denied") return { values, toast: { tone: "danger", message: DENIED_MESSAGE, at: Date.now() } };
  if (user.isDemo && !demoLoginAllowed()) {
    return { values, errors: { form: "Demo accounts cannot log in on this site" } };
  }
  await createSession(user.id, user.sessionVersion);
  redirect(returnPath(formData.get("next")));
}

/** Where to go after logging in: a path on this site, never another host. */
function returnPath(next: FormDataEntryValue | null): string {
  const path = typeof next === "string" ? next : "";
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/\\") ? path : "/dashboard";
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
