import { Suspense } from "react";
import { SetupGate } from "@/components/SetupGate";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

function LoginContent({ searchParams }: PageProps<"/login">) {
  return (
    <AuthShell title="Welcome back">
      <Suspense>
        <ExpiredNotice searchParams={searchParams} />
      </Suspense>
      {/* The form reads ?next= on the client, so it waits behind Suspense while the shell prerenders. */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

// Reads the query string behind Suspense so the rest of the page stays prerendered: ?expired=1 after a stale session, ?reset=1 after a new password, ?deleted=1 after deleting the account.
async function ExpiredNotice({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { expired, reset, deleted } = await searchParams;
  if (deleted === "1") {
    return (
      <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status" data-testid="account-deleted">
        Your account and page are deleted.
      </p>
    );
  }
  if (reset === "1") {
    return (
      <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800" role="status" data-testid="reset-done">
        Password changed. Log in with the new one.
      </p>
    );
  }
  if (expired !== "1") return null;
  return (
    <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800" role="status">
      Your session has expired. Please log in again.
    </p>
  );
}

/** Nothing public before the admin exists: see SetupGate. */
export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={null}>
      <SetupGate>
        <LoginContent {...props} />
      </SetupGate>
    </Suspense>
  );
}
