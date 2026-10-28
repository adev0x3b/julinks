import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { SetupGate } from "@/components/SetupGate";
import { findResetLink } from "@/lib/data/password-reset";
import { ResetForm } from "./ResetForm";

// The token is in the address: never index it, never send it on as a referrer.
export const metadata = { title: "Choose a new password", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

async function ResetBody({ params }: Pick<PageProps<"/reset-password/[token]">, "params">) {
  const { token } = await params;
  const link = await findResetLink(token);
  if (!link) {
    return (
      <div className="flex flex-col gap-4" data-testid="reset-invalid">
        <p className="text-sm text-stone-600">This link has expired or was already used. Ask for a new one, it only takes a moment.</p>
        <Link href="/forgot-password" className="btn-primary text-center">
          Send a new link
        </Link>
      </div>
    );
  }
  return <ResetForm token={token} username={link.username} />;
}

/** Nothing public before the admin exists: see SetupGate. */
export default function ResetPasswordPage({ params }: PageProps<"/reset-password/[token]">) {
  return (
    <Suspense fallback={null}>
      <SetupGate>
        <AuthShell title="Choose a new password">
          <ResetBody params={params} />
        </AuthShell>
      </SetupGate>
    </Suspense>
  );
}
