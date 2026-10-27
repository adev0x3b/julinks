"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { login, type AuthFormState } from "@/actions/auth";
import { Field } from "@/components/Field";
import { Toast } from "@/components/Toast";

const initial: AuthFormState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);
  // Pages that need a login (the gallery's "Use this theme") say where to come back to.
  const next = useSearchParams().get("next");
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      {/* Keyed by the attempt so a second refusal shows the toast again, even with the same text. */}
      {state.toast && <Toast key={state.toast.at} tone={state.toast.tone} message={state.toast.message} />}
      <Field label="Email" name="email" error={e.email}>
        <input id="email" name="email" type="email" className="input" defaultValue={v.email} autoComplete="email" required />
      </Field>
      <Field label="Password" name="password" error={e.password}>
        <input id="password" name="password" type="password" className="input" autoComplete="current-password" required />
      </Field>
      {e.form && (
        <p className="error" role="alert">
          {e.form}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
      <p className="text-center text-sm text-stone-500">
        New here?{" "}
        <Link href="/signup" className="font-medium text-brand-600 hover:underline">
          Request a page
        </Link>
      </p>
    </form>
  );
}
