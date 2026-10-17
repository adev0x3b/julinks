import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { useGalleryTheme } from "@/actions/themes";
import { Logo } from "@/components/Logo";
import { PublicProfile, sampleProfile } from "@/components/PublicProfile";
import { GALLERY_TAG } from "@/lib/cache-tags";
import { listGallery } from "@/lib/data/themes";
import { imageUrl } from "@/lib/image-url";

export const metadata = { title: "Theme gallery", description: "Themes published by JuLinks users. Pick one and make it yours." };

/** Cached until a public theme is published, edited or removed (updateTag(GALLERY_TAG)). */
async function loadGallery() {
  "use cache";
  cacheTag(GALLERY_TAG);
  cacheLife("max");
  return listGallery();
}

export default function GalleryPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 py-8">
      <header className="flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/dashboard/appearance" className="btn-primary">
            Your appearance
          </Link>
        </nav>
      </header>
      <section className="py-10">
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Theme gallery</h1>
        <p className="mt-2 max-w-xl text-stone-600">
          Looks that other people built and published. Using one copies it to your account, so you can tweak it from there.
        </p>
        <Suspense fallback={<p className="mt-10 text-sm text-stone-500">Loading themes…</p>}>
          <Gallery />
        </Suspense>
      </section>
    </main>
  );
}

async function Gallery() {
  // The list is request-time data (it changes as people publish), served from the tagged cache.
  await connection();
  const themes = await loadGallery();
  if (themes.length === 0) {
    return <p className="mt-10 text-sm text-stone-500">Nothing published yet. Be the first: Appearance → Publish.</p>;
  }
  return (
    <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="gallery">
      {themes.map((theme) => {
        const publicTheme = { name: theme.name, tokens: theme.tokens, backgroundUrl: imageUrl(theme.backgroundKey) };
        return (
          <li key={theme.id} className="card flex flex-col gap-3 p-4" data-testid="gallery-card">
            {/* A real page rendering, scaled down: the same component as /username. */}
            <div className="relative h-72 overflow-hidden rounded-xl border border-stone-200" aria-hidden>
              <div className="pointer-events-none absolute left-1/2 top-0 h-[444px] w-[320px] origin-top -translate-x-1/2 scale-[0.65]">
                <PublicProfile profile={sampleProfile(publicTheme)} preview />
              </div>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold">{theme.name}</h2>
                <p className="truncate text-xs text-stone-500">
                  by{" "}
                  <Link href={`/${theme.owner.username}`} className="hover:underline">
                    @{theme.owner.username}
                  </Link>
                </p>
              </div>
              <form action={useGalleryTheme}>
                <input type="hidden" name="themeId" value={theme.id} />
                <button type="submit" className="btn-secondary px-3 py-1.5 text-xs" aria-label={`Use ${theme.name}`}>
                  Use this theme
                </button>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
