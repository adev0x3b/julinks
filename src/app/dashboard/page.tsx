import { redirect } from "next/navigation";
import { Editor } from "@/components/editor/Editor";
import { listLinks } from "@/lib/data/links";
import { getCurrentUser } from "@/lib/session";

export const metadata = { title: "Your links" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const links = await listLinks(user.id);
  return (
    <Editor
      user={{ username: user.username, displayName: user.displayName, bio: user.bio, theme: user.theme }}
      links={links.map((l) => ({ id: l.id, title: l.title, url: l.url, enabled: l.enabled, clicks: l._count.clicks }))}
    />
  );
}
