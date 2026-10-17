import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { setLinkThumbnail, createLink, NotFound } from "@/lib/data/links";
import { setAvatar, getPublicProfile } from "@/lib/data/users";
import { imageKey, processImage } from "@/lib/images";
import { copyObject, deleteObject, getObject, putObject } from "@/lib/storage";
import { makeUser } from "./helpers";

async function readAll(stream: ReadableStream<Uint8Array>) {
  return Buffer.from(await new Response(stream).arrayBuffer());
}

describe("object storage", () => {
  it("round-trips a processed image through put, get, copy and delete", async () => {
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#ff8800" } }).png().toBuffer();
    const image = await processImage(png, "thumbnail");
    const key = imageKey("thumbnail", "user1", image.data);

    await putObject(key, image.data, image.contentType);
    const stored = await getObject(key);
    expect(stored?.contentType).toBe("image/webp");
    expect(await readAll(stored!.body)).toEqual(image.data);

    const copy = key.replace("user1", "user2");
    await copyObject(key, copy);
    expect(await readAll((await getObject(copy))!.body)).toEqual(image.data);

    await deleteObject(key);
    expect(await getObject(key)).toBeNull();
    await expect(deleteObject(key)).resolves.toBeUndefined();
  });
});

describe("image keys on rows", () => {
  it("records avatar and thumbnail keys, returns the previous key, and scopes thumbnails to the owner", async () => {
    const user = await makeUser({ username: "ada" });
    const other = await makeUser();
    const link = await createLink(user.id, { title: "Site", url: "https://a.example" });

    expect(await setAvatar(user.id, "avatars/u/one.webp")).toBeNull();
    expect(await setAvatar(user.id, "avatars/u/two.webp")).toBe("avatars/u/one.webp");
    expect(await setLinkThumbnail(user.id, link.id, "thumbnails/u/t.webp")).toBeNull();
    await expect(setLinkThumbnail(other.id, link.id, "thumbnails/x/t.webp")).rejects.toBeInstanceOf(NotFound);

    const profile = await getPublicProfile("ada");
    expect(profile?.avatarUrl).toBe("/img/avatars/u/two.webp");
    expect(profile?.links[0].thumbnailUrl).toBe("/img/thumbnails/u/t.webp");

    expect(await setAvatar(user.id, null)).toBe("avatars/u/two.webp");
    expect((await getPublicProfile("ada"))?.avatarUrl).toBeNull();
  });
});
