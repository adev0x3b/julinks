/**
 * Seeds the demo profile linked from the landing page (/ada). Idempotent:
 * running it twice leaves one user with the same three links.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

export const DEMO_USER = {
  username: "ada",
  email: "ada@example.com",
  password: "analytical-engine",
  displayName: "Ada Lovelace",
  bio: "Analyst, metaphysician, and founder of scientific computing.",
  theme: "midnight",
};

const DEMO_LINKS = [
  { title: "Notes on the Analytical Engine", url: "https://en.wikipedia.org/wiki/Analytical_engine" },
  { title: "Poetical science", url: "https://en.wikipedia.org/wiki/Ada_Lovelace" },
  { title: "Letters to Babbage", url: "https://en.wikipedia.org/wiki/Charles_Babbage" },
];

async function main() {
  const { password, ...profile } = DEMO_USER;
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { username: profile.username },
    update: { displayName: profile.displayName, bio: profile.bio, theme: profile.theme },
    create: { ...profile, passwordHash },
  });
  await prisma.link.deleteMany({ where: { userId: user.id } });
  await prisma.link.createMany({ data: DEMO_LINKS.map((l, position) => ({ ...l, position, userId: user.id })) });
  const links = await prisma.link.findMany({ where: { userId: user.id }, orderBy: { position: "asc" } });
  await prisma.click.createMany({ data: demoClicks(links.map((l) => l.id)) });
  console.log(`Seeded /${user.username} with ${links.length} links and some click history`);
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
