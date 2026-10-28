import { Editor } from "@/components/editor/Editor";
import { listFolders } from "@/lib/data/folders";
import { listLinks } from "@/lib/data/links";
import { listSocials } from "@/lib/data/socials";
import { getActiveTheme } from "@/lib/data/themes";
import { imageUrl } from "@/lib/image-url";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Your links" };

export default async function DashboardPage() {
  const user = await requireUser();
  const [links, theme, socials, folders] = await Promise.all([listLinks(user.id), getActiveTheme(user.id), listSocials(user.id), listFolders(user.id)]);
  return (
    <Editor
      user={{
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: imageUrl(user.avatarKey),
        avatarFocus: { x: user.avatarFocusX, y: user.avatarFocusY, zoom: user.avatarZoom },
        socials: socials.map(({ platform, value }) => ({ platform, value })),
      }}
      folders={folders}
      theme={{ name: theme.name, tokens: theme.tokens, backgroundUrl: imageUrl(theme.backgroundKey) }}
      links={links.map((l) => ({
        id: l.id,
        title: l.title,
        url: l.url,
        enabled: l.enabled,
        clicks: l._count.clicks,
        thumbnailUrl: imageUrl(l.thumbnailKey),
        imageLayout: l.imageLayout,
        imageFocus: { x: l.imageFocusX, y: l.imageFocusY, zoom: l.imageZoom },
        folderId: l.folderId,
      }))}
    />
  );
}
