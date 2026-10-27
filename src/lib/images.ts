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
 * libvips ships decoders for dozens of formats (SVG through librsvg, AVIF/HEIF through
 * libheif, PDF, TIFF, JPEG 2000, ...) and sharp's metadata() would try each of them on an
 * upload. Only the four the app accepts stay switched on, so a crafted file in any other
 * format never reaches a parser at all: the fewer parsers that see attacker bytes, the
 * fewer need to be bug-free (the October 2026 librsvg and August 2026 libheif RCEs were
 * exactly this class). Process-wide, once, on first import.
 */
sharp.block({ operation: ["VipsForeignLoad"] });
sharp.unblock({ operation: ["VipsForeignLoadPng", "VipsForeignLoadJpeg", "VipsForeignLoadWebp", "VipsForeignLoadNsgif"] });

/** What the first bytes say the file is; anything else is refused before sharp sees it. */
export function sniffImageFormat(input: Uint8Array): "png" | "jpeg" | "webp" | "gif" | null {
  const b = input;
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "webp";
  if (b.length >= 6 && (ascii(b, 0, 6) === "GIF87a" || ascii(b, 0, 6) === "GIF89a")) return "gif";
  return null;
}

function ascii(b: Uint8Array, from: number, to: number): string {
  return String.fromCharCode(...b.subarray(from, to));
}

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
  if (!sniffImageFormat(input)) throw new UnsupportedImage();
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
