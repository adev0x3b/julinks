import type { Metadata } from "next";
import { cacheLife, cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PublicProfile } from "@/components/PublicProfile";
import { profileTag } from "@/lib/cache-tags";
import { getPublicProfile } from "@/lib/data/users";
import { getTheme } from "@/lib/themes";
import { RESERVED_USERNAMES } from "@/lib/validation";

/**
 * The profile is cached per username ("use cache") and expired by updateTag()
 * whenever the owner edits a link or their profile, so visitors never hit the
 * database for a page that has not changed. The username itself is runtime
 * data, so the read sits behind a Suspense boundary and streams into a static
 * shell. One consequence: an unknown username renders the not-found page with
 * a noindex tag, but the HTTP status stays 200 because the shell was already
 * sent (documented Next.js behaviour for streamed not-found).
 */
async function loadProfile(username: string) {
  "use cache";
  cacheTag(profileTag(username));
  cacheLife("max");
  if (RESERVED_USERNAMES.has(username)) return null;
  return getPublicProfile(username);
}

export async function generateMetadata({ params }: PageProps<"/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username.toLowerCase());
  if (!profile) return { title: "Not found" };
  return { title: `${profile.displayName} (@${profile.username})`, description: profile.bio || undefined };
}

export default function PublicPage({ params }: PageProps<"/[username]">) {
  return (
    <main className="flex flex-1">
      <Suspense fallback={<Shell />}>
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: Pick<PageProps<"/[username]">, "params">) {
  const { username } = await params;
  const profile = await loadProfile(username.toLowerCase());
  if (!profile) notFound();
  return <PublicProfile profile={profile} />;
}

/** Neutral placeholder in the default theme while the profile streams in. */
function Shell() {
  const theme = getTheme("midnight");
  return <div className="min-h-full w-full flex-1" style={{ background: theme.background }} aria-hidden />;
}
