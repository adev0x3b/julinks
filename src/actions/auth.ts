"use server";

import { redirect } from "next/navigation";
import { DENIED_MESSAGE, PENDING_MESSAGE } from "@/lib/auth-messages";
import { authenticate, createUser, UniqueViolation } from "@/lib/data/users";
import { authLimiter } from "@/lib/rate-limit";
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


function formValues(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

/**
 * Invite only: a sign-up stores a pending request and does not log the user in. The
 * exception is the first account on a fresh install, which createUser approves and
 * makes admin on the spot, so there is someone to review the requests that follow.
 */
export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = formValues(formData, ["username", "email"]);
  const limit = authLimiter.check(`signup:${await clientIp()}`);
  if (!limit.ok) {
    return { values, errors: { form: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.` } };
  }
  const parsed = signupSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) {
    return { values, errors: fieldErrors(parsed.error) };
  }
  try {
    const user = await createUser({ ...parsed.data, displayName: parsed.data.username });
    if (user.status !== "approved") return { requested: { username: user.username } };
    await createSession(user.id);
  } catch (error) {
    if (error instanceof UniqueViolation) {
      return { values, errors: { [error.field]: `That ${error.field} is already taken` } };
    }
    throw error;
  }
  redirect("/dashboard");
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = formValues(formData, ["email"]);
  // Only wrong guesses count: the limit is against brute force, not against a household sharing one address.
  const limitKey = `login:${await clientIp()}`;
  const limit = authLimiter.peek(limitKey);
  if (!limit.ok) {
    return { values, errors: { form: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.` } };
  }
  const parsed = loginSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) {
    return { values, errors: fieldErrors(parsed.error) };
  }
  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    authLimiter.check(limitKey);
    return { values, errors: { form: "Wrong email or password" } };
  }
  if (user.status === "pending") return { values, toast: { tone: "info", message: PENDING_MESSAGE, at: Date.now() } };
  if (user.status === "denied") return { values, toast: { tone: "danger", message: DENIED_MESSAGE, at: Date.now() } };
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
