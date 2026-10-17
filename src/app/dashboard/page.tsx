import { redirect } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { listLinks } from "@/lib/data/links";
import { getActiveTheme } from "@/lib/data/themes";
import { imageUrl } from "@/lib/image-url";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Your links" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [links, theme] = await Promise.all([listLinks(user.id), getActiveTheme(user.id)]);
  return (
    <Editor
      user={{ username: user.username, displayName: user.displayName, bio: user.bio, avatarUrl: imageUrl(user.avatarKey) }}
      theme={{ name: theme.name, tokens: theme.tokens, backgroundUrl: imageUrl(theme.backgroundKey) }}
      links={links.map((l) => ({
        id: l.id,
        title: l.title,
        url: l.url,
        enabled: l.enabled,
        clicks: l._count.clicks,
        thumbnailUrl: imageUrl(l.thumbnailKey),
      }))}
    />
  );
}
