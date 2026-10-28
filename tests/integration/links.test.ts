import { describe, expect, it } from "vitest";
import { createLink, deleteLink, listLinks, NotFound, reorderLinks, setLinkImage, setLinkThumbnail, updateLink } from "@/lib/data/links";
import { makeUser } from "./helpers";

describe("links", () => {
  it("appends new links at the end", async () => {
    const user = await makeUser();
    const a = await createLink(user.id, { title: "A", url: "https://a.example" });
    const b = await createLink(user.id, { title: "B", url: "https://b.example" });
    expect([a.position, b.position]).toEqual([0, 1]);
    expect((await listLinks(user.id)).map((l) => l.id)).toEqual([a.id, b.id]);
  });

  it("reorders to exactly the given order", async () => {
    const user = await makeUser();
    const a = await createLink(user.id, { title: "A", url: "https://a.example" });
    const b = await createLink(user.id, { title: "B", url: "https://b.example" });
    const c = await createLink(user.id, { title: "C", url: "https://c.example" });
    await reorderLinks(user.id, [c.id, a.id, b.id]);
    expect((await listLinks(user.id)).map((l) => l.title)).toEqual(["C", "A", "B"]);
  });

  it("rejects an order that misses or repeats a link", async () => {
    const user = await makeUser();
    const a = await createLink(user.id, { title: "A", url: "https://a.example" });
    const b = await createLink(user.id, { title: "B", url: "https://b.example" });
    await expect(reorderLinks(user.id, [a.id])).rejects.toThrow(/exactly once/);
    await expect(reorderLinks(user.id, [a.id, a.id])).rejects.toThrow(/exactly once/);
    await expect(reorderLinks(user.id, [a.id, b.id, "other"])).rejects.toThrow(/exactly once/);
  });

  it("never lets one user touch another user's links", async () => {
    const owner = await makeUser();
    const intruder = await makeUser();
    const link = await createLink(owner.id, { title: "Mine", url: "https://a.example" });

    await expect(updateLink(intruder.id, link.id, { title: "Yours" })).rejects.toBeInstanceOf(NotFound);
    await expect(deleteLink(intruder.id, link.id)).rejects.toBeInstanceOf(NotFound);
    await expect(reorderLinks(intruder.id, [link.id])).rejects.toThrow();

    const [unchanged] = await listLinks(owner.id);
    expect(unchanged.title).toBe("Mine");
  });

  it("updates and deletes for the owner", async () => {
    const user = await makeUser();
    const link = await createLink(user.id, { title: "A", url: "https://a.example" });
    const updated = await updateLink(user.id, link.id, { title: "A2", enabled: false });
    expect(updated).toMatchObject({ title: "A2", enabled: false, url: "https://a.example" });
    await deleteLink(user.id, link.id);
    expect(await listLinks(user.id)).toEqual([]);
  });

  it("stores how a picture shows and where it is centred, and re-centres a new picture", async () => {
    const user = await makeUser();
    const link = await createLink(user.id, { title: "Pic", url: "https://a.example" });
    await setLinkThumbnail(user.id, link.id, "thumbnails/u/000000000000000000000000.webp");
    await setLinkImage(user.id, link.id, { layout: "featured", focus: { x: 20, y: 80, zoom: 180 } });
    let [stored] = await listLinks(user.id);
    expect(stored).toMatchObject({ imageLayout: "featured", imageFocusX: 20, imageFocusY: 80, imageZoom: 180 });

    await setLinkThumbnail(user.id, link.id, "thumbnails/u/111111111111111111111111.webp");
    [stored] = await listLinks(user.id);
    expect(stored).toMatchObject({ imageLayout: "featured", imageFocusX: 50, imageFocusY: 50, imageZoom: 100 });

    const intruder = await makeUser();
    await expect(setLinkImage(intruder.id, link.id, { layout: "thumbnail", focus: { x: 50, y: 50, zoom: 100 } })).rejects.toBeInstanceOf(NotFound);
  });
});
