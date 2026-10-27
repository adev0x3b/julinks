"use server";

import { changePassword, WrongPassword } from "@/lib/data/users";
import { createSession, requireUser } from "@/lib/session";
import { fieldErrors, passwordChangeSchema } from "@/lib/validation";

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
  try {
    const version = await changePassword(user.id, parsed.data.currentPassword, parsed.data.newPassword);
    await createSession(user.id, version);
  } catch (error) {
    if (error instanceof WrongPassword) return { errors: { currentPassword: error.message } };
    throw error;
  }
  return { changedAt: Date.now() };
}
