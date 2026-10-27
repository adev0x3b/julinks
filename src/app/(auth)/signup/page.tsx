import { Suspense } from "react";
import { SetupGate } from "@/components/SetupGate";
import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Sign up" };

function SignupContent() {
  return (
    <AuthShell title="Request your page">
      <SignupForm />
    </AuthShell>
  );
}

/** Nothing public before the admin exists: see SetupGate. */
export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SetupGate>
        <SignupContent />
      </SetupGate>
    </Suspense>
  );
}
