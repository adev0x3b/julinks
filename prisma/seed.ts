/**
 * Seeds the demo profiles linked from the landing page (/ada, /grace), each
 * with a theme of their own published to the gallery, an avatar and link
 * pictures. Idempotent: running it twice leaves the same two users, links,
 * themes and images (keys are content-addressed, so re-uploads are no-ops).
 *
 *   npm run db:seed     (needs DATABASE_URL and the S3_* variables)
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { PrismaClient } from "../src/generated/prisma/client";
import { imageKey, processImage } from "../src/lib/images";
import { putObject } from "../src/lib/storage";
import type { ThemeTokens } from "../src/lib/themes";
import type { ImageKind } from "../src/lib/validation";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

export const DEMO_USER = {
  username: "ada",
  email: "ada@example.com",
  password: "analytical-engine",
  displayName: "Ada Lovelace",
  bio: "Analyst, metaphysician, and founder of scientific computing.",
};

type DemoUser = typeof DEMO_USER & {
  avatar: { from: string; to: string };
  theme: { name: string; tokens: ThemeTokens; background: string | null };
  links: { title: string; url: string; shape: Shape; colour: string; featured?: boolean; focus?: { x: number; y: number } }[];
  clicks: boolean;
};

const DEMO_USERS: DemoUser[] = [
  {
    ...DEMO_USER,
    avatar: { from: "#f0abfc", to: "#7e22ce" },
    theme: {
      name: "Poetical Science",
      tokens: {
        background: "#2e1065",
        backgroundEnd: "#701a75",
        text: "#fdf4ff",
        muted: "#e9d5ff",
        button: "#f0abfc",
        buttonText: "#2e1065",
        buttonStyle: "solid",
        radius: "pill",
        font: "serif",
        overlay: 35,
      },
      background: blobs(["#c084fc", "#f472b6", "#818cf8"], "#3b0764"),
    },
    links: [
      {
        title: "Notes on the Analytical Engine",
        url: "https://en.wikipedia.org/wiki/Analytical_engine",
        shape: "ring",
        colour: "#7e22ce",
        featured: true,
        focus: { x: 30, y: 50 },
      },
      { title: "Poetical science", url: "https://en.wikipedia.org/wiki/Ada_Lovelace", shape: "diamond", colour: "#db2777" },
      { title: "Letters to Babbage", url: "https://en.wikipedia.org/wiki/Charles_Babbage", shape: "bars", colour: "#4f46e5" },
    ],
    clicks: true,
  },
  {
    username: "grace",
    email: "grace@example.com",
    password: "cobol-compiler",
    displayName: "Grace Hopper",
    bio: "Rear admiral, compiler pioneer, finder of the first bug.",
    avatar: { from: "#7dd3fc", to: "#0c4a6e" },
    theme: {
      name: "Navy Compiler",
      tokens: {
        background: "#0c1a3a",
        backgroundEnd: null,
        text: "#e2e8f0",
        muted: "#7dd3fc",
        button: "#38bdf8",
        buttonText: "#38bdf8",
        buttonStyle: "outline",
        radius: "small",
        font: "mono",
        overlay: 50,
      },
      background: null,
    },
    links: [
      { title: "A nanosecond, in wire", url: "https://en.wikipedia.org/wiki/Grace_Hopper", shape: "ring", colour: "#0284c7" },
      { title: "COBOL", url: "https://en.wikipedia.org/wiki/COBOL", shape: "bars", colour: "#0f766e" },
    ],
    clicks: false,
  },
];

async function main() {
  for (const demo of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(demo.password, 12);
    const user = await prisma.user.upsert({
      where: { username: demo.username },
      update: { displayName: demo.displayName, bio: demo.bio },
      create: { username: demo.username, email: demo.email, displayName: demo.displayName, bio: demo.bio, passwordHash },
    });
    // Keys are derived from the user id, so the avatar is stored once the id is known.
    const avatarKey = await store("avatar", user.id, avatarSvg(demo.avatar));
    await prisma.user.update({ where: { id: user.id }, data: { avatarKey } });

    await prisma.theme.deleteMany({ where: { ownerId: user.id } });
    const backgroundKey = demo.theme.background ? await store("background", user.id, demo.theme.background) : null;
    const theme = await prisma.theme.create({
      data: { ownerId: user.id, name: demo.theme.name, tokens: demo.theme.tokens, backgroundKey, isPublic: true, publishedAt: new Date() },
    });
    await prisma.user.update({ where: { id: user.id }, data: { themeId: theme.id } });

    await prisma.link.deleteMany({ where: { userId: user.id } });
    for (const [position, link] of demo.links.entries()) {
      // A featured link gets a wide picture, centred off to one side to show the focal point at work.
      const thumbnailKey = await store("thumbnail", user.id, link.featured ? bannerSvg(link.shape, link.colour) : tileSvg(link.shape, link.colour));
      await prisma.link.create({
        data: {
          userId: user.id,
          title: link.title,
          url: link.url,
          position,
          thumbnailKey,
          imageLayout: link.featured ? "featured" : "thumbnail",
          imageFocusX: link.focus?.x ?? 50,
          imageFocusY: link.focus?.y ?? 50,
        },
      });
    }
    if (demo.clicks) {
      const links = await prisma.link.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } });
      await prisma.click.createMany({ data: demoClicks(links.map((l) => l.id)) });
    }
    console.log(`Seeded /${user.username}: ${demo.links.length} links, theme "${demo.theme.name}" published`);
  }
}

/** Renders an SVG to PNG, runs it through the same pipeline as an upload, and stores it. */
async function store(kind: ImageKind, ownerId: string, svg: string): Promise<string> {
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const processed = await processImage(png, kind);
  const key = imageKey(kind, ownerId, processed.data);
  await putObject(key, processed.data, processed.contentType);
  return key;
}

