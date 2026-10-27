import { SOCIAL_PLATFORMS, type SocialIcon } from "@/lib/socials";
import { themeStyle, type ThemeTokens } from "@/lib/themes";
import type { ImageFocus, ImageLayout } from "@/lib/validation";

export type PublicLink = {
  id: string;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  /** "thumbnail": small picture beside the title; "featured": big picture above it. */
  imageLayout: ImageLayout;
  imageFocus: ImageFocus;
  /** The folder the link is listed under, or null for the top-level list. */
  folderId: string | null;
};

export type PublicFolder = { id: string; title: string; collapsed: boolean };

export type PublicTheme = {
  name: string;
  tokens: ThemeTokens;
  backgroundUrl: string | null;
};

export type PublicProfileData = {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarFocus: ImageFocus;
  theme: PublicTheme;
  /** The icon row under the bio, in order. */
  socials: SocialIcon[];
  /** Folders in order; links whose folderId matches are listed under them. */
  folders: PublicFolder[];
  links: PublicLink[];
};

/**
 * The public page body. Rendered on the server for /username, in the editor's
 * live preview, in the theme studio and in gallery cards, so it must stay free
 * of hooks and server-only imports. The theme arrives as CSS custom properties
 * on the root element (see themeStyle); everything below only reads them.
 * In preview mode links do not navigate.
 */
