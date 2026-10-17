"use server";

import { redirect } from "next/navigation";
import { authenticate, createUser, UniqueViolation } from "@/lib/data/users";
import { authLimiter } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { createSession, destroySession } from "@/lib/session";
import { fieldErrors, loginSchema, signupSchema } from "@/lib/validation";

export type AuthFormState = {
  errors?: Record<string, string>;
  values?: Record<string, string>;
};

function formValues(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(keys.map((k) => [k, String(formData.get(k) ?? "")]));
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const values = formValues(formData, ["username", "email", "displayName"]);
  const limit = authLimiter.check(`signup:${await clientIp()}`);
  if (!limit.ok) {
    return { values, errors: { form: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.` } };
  }
  const parsed = signupSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) {
    return { values, errors: fieldErrors(parsed.error) };
  }
  try {
    const user = await createUser(parsed.data);
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
  const limit = authLimiter.check(`login:${await clientIp()}`);
  if (!limit.ok) {
    return { values, errors: { form: `Too many attempts. Try again in ${limit.retryAfterSeconds} seconds.` } };
  }
  const parsed = loginSchema.safeParse({ ...values, password: formData.get("password") });
  if (!parsed.success) {
    return { values, errors: fieldErrors(parsed.error) };
  }
  const user = await authenticate(parsed.data.email, parsed.data.password);
  if (!user) {
    return { values, errors: { form: "Wrong email or password" } };
  }
  await createSession(user.id);
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/");
}
