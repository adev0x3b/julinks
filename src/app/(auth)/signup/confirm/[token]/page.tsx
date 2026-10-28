import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { SetupGate } from "@/components/SetupGate";
import { findSignupConfirmation } from "@/lib/data/signup";
import { ConfirmForm } from "./ConfirmForm";

// The token is in the address: never index it, never send it on as a referrer.
export const metadata = { title: "Confirm your email", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

/**
 * Opening the link changes nothing: the request is stored by the button. Mail scanners open
 * links on their own, and a GET that confirmed would spend the link before its owner sees it.
 */
async function ConfirmBody({ params }: Pick<PageProps<"/signup/confirm/[token]">, "params">) {
  const { token } = await params;
  const signup = await findSignupConfirmation(token);
  if (!signup) {
    return (
      <div className="flex flex-col gap-4" data-testid="confirm-invalid">
        <p className="text-sm text-stone-600">
          This link has expired or was already used. If you confirmed already, your request is waiting for an admin; otherwise sign up again.
        </p>
        <Link href="/signup" className="btn-primary text-center">
          Sign up
        </Link>
      </div>
    );
  }
  return <ConfirmForm token={token} username={signup.username} usernameTaken={signup.usernameTaken} />;
}

/** Nothing public before the admin exists: see SetupGate. */
export default function ConfirmSignupPage({ params }: PageProps<"/signup/confirm/[token]">) {
  return (
    <Suspense fallback={null}>
      <SetupGate>
        <AuthShell title="Confirm your email">
          <ConfirmBody params={params} />
        </AuthShell>
      </SetupGate>
    </Suspense>
  );
}
