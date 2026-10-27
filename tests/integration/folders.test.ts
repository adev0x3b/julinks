import { describe, expect, it } from "vitest";
import { createFolder, deleteFolder, listFolders, MAX_FOLDERS_PER_USER, reorderFolders, setLinkFolder, updateFolder } from "@/lib/data/folders";
import { createLink, listLinks, NotFound } from "@/lib/data/links";
import { getPublicProfile } from "@/lib/data/users";
import { makeUser } from "./helpers";

describe("folders", () => {
  it("are created in order, renamed, collapsed and reordered", async () => {
    const user = await makeUser({ username: "ada" });
    const articles = await createFolder(user.id, "Articles");
    const talks = await createFolder(user.id, "Talks");
    expect([articles.position, talks.position]).toEqual([0, 1]);
    expect(articles.collapsed).toBe(false);

    await updateFolder(user.id, talks.id, { title: "Conference talks", collapsed: true });
    await reorderFolders(user.id, [talks.id, articles.id]);
    const folders = await listFolders(user.id);
    expect(folders.map((f) => [f.title, f.collapsed])).toEqual([
      ["Conference talks", true],
      ["Articles", false],
    ]);
    await expect(reorderFolders(user.id, [talks.id])).rejects.toThrow(/exactly once/);
  });

  it("hold links, which fall back to the top level when the folder goes", async () => {
    const user = await makeUser({ username: "ada" });
    const folder = await createFolder(user.id, "Articles");
    const inside = await createLink(user.id, { title: "Inside", url: "https://a.example" });
    const outside = await createLink(user.id, { title: "Outside", url: "https://b.example" });
    await setLinkFolder(user.id, inside.id, folder.id);

    const profile = await getPublicProfile("ada");
    expect(profile?.folders).toEqual([{ id: folder.id, title: "Articles", collapsed: false }]);
    expect(profile?.links.map((l) => [l.title, l.folderId])).toEqual([
      [inside.title, folder.id],
      [outside.title, null],
    ]);

    await deleteFolder(user.id, folder.id);
    expect((await listLinks(user.id)).map((l) => l.folderId)).toEqual([null, null]);
  });

  it("never cross users", async () => {
    const ada = await makeUser({ username: "ada" });
    const bob = await makeUser({ username: "bob" });
    const folder = await createFolder(ada.id, "Private");
    const link = await createLink(bob.id, { title: "Bob's", url: "https://b.example" });
    await expect(setLinkFolder(bob.id, link.id, folder.id)).rejects.toBeInstanceOf(NotFound);
    await expect(updateFolder(bob.id, folder.id, { title: "Mine now" })).rejects.toBeInstanceOf(NotFound);
    await expect(deleteFolder(bob.id, folder.id)).rejects.toBeInstanceOf(NotFound);
    expect(await listFolders(bob.id)).toEqual([]);
  });

  it("are capped per user", async () => {
    const user = await makeUser();
    for (let i = 0; i < MAX_FOLDERS_PER_USER; i += 1) await createFolder(user.id, `Folder ${i}`);
    await expect(createFolder(user.id, "One more")).rejects.toThrow(/at most/);
  });
});
