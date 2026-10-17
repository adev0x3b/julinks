import { createHash } from "node:crypto";
import sharp from "sharp";
import type { ImageKind } from "@/lib/validation";

/**
 * Every uploaded picture goes through here: decoded with sharp (which only
 * accepts the formats listed below), rotated per EXIF, resized for its use,
 * stripped of metadata and re-encoded as WebP. Nothing a user uploads is ever
 * stored or served as-is.
 */
export class UnsupportedImage extends Error {
  constructor(message = "Upload a PNG, JPEG or WebP image") {
    super(message);
  }
}

const ACCEPTED_FORMATS = new Set(["png", "jpeg", "webp", "gif"]);

/** Output dimensions per use. Avatars and thumbnails are cropped square; backgrounds keep their shape. */
const SIZES: Record<ImageKind, { width: number; height?: number; quality: number }> = {
  avatar: { width: 512, height: 512, quality: 85 },
  thumbnail: { width: 160, height: 160, quality: 85 },
  background: { width: 1600, quality: 78 },
};

export type ProcessedImage = { data: Buffer; contentType: "image/webp"; width: number; height: number };

export async function processImage(input: Uint8Array, kind: ImageKind): Promise<ProcessedImage> {
  const image = sharp(input, { limitInputPixels: 40_000_000, animated: false });
  let meta;
  try {
    meta = await image.metadata();
  } catch {
    throw new UnsupportedImage();
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) throw new UnsupportedImage();
  const size = SIZES[kind];
  const { data, info } = await image
    .rotate()
    .resize({
      width: size.width,
      height: size.height,
      fit: size.height ? "cover" : "inside",
      withoutEnlargement: !size.height,
      position: "attention",
    })
    .webp({ quality: size.quality })
    .toBuffer({ resolveWithObject: true });
  return { data, contentType: "image/webp", width: info.width, height: info.height };
}

const KIND_PREFIX: Record<ImageKind, string> = { avatar: "avatars", thumbnail: "thumbnails", background: "backgrounds" };

/** Content-addressed key under the owner's prefix: re-uploading the same picture lands on the same key. */
export function imageKey(kind: ImageKind, ownerId: string, data: Uint8Array): string {
  const hash = createHash("sha256").update(data).digest("hex").slice(0, 24);
  return `${KIND_PREFIX[kind]}/${ownerId}/${hash}.webp`;
}

/** The same picture under another owner's prefix (used when a theme with a background is copied). */
export function rekeyImage(key: string, kind: ImageKind, ownerId: string): string {
  const file = key.slice(key.lastIndexOf("/") + 1);
  return `${KIND_PREFIX[kind]}/${ownerId}/${file}`;
}

/** The only shape of key the image route will serve. */
export const IMAGE_KEY_PATTERN = /^(avatars|thumbnails|backgrounds)\/[a-z0-9]{1,40}\/[a-f0-9]{24}\.webp$/;