export function PublicProfile({
  profile,
  preview = false,
}: {
  profile: PublicProfileData;
  preview?: boolean;
}) {
  const { theme } = profile;
  const folderIds = new Set(profile.folders.map((f) => f.id));
  // A link pointing at a folder that no longer exists is listed at the top level rather than lost.
  const topLevel = profile.links.filter((l) => !l.folderId || !folderIds.has(l.folderId));
  const byFolder = new Map<string, PublicLink[]>();
  for (const link of profile.links) {
    if (link.folderId && folderIds.has(link.folderId)) {
      byFolder.set(link.folderId, [...(byFolder.get(link.folderId) ?? []), link]);
    }
  }
  const initials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      className="jl-page flex min-h-full w-full flex-col items-center px-5 py-12"
      style={themeStyle(theme.tokens, theme.backgroundUrl)}
      data-theme={theme.name}
    >
      {profile.avatarUrl ? (
        // Already resized and re-encoded on upload; the optimiser would only add a hop.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatarUrl}
          alt=""
          width={80}
          height={80}
          className="jl-avatar size-20 rounded-full object-cover"
          style={{ objectPosition: focusPosition(profile.avatarFocus) }}
        />
      ) : (
        <div
          className="jl-avatar grid size-20 place-items-center rounded-full text-2xl font-semibold"
          aria-hidden
        >
          {initials || "?"}
        </div>
      )}
      <h1 className="mt-4 text-xl font-semibold">{profile.displayName}</h1>
      <p className="jl-muted mt-1 text-sm">@{profile.username}</p>
      {profile.bio && (
        // Line breaks the owner typed are kept, so a row of emoji can sit under the text instead of wrapping into it.
        <p className="mt-3 max-w-xs whitespace-pre-line text-center text-sm leading-relaxed">
          {profile.bio}
        </p>
      )}
      {profile.socials.length > 0 && (
        <ul className="mt-4 flex flex-wrap justify-center gap-4" aria-label="Social links">
          {profile.socials.map((social, index) => {
            const platform = SOCIAL_PLATFORMS[social.platform];
            return (
              <li key={`${social.platform}-${index}`}>
                <a
                  href={preview ? undefined : social.url}
                  role={preview ? "button" : undefined}
                  target={preview || social.platform === "email" ? undefined : "_blank"}
                  rel="noreferrer"
                  className="jl-social block rounded-full p-1 transition hover:-translate-y-0.5"
                  aria-label={platform.label}
                  title={platform.label}
                  data-platform={social.platform}
                >
                  <svg viewBox="0 0 24 24" width={24} height={24} fill="currentColor" aria-hidden>
                    <path d={platform.path} />
                  </svg>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <ul
        className="mt-8 flex w-full max-w-sm flex-col gap-3"
        aria-label="Links"
      >
        {topLevel.map((link) => (
          <li key={link.id}>
            <LinkButton link={link} preview={preview} />
          </li>
        ))}
        {profile.links.length === 0 && (
          <li className="jl-muted text-center text-sm">No links yet.</li>
        )}
      </ul>
      {profile.folders.map((folder) => {
        const links = byFolder.get(folder.id) ?? [];
        if (links.length === 0) return null;
        const list = (
          <ul className="flex w-full flex-col gap-3" aria-label={folder.title}>
            {links.map((link) => (
              <li key={link.id}>
                <LinkButton link={link} preview={preview} />
              </li>
            ))}
          </ul>
        );
        return folder.collapsed ? (
          // Native disclosure: works without JavaScript and inside the hook-free preview.
          // Open, the row's own box grows to hold the links as plain rows (styles in globals.css, .jl-disclosure).
          <details key={folder.id} className="jl-folder jl-disclosure group mt-3 w-full max-w-sm" data-folder={folder.id} data-collapsed="true">
            <summary className="jl-button flex w-full cursor-pointer list-none items-center justify-center gap-2 px-12 py-3 text-center text-sm font-medium transition hover:-translate-y-0.5 [&::-webkit-details-marker]:hidden">
              {folder.title}
              <svg viewBox="0 0 16 16" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} className="transition group-open:rotate-180" aria-hidden>
                <path d="M3 6l5 5 5-5" />
              </svg>
            </summary>
            <div className="jl-disclosure-body mt-3">{list}</div>
          </details>
        ) : (
          <section key={folder.id} className="jl-folder mt-8 w-full max-w-sm" data-folder={folder.id} data-collapsed="false">
            <h2 className="jl-muted mb-3 text-center text-xs font-semibold uppercase tracking-widest">{folder.title}</h2>
            {list}
          </section>
        );
      })}

      <p className="jl-muted mt-auto pt-12 text-xs">Made with JuLinks</p>
    </div>
  );
}

/** One link: a card with a big picture, or a button with an optional small picture beside the title. */
function LinkButton({ link, preview }: { link: PublicLink; preview: boolean }) {
  return link.thumbnailUrl && link.imageLayout === "featured" ? (
              <a
                href={preview ? undefined : `/l/${link.id}`}
                role={preview ? "button" : undefined}
                className="jl-button flex w-full flex-col items-center gap-3 p-2 pb-3 text-center text-sm font-medium transition hover:-translate-y-0.5"
                // A pill radius would turn a tall card into an ellipse: cap it, and round the picture to match inside the padding.
                style={{ borderRadius: "min(var(--jl-radius), 1.25rem)" }}
                data-link-id={link.id}
                data-layout="featured"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={link.thumbnailUrl}
                  alt=""
                  className="aspect-[16/10] w-full object-cover"
                  style={{ objectPosition: focusPosition(link.imageFocus), borderRadius: "max(0px, min(calc(var(--jl-radius) - 0.5rem), 0.75rem))" }}
                />
                <span className="px-4">{link.title}</span>
              </a>
            ) : (
              <a
                href={preview ? undefined : `/l/${link.id}`}
                role={preview ? "button" : undefined}
                className="jl-button relative flex w-full items-center justify-center px-12 py-3 text-center text-sm font-medium transition hover:-translate-y-0.5"
                data-link-id={link.id}
                data-layout="thumbnail"
              >
                {link.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={link.thumbnailUrl}
                    alt=""
                    width={32}
                    height={32}
                    className="absolute left-2 top-1/2 size-8 -translate-y-1/2 rounded-[calc(var(--jl-radius)/2)] object-cover"
                    style={{ objectPosition: focusPosition(link.imageFocus) }}
                  />
                )}
                {link.title}
              </a>
            );
}

export const CENTRE: ImageFocus = { x: 50, y: 50 };

/** The focal point as a CSS object-position value. */
export function focusPosition(focus: ImageFocus): string {
  return `${focus.x}% ${focus.y}%`;
}

/** A stand-in profile for showing a theme on its own (gallery cards, preset chips). */
export function sampleProfile(theme: PublicTheme): PublicProfileData {
  const link = (id: string, title: string): PublicLink => ({
    id,
    title,
    url: "#",
    thumbnailUrl: null,
    imageLayout: "thumbnail",
    imageFocus: CENTRE,
    folderId: null,
  });
  return {
    username: "yourname",
    displayName: "Your Name",
    bio: "A line about you.",
    avatarUrl: null,
    avatarFocus: CENTRE,
    theme,
    socials: [
      { platform: "instagram", url: "#" },
      { platform: "email", url: "#" },
    ],
    folders: [],
    links: [
      link("s1", "Portfolio"),
      link("s2", "Blog"),
      link("s3", "Say hello"),
    ],
  };
}
