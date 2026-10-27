import { ThemeStudio } from "@/components/themes/ThemeStudio";
import { listFolders } from "@/lib/data/folders";
import { listLinks } from "@/lib/data/links";
import { listSocials } from "@/lib/data/socials";
import { listOwnThemes } from "@/lib/data/themes";
import { imageUrl } from "@/lib/image-url";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Appearance" };

export default async function AppearancePage({ searchParams }: PageProps<"/dashboard/appearance">) {
  const user = await requireUser();
  const [{ theme, error }, themes, links, socials, folders] = await Promise.all([
    searchParams,
    listOwnThemes(user.id),
    listLinks(user.id),
    listSocials(user.id),
    listFolders(user.id),
  ]);
  return (
    <ThemeStudio
      user={{
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: imageUrl(user.avatarKey),
        avatarFocus: { x: user.avatarFocusX, y: user.avatarFocusY },
        socials: socials.map((s) => ({ platform: s.platform, url: s.url })),
        folders: folders.map((f) => ({ id: f.id, title: f.title, collapsed: f.collapsed })),
      }}
      links={links
        .filter((l) => l.enabled)
        .map((l) => ({
          id: l.id,
          title: l.title,
          url: l.url,
          thumbnailUrl: imageUrl(l.thumbnailKey),
          imageLayout: l.imageLayout,
          imageFocus: { x: l.imageFocusX, y: l.imageFocusY },
          folderId: l.folderId,
        }))}
      themes={themes.map((t) => ({
        id: t.id,
        name: t.name,
        tokens: t.tokens,
        backgroundUrl: imageUrl(t.backgroundKey),
        isPublic: t.isPublic,
        forkedFromId: t.forkedFromId,
      }))}
      activeId={user.themeId}
      initialSelectedId={typeof theme === "string" ? theme : null}
      notice={error === "copy" ? "That theme could not be copied." : null}
    />
  );
}
