import { execSync } from "node:child_process";

/** Applies migrations to the test database once before the integration project runs. */
export default function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://linkdeck:linkdeck@127.0.0.1:5432/linkdeck_test";
  process.env.DATABASE_URL = url;
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
