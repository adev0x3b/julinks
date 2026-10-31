import { Suspense } from "react";
import { connection } from "next/server";
import { LegalPage } from "@/components/legal/LegalPage";
import { PrivacyEnglish, PrivacyItalian } from "@/components/legal/PrivacyText";
import { SetupGate } from "@/components/SetupGate";
import { siteOperator, siteProcessors } from "@/lib/config";
import { mailEnabled } from "@/lib/mail/config";

export const metadata = { title: "Privacy", description: "What JuLinks keeps about you, why, and for how long." };

// The operator, the providers and whether mail is on are read from the environment at request time, not baked in at build.
async function Privacy() {
  await connection();
  const facts = { operator: siteOperator(), processors: siteProcessors(), mail: mailEnabled() };
  return <LegalPage title="Privacy notice" titleIt="Informativa sulla privacy" english={<PrivacyEnglish {...facts} />} italian={<PrivacyItalian {...facts} />} />;
}

/** Nothing public before the admin exists: see SetupGate. */
export default function PrivacyPage() {
  return (
    <Suspense fallback={null}>
      <SetupGate>
        <Privacy />
      </SetupGate>
    </Suspense>
  );
}