type Shape = "ring" | "diamond" | "bars";

// Shapes only, no text: the migrate container has no fonts for SVG text to render with.
function avatarSvg({ from, to }: { from: string; to: string }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
    <rect width="512" height="512" fill="url(#g)"/>
    <circle cx="256" cy="190" r="96" fill="#ffffff" fill-opacity="0.85"/>
    <path d="M70 512 C 70 360, 442 360, 442 512 Z" fill="#ffffff" fill-opacity="0.85"/>
  </svg>`;
}

const SHAPES: Record<Shape, string> = {
  ring: '<circle cx="80" cy="80" r="40" fill="none" stroke="#ffffff" stroke-width="18"/>',
  diamond: '<rect x="44" y="44" width="72" height="72" fill="#ffffff" transform="rotate(45 80 80)"/>',
  bars: '<rect x="36" y="40" width="88" height="16" rx="8" fill="#ffffff"/><rect x="36" y="72" width="60" height="16" rx="8" fill="#ffffff"/><rect x="36" y="104" width="76" height="16" rx="8" fill="#ffffff"/>',
};

function tileSvg(shape: Shape, colour: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" rx="32" fill="${colour}"/>${SHAPES[shape]}</svg>`;
}

/** A wide picture for a featured link: the tile's shape sits in the left third, so a focal point of 30% keeps it in frame. */
function bannerSvg(shape: Shape, colour: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="${colour}"/><circle cx="900" cy="300" r="260" fill="#ffffff" fill-opacity="0.12"/><g transform="translate(200 220) scale(1)">${SHAPES[shape]}</g></svg>`;
}

function blobs(colours: string[], base: string) {
  const circles = colours
    .map((c, i) => `<circle cx="${300 + i * 500}" cy="${250 + (i % 2) * 400}" r="420" fill="${c}" fill-opacity="0.55"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="${base}"/>${circles}</svg>`;
}

const REFERRERS = ["twitter.com", "github.com", "linkedin.com", null, null, null];
const DAY = 24 * 60 * 60 * 1000;

/** Deterministic pseudo-random click history over the last 30 days so the stats page has something to show. */
function demoClicks(linkIds: string[]) {
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const now = Date.now();
  const clicks: { linkId: string; referrer: string | null; createdAt: Date }[] = [];
  for (let day = 0; day < 30; day++) {
    const perDay = Math.floor(random() * 8) + (day < 7 ? 3 : 0);
    for (let i = 0; i < perDay; i++) {
      clicks.push({
        linkId: linkIds[Math.floor(random() * linkIds.length)],
        referrer: REFERRERS[Math.floor(random() * REFERRERS.length)],
        createdAt: new Date(now - day * DAY - Math.floor(random() * DAY)),
      });
    }
  }
  return clicks;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
