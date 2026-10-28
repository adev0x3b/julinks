"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PhoneFrame } from "@/components/PhoneFrame";
import { PublicProfile, type PublicTheme } from "@/components/PublicProfile";
import { AddLinkForm } from "./AddLinkForm";
import { FoldersPanel } from "./FoldersPanel";
import { LinkList, type EditorLink } from "./LinkList";
import { ProfilePanel, type ProfileDraft } from "./ProfilePanel";
import type { SocialDraft } from "./SocialsEditor";
import type { Folder } from "@/lib/data/folders";
import { SOCIAL_PLATFORMS } from "@/lib/socials";
import type { ImageFocus } from "@/lib/validation";

export type EditorUser = {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  avatarFocus: ImageFocus;
  socials: SocialDraft[];
};

/**
 * Owns the editable state of the page so the preview updates as you type and
 * drag, before the server round trip finishes. Server data arrives as props
 * after each router.refresh(); when it changes, local state is reset to it.
 */
export function Editor({ user, theme, links, folders }: { user: EditorUser; theme: PublicTheme; links: EditorLink[]; folders: Folder[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [profile, setProfile] = useState<ProfileDraft>({
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    avatarFocus: user.avatarFocus,
    socials: user.socials,
  });
  const [items, setItems] = useState(links);
  const [syncedLinks, setSyncedLinks] = useState(links);
  if (links !== syncedLinks) {
    setSyncedLinks(links);
    setItems(links);
  }
  const [folderItems, setFolderItems] = useState(folders);
  const [syncedFolders, setSyncedFolders] = useState(folders);
  if (folders !== syncedFolders) {
    setSyncedFolders(folders);
    setFolderItems(folders);
  }

  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="flex flex-col gap-6">
        <ProfilePanel username={user.username} themeName={theme.name} draft={profile} onChange={setProfile} />
        <FoldersPanel folders={folderItems} onChange={setFolderItems} onRefresh={refresh} />
        <section className="card">
          <h2 className="text-base font-semibold">Links</h2>
          <p className="mb-4 text-sm text-stone-500">
            Drag to reorder. Click the square to give a link a picture: upload one or grab the link&apos;s own preview image,
            then choose small or big and where it is centred. Disabled links stay here but leave your page.
          </p>
          <AddLinkForm onAdded={refresh} />
          <LinkList items={items} folders={folderItems} onChange={setItems} onRefresh={refresh} />
        </section>
      </div>
      <aside className="lg:sticky lg:top-8 lg:self-start">
        <p className="label text-center">Live preview</p>
        <div className="mx-auto w-full max-w-[320px]">
          <PhoneFrame>
            <PublicProfile
              preview
              profile={{
                username: user.username,
                displayName: profile.displayName || user.displayName,
                bio: profile.bio,
                avatarUrl: profile.avatarUrl,
                avatarFocus: profile.avatarFocus,
                theme,
                // Rows still being typed show with a dead link rather than vanishing from the preview.
                socials: profile.socials.map((s) => ({ platform: s.platform, url: SOCIAL_PLATFORMS[s.platform].toUrl(s.value) ?? "#" })),
                folders: folderItems,
                links: items
                  .filter((l) => l.enabled)
                  .map(({ id, title, url, thumbnailUrl, imageLayout, imageFocus, folderId }) => ({ id, title, url, thumbnailUrl, imageLayout, imageFocus, folderId })),
              }}
            />
          </PhoneFrame>
        </div>
      </aside>
    </div>
  );
}
