import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createLink, listLinks } from "@/lib/data/links";
import { getPublicProfile } from "@/lib/data/users";
import { grabLinkPreviewFor } from "@/lib/link-preview-store";
import { getObject } from "@/lib/storage";
import { makeUser } from "./helpers";

describe("grabLinkPreviewFor", () => {
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const png = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#ff8800" } }).png().toBuffer();
    server = createServer((req, res) => {
      if (req.url === "/post") {
        res.setHeader("content-type", "text/html");
        return res.end('<html><head><meta property="og:image" content="/cover.png"></head></html>');
      }
      if (req.url === "/cover.png") {
        res.setHeader("content-type", "image/png");
        return res.end(png);
      }
      if (req.url === "/text") {
        res.setHeader("content-type", "text/html");
        return res.end('<html><head><meta property="og:image" content="/not-an-image"></head></html>');
      }
      if (req.url === "/not-an-image") return res.end("hello");
      res.statusCode = 404;
      res.end();
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("stores the page's preview image as the link's picture, resized and re-encoded", async () => {
    const user = await makeUser({ username: "ada" });
    const link = await createLink(user.id, { title: "Post", url: `${base}/post` });
    const stored = await grabLinkPreviewFor(user.id, link.id, link.url);
    expect(stored.key).toMatch(new RegExp(`^thumbnails/${user.id}/[a-f0-9]{24}\\.webp$`));
    expect(stored.url).toBe(`/img/${stored.key}`);

    const object = await getObject(stored.key);
    expect(object?.contentType).toBe("image/webp");
    const meta = await sharp(Buffer.from(await new Response(object!.body).arrayBuffer())).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 300, 200]);

    expect((await listLinks(user.id))[0].thumbnailKey).toBe(stored.key);
    expect((await getPublicProfile("ada"))?.links[0].thumbnailUrl).toBe(stored.url);
  });

  it("explains a preview that is not an image, and leaves the link alone", async () => {
    const user = await makeUser({ username: "ada" });
    const link = await createLink(user.id, { title: "Text", url: `${base}/text` });
    await expect(grabLinkPreviewFor(user.id, link.id, link.url)).rejects.toThrow(/not a PNG/);
    expect((await listLinks(user.id))[0].thumbnailKey).toBeNull();
  });
});
