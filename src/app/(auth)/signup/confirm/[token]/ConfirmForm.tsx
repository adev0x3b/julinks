"use client";

import Link from "next/link";
import { useActionState } from "react";
import { confirmEmail, type ConfirmFormState } from "@/actions/signup";
import { Field } from "@/components/Field";

const initial: ConfirmFormState = {};

export function ConfirmForm({ token, username, usernameTaken }: { token: string; username: string; usernameTaken: boolean }) {
  const [state, action, pending] = useActionState(confirmEmail, initial);
  const e = state.errors ?? {};
  if (state.confirmed) {
    return (
      <div className="flex flex-col gap-4" data-testid="confirm-done">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          Email confirmed. Your request for <strong className="whitespace-nowrap">/{state.confirmed.username}</strong> is now waiting for an admin.
        </p>
        <p className="text-sm text-stone-600">You will get a mail when it is decided. Once approved, log in with your email and password.</p>
        <Link href="/login" className="btn-primary text-center">
          Go to login
        </Link>
      </div>
    );
  }
  // A name taken since the sign-up (or refused just now) is asked for again; otherwise the button is all there is.
  const askName = usernameTaken || state.username !== undefined;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      {askName ? (
        <>
          <p className="text-sm text-stone-600">
            Someone took <strong>/{username}</strong> while your email was on its way. Pick another name for your page.
          </p>
          <Field label="Username" name="username" error={e.username} hint="Your page will be at /username">
            <input id="username" name="username" className="input" defaultValue={state.username || username} autoComplete="username" required />
          </Field>
        </>
      ) : (
        <p className="text-sm text-stone-600">
          Confirm your email to send the request for <strong>/{username}</strong> to the admins.
        </p>
      )}
      {e.form && (
        <p className="error" role="alert">
          {e.form}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Confirming…" : "Confirm my email"}
      </button>
    </form>
  );
}
