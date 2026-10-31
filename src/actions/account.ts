"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { GALLERY_TAG, profileTag } from "@/lib/cache-tags";
import { deleteAccount, DemoAccount, LastAdmin } from "@/lib/data/accounts";
import { changePassword, WrongPassword } from "@/lib/data/users";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { accountLimiter, retryLater } from "@/lib/rate-limit";
import { createSession, destroySession, requireUser } from "@/lib/session";
import { deleteAccountSchema, fieldErrors, passwordChangeSchema } from "@/lib/validation";

export type PasswordFormState = {
  errors?: Record<string, string>;
  /** Set once the password was replaced; keyed by time so a second change shows the notice again. */
  changedAt?: number;
};

/** Replaces the password and re-issues this device's cookie; every other device is logged out. */
export async function updatePassword(_prev: PasswordFormState, formData: FormData): Promise<PasswordFormState> {
  const user = await requireUser();
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  // A wrong current password spends the login form's per-account budget, so a left-open session cannot be used to guess it.
  const accountKey = `login:${user.email}`;
  const limit = accountLimiter.peek(accountKey);
  if (!limit.ok) return { errors: { form: retryLater("attempts", limit) } };
  try {
    const version = await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
    await createSession(user.id, version);
  } catch (error) {
    if (error instanceof WrongPassword) {
      accountLimiter.check(accountKey);
      return { errors: { currentPassword: error.message } };
    }
    throw error;
  }
  return { changedAt: Date.now() };
}

export type DeleteAccountState = { errors?: Record<string, string> };

/**
 * Deletes the signed-in account and everything it owns, after the password is typed again.
 * Wrong passwords spend the same per-account budget as the login form.
 */
export async function deleteMyAccount(_prev: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const user = await requireUser();
  const parsed = deleteAccountSchema.safeParse({ password: formData.get("password"), confirm: formData.get("confirm") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const accountKey = `login:${user.email}`;
  const limit = accountLimiter.peek(accountKey);
  if (!limit.ok) return { errors: { form: retryLater("attempts", limit) } };
  const { passwordHash } = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(parsed.data.password, passwordHash))) {
    accountLimiter.check(accountKey);
    return { errors: { password: "Wrong password" } };
  }
  try {
    const deleted = await deleteAccount(user.id);
    updateTag(profileTag(deleted.username));
    if (deleted.hadPublicTheme) updateTag(GALLERY_TAG);
  } catch (error) {
    if (error instanceof LastAdmin || error instanceof DemoAccount) return { errors: { form: error.message } };
    throw error;
  }
  await destroySession();
  redirect("/login?deleted=1");
}
