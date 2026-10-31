/**
 * Where a click came from, as the Stats page shows it: a site name such as instagram.com, never a
 * full address, so nothing personal is kept.
 *
 * A tap on a profile link comes from the profile page itself, so the browser's Referer on /l/:id is
 * this site. The page therefore passes along the site the visitor arrived from (?from=, set by
 * ReferrerTagger); the Referer header still counts when someone shares a /l/ link elsewhere directly.
 */

/** Lower-case host names and an optional port; anything else (paths, spaces, markup) is not a source. */
const HOST = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*(?::\d{1,5})?$/;
/** Mobile sites and link redirectors (l.instagram.com, lm.facebook.com) count as the site itself. */
const PREFIX = /^(?:www|m|l|lm|mobile)\./;

/** A host as stats list it, or null when the value is not a host name. */
export function sourceName(host: string | null | undefined): string | null {
  if (!host) return null;
  const name = host.trim().toLowerCase();
  if (name.length > 253 || !HOST.test(name)) return null;
  const bare = name.replace(PREFIX, "");
  // "m.example" stays as it is: without the prefix there is no site name left.
  return bare.includes(".") ? bare : name;
}

/** Keeps only the host of a referrer address. */
export function referrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return sourceName(new URL(referrer).host);
  } catch {
    return null;
  }
}

/**
 * The source of one click: the ?from= the page passed along, else the Referer's host. This site
 * itself is never a source (a visitor who typed the page's address in is "direct").
 */
export function clickSource({ from, referer, ownHosts }: { from: string | null; referer: string | null; ownHosts: (string | null)[] }): string | null {
  const own = new Set(ownHosts.map(sourceName).filter(Boolean));
  for (const candidate of [sourceName(from), referrerHost(referer)]) {
    if (candidate && !own.has(candidate)) return candidate;
  }
  return null;
}
