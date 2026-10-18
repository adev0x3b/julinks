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

/**
 * Longest side per use. Pictures keep their shape: the page crops them with
 * object-fit around the owner's chosen focal point, so a crop at upload time
 * would throw away exactly the pixels the owner may want to centre on.
 * A link picture serves both the small thumbnail and the big card image.
 */
const SIZES: Record<ImageKind, { max: number; quality: number }> = {
  avatar: { max: 768, quality: 85 },
  thumbnail: { max: 1200, quality: 82 },
  background: { max: 1600, quality: 78 },
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
    .resize({ width: size.max, height: size.max, fit: "inside", withoutEnlargement: true })
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
