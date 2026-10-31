import { Suspense } from "react";
import { connection } from "next/server";
import { LegalPage } from "@/components/legal/LegalPage";
import { TermsEnglish, TermsItalian } from "@/components/legal/TermsText";
import { SetupGate } from "@/components/SetupGate";
import { siteOperator } from "@/lib/config";

export const metadata = { title: "Terms", description: "The rules for using JuLinks." };

// The operator is read from the environment at request time, not baked in at build.
async function Terms() {
  await connection();
  const facts = { operator: siteOperator() };
  return <LegalPage title="Terms of use" titleIt="Condizioni d'uso" english={<TermsEnglish {...facts} />} italian={<TermsItalian {...facts} />} />;
}

/** Nothing public before the admin exists: see SetupGate. */
export default function TermsPage() {
  return (
    <Suspense fallback={null}>
      <SetupGate>
        <Terms />
      </SetupGate>
    </Suspense>
  );
}
