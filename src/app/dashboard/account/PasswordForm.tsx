"use client";

import { useActionState } from "react";
import { updatePassword, type PasswordFormState } from "@/actions/account";
import { Field } from "@/components/Field";

const initial: PasswordFormState = {};

export function PasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initial);
  const e = state.errors ?? {};
  return (
    // The key resets the fields once a change went through, so the old passwords do not linger in the form.
    <form key={state.changedAt ?? 0} action={action} className="flex flex-col gap-4" noValidate>
      {state.changedAt && (
        <p className="notice-success" role="status" data-testid="password-notice">
          Password changed. Other devices have been logged out.
        </p>
      )}
      <Field label="Current password" name="currentPassword" error={e.currentPassword}>
        <input id="currentPassword" name="currentPassword" type="password" className="input" autoComplete="current-password" required />
      </Field>
      <Field label="New password" name="newPassword" error={e.newPassword} hint="At least 8 characters.">
        <input id="newPassword" name="newPassword" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Repeat new password" name="confirmPassword" error={e.confirmPassword}>
        <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" required />
      </Field>
      {e.form && (
        <p className="error" role="alert">
          {e.form}
        </p>
      )}
      <div>
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Changing…" : "Change password"}
        </button>
      </div>
    </form>
  );
}
