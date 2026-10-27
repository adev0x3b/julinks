/**
 * Prints a fresh setup code for /setup, replacing the previous one. For a site that
 * already has an admin it prints nothing useful and changes nothing.
 *
 *   npm run setup-code                                            (DATABASE_URL from .env)
 *   docker compose run --rm --no-deps migrate npm run setup-code  (the compose stack)
 */
import "dotenv/config";
import { issueSetupCode } from "../src/lib/data/setup";
import { setupBanner } from "../src/lib/setup-code";
import { prisma } from "../src/lib/db";

async function main() {
  const code = await issueSetupCode();
  if (code) {
    console.log(setupBanner(code, process.env.APP_URL || "http://localhost:3000"));
  } else {
    console.log("This site is already set up: it has an admin account, so no setup code is needed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
