"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPassword, type ForgotFormState } from "@/actions/password-reset";
import { Field } from "@/components/Field";

const initial: ForgotFormState = {};

export function ForgotForm({ minutes }: { minutes: number }) {
  const [state, action, pending] = useActionState(forgotPassword, initial);
  const e = state.errors ?? {};
  if (state.sent) {
    return (
      <div className="flex flex-col gap-4" role="status" data-testid="reset-sent">
        <p className="text-sm text-stone-600">
          If <strong className="break-all">{state.values?.email ?? "that address"}</strong> belongs to an account, a link to choose a new password is
          on its way. It works for {minutes} minutes. Have a look in the spam folder too.
        </p>
        <Link href="/login" className="btn-secondary text-center">
          Back to log in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-stone-500">Enter the email you log in with and we will send you a link to choose a new password.</p>
      <Field label="Email" name="email" error={e.email}>
        <input id="email" name="email" type="email" className="input" defaultValue={state.values?.email} autoComplete="email" required />
      </Field>
      {e.form && (
        <p className="error" role="alert">
          {e.form}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Sending…" : "Send the link"}
      </button>
      <p className="text-center text-sm text-stone-500">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
