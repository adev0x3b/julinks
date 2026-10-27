import {
  siBluesky,
  siBuymeacoffee,
  siDiscord,
  siFacebook,
  siGithub,
  siInstagram,
  siKofi,
  siMastodon,
  siMedium,
  siPatreon,
  siPinterest,
  siSnapchat,
  siSpotify,
  siSubstack,
  siTelegram,
  siThreads,
  siTiktok,
  siTwitch,
  siWhatsapp,
  siX,
  siYoutube,
} from "simple-icons";

/**
 * The platforms a page can link to from the icon row under the bio. Each one
 * knows how to turn what the owner typed (a handle, a number, an address or a
 * full URL) into the URL the icon opens, and carries its icon as an SVG path
 * (brand icons from simple-icons, CC0; the generic ones drawn here).
 *
 * Pure data and functions: used by the validation schema on the server and
 * by the editor and the public page alike.
 */
export type SocialPlatform = {
  label: string;
  /** Shown in the editor's input. */
  placeholder: string;
  /** 24x24 viewBox path, filled with currentColor. */
  path: string;
  /** Builds the URL from the owner's input, or null when the input makes no sense for the platform. */
  toUrl: (value: string) => string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HANDLE_PATTERN = /^[a-z0-9_.-]{1,64}$/i;

/** A plain `https://host/path` link when the input is already one (scheme optional), else null. */
function asWebUrl(value: string): string | null {
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Handle-style platforms: "@name" or "name" is appended to the base (with a slash unless the base ends in "@"); a full URL is kept as is. */
function handleOrUrl(base: string): (value: string) => string | null {
  const join = base.endsWith("@") ? "" : "/";
  return (value) => {
    const handle = value.replace(/^@/, "");
    if (HANDLE_PATTERN.test(handle)) return `${base}${join}${handle}`;
    return value.includes("/") || value.includes(".") ? asWebUrl(value) : null;
  };
}

const EMAIL_PATH =
  "M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 2v.511l-8 5.333-8-5.333V6h16zM4 18V8.914l8 5.333 8-5.333V18H4z";
const GLOBE_PATH =
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.93 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14A8 8 0 0 1 4 12c0-.69.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A8 8 0 0 1 5.08 16zm2.95-8H5.08a8 8 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z";
const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";

export const SOCIAL_PLATFORMS = {
  instagram: { label: "Instagram", placeholder: "@username", path: siInstagram.path, toUrl: handleOrUrl("https://instagram.com") },
  tiktok: { label: "TikTok", placeholder: "@username", path: siTiktok.path, toUrl: handleOrUrl("https://www.tiktok.com/@") },
  x: { label: "X", placeholder: "@username", path: siX.path, toUrl: handleOrUrl("https://x.com") },
  threads: { label: "Threads", placeholder: "@username", path: siThreads.path, toUrl: handleOrUrl("https://www.threads.net/@") },
  bluesky: { label: "Bluesky", placeholder: "name.bsky.social", path: siBluesky.path, toUrl: bluesky },
  mastodon: { label: "Mastodon", placeholder: "@name@mastodon.social", path: siMastodon.path, toUrl: mastodon },
  youtube: { label: "YouTube", placeholder: "@channel", path: siYoutube.path, toUrl: handleOrUrl("https://www.youtube.com/@") },
  twitch: { label: "Twitch", placeholder: "channel", path: siTwitch.path, toUrl: handleOrUrl("https://www.twitch.tv") },
  facebook: { label: "Facebook", placeholder: "page name or URL", path: siFacebook.path, toUrl: handleOrUrl("https://www.facebook.com") },
  linkedin: { label: "LinkedIn", placeholder: "linkedin.com/in/name", path: LINKEDIN_PATH, toUrl: handleOrUrl("https://www.linkedin.com/in") },
  github: { label: "GitHub", placeholder: "username", path: siGithub.path, toUrl: handleOrUrl("https://github.com") },
  pinterest: { label: "Pinterest", placeholder: "username", path: siPinterest.path, toUrl: handleOrUrl("https://www.pinterest.com") },
  snapchat: { label: "Snapchat", placeholder: "username", path: siSnapchat.path, toUrl: handleOrUrl("https://www.snapchat.com/add") },
  spotify: { label: "Spotify", placeholder: "open.spotify.com/…", path: siSpotify.path, toUrl: asWebUrl },
  telegram: { label: "Telegram", placeholder: "@username", path: siTelegram.path, toUrl: handleOrUrl("https://t.me") },
  whatsapp: { label: "WhatsApp", placeholder: "+39 333 1234567", path: siWhatsapp.path, toUrl: whatsapp },
  discord: { label: "Discord", placeholder: "discord.gg/invite", path: siDiscord.path, toUrl: asWebUrl },
  substack: { label: "Substack", placeholder: "name.substack.com", path: siSubstack.path, toUrl: asWebUrl },
  medium: { label: "Medium", placeholder: "@username", path: siMedium.path, toUrl: handleOrUrl("https://medium.com/@") },
  patreon: { label: "Patreon", placeholder: "username", path: siPatreon.path, toUrl: handleOrUrl("https://www.patreon.com") },
  kofi: { label: "Ko-fi", placeholder: "username", path: siKofi.path, toUrl: handleOrUrl("https://ko-fi.com") },
  buymeacoffee: { label: "Buy Me a Coffee", placeholder: "username", path: siBuymeacoffee.path, toUrl: handleOrUrl("https://buymeacoffee.com") },
  email: { label: "Email", placeholder: "you@example.com", path: EMAIL_PATH, toUrl: email },
  website: { label: "Website", placeholder: "https://example.com", path: GLOBE_PATH, toUrl: asWebUrl },
} satisfies Record<string, SocialPlatform>;

export type SocialPlatformId = keyof typeof SOCIAL_PLATFORMS;
export const SOCIAL_PLATFORM_IDS = Object.keys(SOCIAL_PLATFORMS) as [SocialPlatformId, ...SocialPlatformId[]];
export const MAX_SOCIALS = 12;

function email(value: string): string | null {
  const address = value.replace(/^mailto:/i, "").trim();
  return EMAIL_PATTERN.test(address) ? `mailto:${address}` : null;
}

function whatsapp(value: string): string | null {
  if (value.includes("/")) return asWebUrl(value);
  const digits = value.replace(/[^\d]/g, "");
  return digits.length >= 6 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

function bluesky(value: string): string | null {
  const handle = value.replace(/^@/, "");
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(handle)) return `https://bsky.app/profile/${handle}`;
  return value.includes("/") ? asWebUrl(value) : null;
}

/** "@user@server" (or "user@server") opens the profile on that server; a URL is kept. */
function mastodon(value: string): string | null {
  const match = /^@?([a-z0-9_.-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i.exec(value.trim());
  if (match) return `https://${match[2]}/@${match[1]}`;
  return value.includes("/") ? asWebUrl(value) : null;
}

export type SocialIcon = { platform: SocialPlatformId; url: string };

export function socialLabel(platform: string): string {
  return (SOCIAL_PLATFORMS as Record<string, SocialPlatform>)[platform]?.label ?? platform;
}
