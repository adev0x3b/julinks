import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Field } from "@/components/Field";
import { isSetupPending } from "@/lib/data/setup";
import { MAX_SETUP_ATTEMPTS, REGENERATE_COMMAND } from "@/lib/setup-code";

export const metadata = { title: "Set up" };

/**
 * First run: the code printed by the migrate step plus the admin account to create.
 * A plain HTML form posting to a route handler, not a server action: it works before any
 * JavaScript has loaded and from curl, which is how the compose smoke test completes setup.
 */
export default function SetupPage({ searchParams }: PageProps<"/setup">) {
  return (
    <AuthShell title="Set up JuLinks">
      <Suspense fallback={null}>
        <SetupContent searchParams={searchParams} />
      </Suspense>
    </AuthShell>
  );
}

/** Errors come back as query parameters; the password never does. `regenerate` appends the command that makes a new code. */
const ERRORS: Record<string, { field?: string; message: string; regenerate?: boolean }> = {
  code: { field: "code", message: "Wrong code." },
  locked: { message: `Wrong code ${MAX_SETUP_ATTEMPTS} times: this one is burnt. Generate a new one with`, regenerate: true },
  none: { message: "No setup code is active. Generate one with", regenerate: true },
  username: { field: "username", message: "That username is taken or not allowed (3 to 30 letters, digits, - or _)." },
  email: { field: "email", message: "Enter a valid email that is not in use." },
  password: { field: "password", message: "At least 8 characters." },
  confirm: { field: "confirmPassword", message: "Passwords do not match." },
  limit: { message: "Too many attempts from this address. Try again in a few minutes." },
  form: { message: "Something was missing. Check every field." },
};

async function SetupContent({ searchParams }: Pick<PageProps<"/setup">, "searchParams">) {
  if (!(await isSetupPending())) {
    return (
      <div className="flex flex-col gap-4" data-testid="setup-done">
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          This site is already set up.
        </p>
        <Link href="/login" className="btn-primary text-center">
          Log in
        </Link>
      </div>
    );
  }
  const params = await searchParams;
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;
  const values = { username: str(params.username), email: str(params.email) };
  const fieldError = (name: string) => (error?.field === name ? error.message : undefined);
  return (
    <form method="post" action="/setup/submit" className="flex flex-col gap-4" noValidate>
      <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">
        This JuLinks has no admin yet. Enter the setup code that <code>docker compose up</code> printed and create the
        account that will approve sign-ups.
      </p>
      {error && !error.field && (
        <p className="error break-words" role="alert" data-testid="setup-error">
          {error.message}
          {error.regenerate && (
            <>
              {" "}
              <code className="rounded bg-stone-100 px-1 py-0.5 text-xs text-stone-700">{REGENERATE_COMMAND}</code>
            </>
          )}
        </p>
      )}
      <Field label="Setup code" name="code" error={fieldError("code")} hint="Like ABCD-EFGH-JKLM; case and dashes do not matter">
        <input id="code" name="code" className="input font-mono uppercase" autoComplete="off" autoFocus required />
      </Field>
      <Field label="Username" name="username" error={fieldError("username")} hint="Your page will be at /username">
        <div className="flex items-center">
          <span className="rounded-l-lg border border-r-0 border-stone-300 bg-stone-100 px-3 py-2 text-sm text-stone-500">/</span>
          <input id="username" name="username" className="input rounded-l-none" defaultValue={values.username} autoComplete="username" required minLength={3} maxLength={30} />
        </div>
      </Field>
      <Field label="Email" name="email" error={fieldError("email")}>
        <input id="email" name="email" type="email" className="input" defaultValue={values.email} autoComplete="email" required />
      </Field>
      <Field label="Password" name="password" error={fieldError("password")} hint="At least 8 characters">
        <input id="password" name="password" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </Field>
      <Field label="Confirm password" name="confirmPassword" error={fieldError("confirmPassword")}>
        <input id="confirmPassword" name="confirmPassword" type="password" className="input" autoComplete="new-password" required minLength={8} />
      </Field>
      <button type="submit" className="btn-primary">
        Create the admin account
      </button>
    </form>
  );
}

function str(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.slice(0, 254) : "";
}
