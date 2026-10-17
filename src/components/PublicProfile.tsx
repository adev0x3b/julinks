import { getTheme } from "@/lib/themes";

export type PublicLink = { id: string; title: string; url: string };

export type PublicProfileData = {
  username: string;
  displayName: string;
  bio: string;
  theme: string;
  links: PublicLink[];
};

/**
 * The public page body. Rendered on the server for /username and on the
 * client inside the editor's live preview, so it must stay free of hooks
 * and server-only imports. In preview mode links do not navigate.
 */
export function PublicProfile({ profile, preview = false }: { profile: PublicProfileData; preview?: boolean }) {
  const theme = getTheme(profile.theme);
  const initials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      className="flex min-h-full w-full flex-col items-center px-5 py-12"
      style={{ background: theme.background, color: theme.text }}
      data-theme={theme.id}
    >
      <div
        className="grid size-20 place-items-center rounded-full text-2xl font-semibold"
        style={{ background: theme.button, color: theme.buttonText, border: `2px solid ${theme.muted}` }}
        aria-hidden
      >
        {initials || "?"}
      </div>
      <h1 className="mt-4 text-xl font-semibold">{profile.displayName}</h1>
      <p className="mt-1 text-sm" style={{ color: theme.muted }}>
        @{profile.username}
      </p>
      {profile.bio && <p className="mt-3 max-w-xs text-center text-sm leading-relaxed">{profile.bio}</p>}

      <ul className="mt-8 flex w-full max-w-sm flex-col gap-3" aria-label="Links">
        {profile.links.map((link) => (
          <li key={link.id}>
            <a
              href={preview ? undefined : `/l/${link.id}`}
              role={preview ? "button" : undefined}
              className="block w-full px-5 py-3.5 text-center text-sm font-medium transition hover:-translate-y-0.5"
              style={{
                background: theme.button,
                color: theme.buttonText,
                borderRadius: theme.radius,
                border: `1px solid ${theme.muted}`,
              }}
              data-link-id={link.id}
            >
              {link.title}
            </a>
          </li>
        ))}
        {profile.links.length === 0 && (
          <li className="text-center text-sm" style={{ color: theme.muted }}>
            No links yet.
          </li>
        )}
      </ul>

      <p className="mt-auto pt-12 text-xs" style={{ color: theme.muted }}>
        Made with JuLinks
      </p>
    </div>
  );
}
