import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { IMAGE_KEY_PATTERN, imageKey, processImage, rekeyImage, UnsupportedImage } from "@/lib/images";

async function png(width: number, height: number) {
  return sharp({ create: { width, height, channels: 3, background: "#336699" } })
    .png()
    .toBuffer();
}

describe("processImage", () => {
  it("keeps an avatar's shape (the page crops around the focal point) and re-encodes as WebP", async () => {
    const out = await processImage(await png(1536, 512), "avatar");
    expect(out).toMatchObject({ contentType: "image/webp", width: 768, height: 256 });
    expect((await sharp(out.data).metadata()).format).toBe("webp");
  });

  it("sizes a link picture for the big card layout and never enlarges", async () => {
    expect(await processImage(await png(2400, 1200), "thumbnail")).toMatchObject({ width: 1200, height: 600 });
    expect(await processImage(await png(64, 64), "thumbnail")).toMatchObject({ width: 64, height: 64 });
  });

  it("fits backgrounds inside the limit without enlarging small pictures", async () => {
    const big = await processImage(await png(3200, 1000), "background");
    expect(big.width).toBe(1600);
    expect(big.height).toBe(500);
    const small = await processImage(await png(200, 100), "background");
    expect(small.width).toBe(200);
  });

  it("drops metadata on the way through", async () => {
    const withExif = await sharp(await png(100, 100))
      .withMetadata({ exif: { IFD0: { Copyright: "secret" } } })
      .jpeg()
      .toBuffer();
    const out = await processImage(withExif, "thumbnail");
    expect((await sharp(out.data).metadata()).exif).toBeUndefined();
  });

  it("rejects anything that is not an image", async () => {
    await expect(processImage(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"), "avatar")).rejects.toBeInstanceOf(UnsupportedImage);
    await expect(processImage(Buffer.from("hello"), "avatar")).rejects.toBeInstanceOf(UnsupportedImage);
  });
});

describe("imageKey", () => {
  it("is content-addressed under the owner's prefix and matches the route pattern", () => {
    const a = imageKey("avatar", "user1", Buffer.from("same"));
    const b = imageKey("avatar", "user1", Buffer.from("same"));
    const c = imageKey("avatar", "user1", Buffer.from("other"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(IMAGE_KEY_PATTERN);
    expect(a.startsWith("avatars/user1/")).toBe(true);
    expect(rekeyImage(a, "avatar", "user2")).toBe(a.replace("user1", "user2"));
  });

  it("serves nothing outside the three prefixes or with odd characters", () => {
    expect("avatars/../x/000000000000000000000000.webp").not.toMatch(IMAGE_KEY_PATTERN);
    expect("secrets/u/000000000000000000000000.webp").not.toMatch(IMAGE_KEY_PATTERN);
    expect("avatars/u/000000000000000000000000.png").not.toMatch(IMAGE_KEY_PATTERN);
  });
});
