/**
 * Draws the other app icons from src/app/icon.png (the rounded J tile, transparent corners):
 * favicon.ico (16, 32, 48), apple-icon.png (180, full-bleed on the tile's navy: iOS rounds
 * it itself) and the 1200x630 opengraph-image.png link previews show. Next serves them by
 * file name.
 *
 *   npx tsx scripts/icons.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const dir = "src/app";
const icon = readFileSync(`${dir}/icon.png`);
const NAVY = { r: 23, g: 27, b: 88 };

const png = (size: number) => sharp(icon).resize(size, size).png().toBuffer();

/** An .ico holding PNG images, which every current browser reads. */
function ico(images: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size % 256, entry);
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.data)]);
}

const ogText = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#eef2ff"/>
  <text x="440" y="300" font-family="Inter, Helvetica, Arial, sans-serif" font-size="96" font-weight="700" fill="#1c1917">JuLinks</text>
  <text x="444" y="380" font-family="Inter, Helvetica, Arial, sans-serif" font-size="40" fill="#57534e">One page for all your links.</text>
</svg>`;

async function main() {
  const sizes = [16, 32, 48];
  writeFileSync(`${dir}/favicon.ico`, ico(await Promise.all(sizes.map(async (size) => ({ size, data: await png(size) })))));
  writeFileSync(`${dir}/apple-icon.png`, await sharp(icon).resize(180, 180).flatten({ background: NAVY }).png().toBuffer());
  const tile = await sharp(icon).resize(260, 260).png().toBuffer();
  writeFileSync(`${dir}/opengraph-image.png`, await sharp(Buffer.from(ogText)).composite([{ input: tile, left: 140, top: 185 }]).png().toBuffer());
}

void main();
