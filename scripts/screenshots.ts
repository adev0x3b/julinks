/**
 * Takes the README screenshots against a running server seeded with the demo user.
 *
 *   npx next start -p 3100   (with DATABASE_URL pointing at a seeded database)
 *   npx tsx scripts/screenshots.ts
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const out = "docs/screenshots";

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();

  await page.goto(`${base}/`);
  await page.screenshot({ path: `${out}/landing.png` });

  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("analytical-engine");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.getByTestId("link-row").first().waitFor();
  await page.screenshot({ path: `${out}/editor.png` });

  await page.goto(`${base}/dashboard/stats`);
  await page.getByTestId("clicks-per-link").waitFor();
  await page.screenshot({ path: `${out}/stats.png` });
  await desktop.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const mobile = await phone.newPage();
  await mobile.goto(`${base}/ada`);
  await mobile.getByRole("heading", { name: "Ada Lovelace" }).waitFor();
  await mobile.screenshot({ path: `${out}/public-page.png` });
  await phone.close();

  await browser.close();
  console.log(`Saved screenshots to ${out}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
