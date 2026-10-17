import { themeStyle, type ThemeTokens } from "@/lib/themes";

export type PublicLink = { id: string; title: string; url: string; thumbnailUrl: string | null };

export type PublicTheme = { name: string; tokens: ThemeTokens; backgroundUrl: string | null };

export type PublicProfileData = {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  theme: PublicTheme;
  links: PublicLink[];
};

/**
 * The public page body. Rendered on the server for /username, in the editor's
 * live preview, in the theme studio and in gallery cards, so it must stay free
 * of hooks and server-only imports. The theme arrives as CSS custom properties
 * on the root element (see themeStyle); everything below only reads them.
 * In preview mode links do not navigate.
 */
export function PublicProfile({ profile, preview = false }: { profile: PublicProfileData; preview?: boolean }) {
  const { theme } = profile;
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
        <img src={profile.avatarUrl} alt="" width={80} height={80} className="jl-avatar size-20 rounded-full object-cover" />
      ) : (
        <div className="jl-avatar grid size-20 place-items-center rounded-full text-2xl font-semibold" aria-hidden>
          {initials || "?"}
        </div>
      )}
      <h1 className="mt-4 text-xl font-semibold">{profile.displayName}</h1>
      <p className="jl-muted mt-1 text-sm">@{profile.username}</p>
      {profile.bio && <p className="mt-3 max-w-xs text-center text-sm leading-relaxed">{profile.bio}</p>}

      <ul className="mt-8 flex w-full max-w-sm flex-col gap-3" aria-label="Links">
        {profile.links.map((link) => (
          <li key={link.id}>
            <a
              href={preview ? undefined : `/l/${link.id}`}
              role={preview ? "button" : undefined}
              className="jl-button relative flex w-full items-center justify-center px-12 py-3 text-center text-sm font-medium transition hover:-translate-y-0.5"
              data-link-id={link.id}
            >
              {link.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={link.thumbnailUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="absolute left-2 top-1/2 size-8 -translate-y-1/2 rounded-[calc(var(--jl-radius)/2)] object-cover"
                />
              )}
              {link.title}
            </a>
          </li>
        ))}
        {profile.links.length === 0 && <li className="jl-muted text-center text-sm">No links yet.</li>}
      </ul>

      <p className="jl-muted mt-auto pt-12 text-xs">Made with JuLinks</p>
    </div>
  );
}

/** A stand-in profile for showing a theme on its own (gallery cards, preset chips). */
export function sampleProfile(theme: PublicTheme): PublicProfileData {
  return {
    username: "yourname",
    displayName: "Your Name",
    bio: "A line about you.",
    avatarUrl: null,
    theme,
    links: [
      { id: "s1", title: "Portfolio", url: "#", thumbnailUrl: null },
      { id: "s2", title: "Blog", url: "#", thumbnailUrl: null },
      { id: "s3", title: "Say hello", url: "#", thumbnailUrl: null },
    ],
  };
}
