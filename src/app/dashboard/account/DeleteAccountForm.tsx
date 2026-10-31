"use client";

import { useActionState } from "react";
import { deleteMyAccount, type DeleteAccountState } from "@/actions/account";
import { Field } from "@/components/Field";

const initial: DeleteAccountState = {};

/** The password and a tick box, so a stray click or a borrowed laptop cannot wipe the account. */
export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteMyAccount, initial);
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Password" name="delete-password" error={e.password}>
        <input id="delete-password" name="password" type="password" className="input" autoComplete="current-password" required />
      </Field>
      <div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="confirm" className="mt-0.5" required />
          <span>I understand my page, links, pictures and themes will be deleted for good.</span>
        </label>
        {e.confirm && (
          <p className="error" role="alert">
            {e.confirm}
          </p>
        )}
      </div>
      {e.form && (
        <p className="error" role="alert">
          {e.form}
        </p>
      )}
      <button type="submit" className="btn-secondary self-start border-red-300 text-red-700 hover:bg-red-50" disabled={pending}>
        {pending ? "Deleting…" : "Delete my account"}
      </button>
    </form>
  );
}
