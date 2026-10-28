import { afterAll, beforeEach, inject } from "vitest";

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://julinks:julinks@127.0.0.1:5432/julinks_test";
process.env.S3_ENDPOINT = inject("s3Endpoint");
process.env.S3_BUCKET = process.env.TEST_S3_BUCKET ?? "julinks-test";
process.env.S3_ACCESS_KEY_ID ??= "julinks";
process.env.S3_SECRET_ACCESS_KEY ??= "julinks-secret";

const { prisma } = await import("@/lib/db");

/** Every test starts from an empty database. Cascades delete links, clicks and themes. */
beforeEach(async () => {
  await prisma.user.deleteMany();
  await prisma.setupCode.deleteMany();
  await prisma.mailOutbox.deleteMany();
});

afterAll(async () => {
  await prisma.$disconnect();
});
