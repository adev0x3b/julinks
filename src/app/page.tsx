import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PhoneFrame } from "@/components/PhoneFrame";
import { CENTRE, PublicProfile, type PublicProfileData } from "@/components/PublicProfile";
import { DEFAULT_PRESET } from "@/lib/themes";

const demo: PublicProfileData = {
  username: "ada",
  displayName: "Ada Lovelace",
  bio: "Analyst, metaphysician, and founder of scientific computing.",
  avatarUrl: null,
  avatarFocus: CENTRE,
  theme: { name: DEFAULT_PRESET.name, tokens: DEFAULT_PRESET.tokens, backgroundUrl: null },
  socials: [
    { platform: "github", url: "#" },
    { platform: "email", url: "#" },
  ],
  folders: [],
  links: [
    { id: "1", title: "Notes on the Analytical Engine", url: "https://example.com/notes" },
    { id: "2", title: "Poetical science", url: "https://example.com/poetry" },
    { id: "3", title: "Letters to Babbage", url: "https://example.com/letters" },
  ].map((l) => ({ ...l, thumbnailUrl: null, imageLayout: "thumbnail" as const, imageFocus: CENTRE, folderId: null })),
};

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/themes" className="btn-ghost">
            Themes
          </Link>
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Request a page
          </Link>
        </nav>
      </header>

      <section className="grid flex-1 items-center gap-12 py-16 md:grid-cols-2">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 md:text-5xl">
            One link for everything you do.
          </h1>
          <p className="mt-4 max-w-md text-lg text-stone-600">
            Ask for a username, add your links, pick a theme. Share one page everywhere and see which links people
            actually click. Invite only: an admin approves each request.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/signup" className="btn-primary">
              Request your page
            </Link>
            <Link href="/ada" className="btn-secondary">
              See an example
            </Link>
          </div>
          <ul className="mt-10 grid gap-3 text-sm text-stone-600 sm:grid-cols-3">
            <li className="card p-4">
              <strong className="block text-stone-900">Drag to reorder</strong>
              Arrange links in seconds, with a live preview.
            </li>
            <li className="card p-4">
              <strong className="block text-stone-900">Your own look</strong>
              Start from a preset, tune every colour, add a photo and a background. Publish it for others.
            </li>
            <li className="card p-4">
              <strong className="block text-stone-900">Click stats</strong>
              Daily clicks and top referrers per link.
            </li>
          </ul>
        </div>
        <div className="mx-auto w-full max-w-sm">
          <PhoneFrame>
            <PublicProfile profile={demo} preview />
          </PhoneFrame>
        </div>
      </section>
      <footer className="pt-6 text-center text-xs text-stone-400">
        JuLinks is a portfolio project. Source on{" "}
        <a className="underline" href="https://github.com/adev0x3b/julinks">
          GitHub
        </a>
        .
      </footer>
    </main>
  );
}
