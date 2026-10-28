import { connection } from "next/server";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { SetupGate } from "@/components/SetupGate";
import { RESET_LINK_MINUTES } from "@/lib/data/password-reset";
import { mailEnabled } from "@/lib/mail/config";
import { ForgotForm } from "./ForgotForm";

export const metadata = { title: "Forgot password" };

// Mail settings are read at request time, not baked into the prerendered page.
async function ForgotBody() {
  await connection();
  if (!mailEnabled()) {
    return (
      <p className="text-sm text-stone-600" data-testid="reset-off">
        This site does not send mail, so passwords cannot be reset from here. Ask an admin to set a new one for you.
      </p>
    );
  }
  return <ForgotForm minutes={RESET_LINK_MINUTES} />;
}

/** Nothing public before the admin exists: see SetupGate. */
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetupGate>
        <AuthShell title="Forgot your password?">
          <ForgotBody />
        </AuthShell>
      </SetupGate>
    </Suspense>
  );
}
