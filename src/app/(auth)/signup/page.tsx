import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Sign up" };

export default function SignupPage() {
  return (
    <AuthShell title="Claim your page">
      <SignupForm />
    </AuthShell>
  );
}
