import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";

/** Bumped by hand whenever the privacy notice or the terms change; both pages show it. */
export const LEGAL_UPDATED = "31 October 2026";
export const LEGAL_UPDATED_IT = "31 ottobre 2026";

/** The frame of /privacy and /terms: the English text, then the Italian one, with a link to jump between them. */
export function LegalPage({ title, titleIt, english, italian }: { title: string; titleIt: string; english: React.ReactNode; italian: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <Logo />
        <ThemeToggle />
      </header>
      <nav className="mt-8 flex gap-3 text-sm" aria-label="Language">
        <a href="#en" className="font-medium text-brand-600 hover:underline">
          English
        </a>
        <a href="#it" className="font-medium text-brand-600 hover:underline">
          Italiano
        </a>
      </nav>
      <article id="en" lang="en" className="legal mt-6">
        <h1>{title}</h1>
        <p className="text-sm text-stone-500">Last updated {LEGAL_UPDATED}</p>
        {english}
      </article>
      <article id="it" lang="it" className="legal mt-16 border-t border-stone-200 pt-10">
        <h1>{titleIt}</h1>
        <p className="text-sm text-stone-500">Ultimo aggiornamento {LEGAL_UPDATED_IT}</p>
        {italian}
      </article>
      <LegalFooter />
    </main>
  );
}

/** Contact, privacy and terms: under the auth forms, on the landing page and on the legal pages themselves. */
export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <nav className={`flex flex-wrap justify-center gap-x-4 gap-y-1 pt-10 text-xs text-stone-500 ${className}`} aria-label="Legal">
      <Link href="/contact" className="hover:underline">
        Contact
      </Link>
      <Link href="/privacy" className="hover:underline">
        Privacy
      </Link>
      <Link href="/terms" className="hover:underline">
        Terms
      </Link>
    </nav>
  );
}
