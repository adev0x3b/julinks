"use client";

import { useActionState } from "react";
import { chooseNewPassword, type ResetFormState } from "@/actions/password-reset";
import { Field } from "@/components/Field";

const initial: ResetFormState = {};

export function ResetForm({ token, username }: { token: string; username: string }) {
  const [state, action, pending] = useActionState(chooseNewPassword, initial);
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {/* Lets a password manager file the new password under the right account. */}
      <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />
      <p className="text-sm text-stone-500">
        For <strong>/{username}</strong>. Every device that is logged in will be logged out.
      </p>
      <Field label="New password" name="password" error={e.password} hint="At least 8 characters">
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" required />
      </Field>
      <Field label="New password again" name="confirmPassword" error={e.confirmPassword}>
        <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" required />
      </Field>
      {e.form && (
        <p className="error" role="alert">
          {e.form}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Saving…" : "Save the new password"}
      </button>
    </form>
  );
}
