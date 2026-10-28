"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { isSetupPending } from "@/lib/data/setup";
import { InvalidResetLink, requestPasswordReset, resetPassword } from "@/lib/data/password-reset";
import { drainOutbox } from "@/lib/mail/outbox";
import { resetLimiter, retryLater } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request-ip";
import { destroySession } from "@/lib/session";
import { fieldErrors, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation";

export type ForgotFormState = { errors?: Record<string, string>; values?: Record<string, string>; sent?: boolean };
export type ResetFormState = { errors?: Record<string, string> };

/**
 * "Forgot password": always answers "a link is on its way" for a valid address. Whether an
 * account exists, and whether a limit held the mail back, is decided after the response, so
 * neither the answer nor its timing says anything about the address.
 */
export async function forgotPassword(_prev: ForgotFormState, formData: FormData): Promise<ForgotFormState> {
  const values = { email: String(formData.get("email") ?? "") };
  if (await isSetupPending()) return { values, errors: { form: "This site is not set up yet" } };
  const limit = resetLimiter.check(`forgot:${await clientIp()}`);
  if (!limit.ok) return { values, errors: { form: retryLater("requests", limit) } };
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { values, errors: fieldErrors(parsed.error) };
  after(async () => {
    const outcome = await requestPasswordReset(parsed.data.email);
    if (outcome === "queued") await drainOutbox();
    else if (outcome !== "unknown") console.info(`[mail] reset link not sent: ${outcome}`);
  });
  return { values: { email: parsed.data.email }, sent: true };
}

/** Sets the new password from a reset link, then sends the person to log in with it. */
export async function chooseNewPassword(_prev: ResetFormState, formData: FormData): Promise<ResetFormState> {
  const ipKey = `reset:${await clientIp()}`;
  // Only wrong links count, like failed logins: links are unguessable, this just keeps scanners out.
  const limit = resetLimiter.peek(ipKey);
  if (!limit.ok) return { errors: { form: retryLater("attempts", limit) } };
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password"), confirmPassword: formData.get("confirmPassword") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  try {
    await resetPassword(String(formData.get("token") ?? ""), parsed.data.password);
  } catch (error) {
    if (error instanceof InvalidResetLink) {
      resetLimiter.check(ipKey);
      return { errors: { form: error.message } };
    }
    throw error;
  }
  // A cookie from before is no good any more; dropping it here lands on the login page, not on "session expired".
  await destroySession();
  redirect("/login?reset=1");
}
