import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { SetupGate } from "@/components/SetupGate";
import { CONTACT_KINDS, type ContactKind } from "@/lib/contact-kinds";
import { ContactForm } from "./ContactForm";

export const metadata = { title: "Contact" };

// ?kind=report&page=ada comes from the "Report" link on public pages; read behind Suspense so the shell prerenders.
async function PrefilledForm({ searchParams }: Pick<PageProps<"/contact">, "searchParams">) {
  const { kind, page } = await searchParams;
  const pickedKind = CONTACT_KINDS.find((k) => k === kind) as ContactKind | undefined;
  return <ContactForm kind={pickedKind} page={typeof page === "string" ? page.slice(0, 200) : undefined} />;
}

/** Nothing public before the admin exists: see SetupGate. */
export default function ContactPage({ searchParams }: PageProps<"/contact">) {
  return (
    <Suspense fallback={null}>
      <SetupGate>
        <AuthShell title="Contact the admins">
          <Suspense>
            <PrefilledForm searchParams={searchParams} />
          </Suspense>
        </AuthShell>
      </SetupGate>
    </Suspense>
  );
}
