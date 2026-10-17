"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type AuthFormState } from "@/actions/auth";
import { Field } from "@/components/Field";

const initial: AuthFormState = {};

export function SignupForm() {
  const [state, action, pending] = useActionState(signup, initial);
  const v = state.values ?? {};
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field label="Username" name="username" error={e.username} hint="Your page will be at /username">
        <div className="flex items-center">
          <span className="rounded-l-lg border border-r-0 border-stone-300 bg-stone-100 px-3 py-2 text-sm text-stone-500">
            /
          </span>
          <input
            id="username"
            name="username"
            className="input rounded-l-none"
            defaultValue={v.username}
            autoComplete="username"
            required
            minLength={3}
            maxLength={30}
          />
        </div>
      </Field>
      <Field label="Display name" name="displayName" error={e.displayName}>
        <input id="displayName" name="displayName" className="input" defaultValue={v.displayName} autoComplete="name" required />
      </Field>
      <Field label="Email" name="email" error={e.email}>
        <input id="email" name="email" type="email" className="input" defaultValue={v.email} autoComplete="email" required />
      </Field>
      <Field label="Password" name="password" error={e.password} hint="At least 8 characters">
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </Field>
      {e.form && (
        <p className="error" role="alert">
          {e.form}
        </p>
      )}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creating…" : "Create my page"}
      </button>
      <p className="text-center text-sm text-stone-500">
        Already have one?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
