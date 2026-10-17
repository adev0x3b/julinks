import { afterAll, beforeEach } from "vitest";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://linkdeck:linkdeck@127.0.0.1:5432/linkdeck_test";

const { prisma } = await import("@/lib/db");

/** Every test starts from an empty database. Cascades delete links and clicks. */
beforeEach(async () => {
  await prisma.user.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
