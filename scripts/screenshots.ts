/**
 * Takes the README screenshots against a running server seeded with the demo user.
 *
 *   npm run build && node .next/standalone/server.js   (PORT=3100, DATABASE_URL and S3_* pointing at seeded stores)
 *   npx tsx scripts/screenshots.ts
 */
import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const out = "docs/screenshots";

/** Pictures come from object storage; a shot taken before they land shows empty frames. */
async function shot(page: Page, path: string) {
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete && img.naturalWidth > 0));
  await page.screenshot({ path });
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();

  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();

  await page.goto(`${base}/`);
  await shot(page, `${out}/landing.png`);

  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByLabel("Password").fill("analytical-engine");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.getByTestId("link-row").first().waitFor();
  // Open the first link's picture settings so the small/big choice and the focal point picker are in the shot.
  await page.getByRole("button", { name: /^Picture settings for/ }).first().click();
  await page.getByTestId("picture-panel").waitFor();
  // Scroll so the whole panel is in the viewport; the live preview is sticky and stays in the shot.
  await page.getByTestId("picture-panel").evaluate((el) => el.scrollIntoView({ block: "end" }));
  await shot(page, `${out}/editor.png`);

  await page.goto(`${base}/dashboard/stats`);
  await page.getByTestId("clicks-per-link").waitFor();
  await shot(page, `${out}/stats.png`);

  await page.goto(`${base}/dashboard/appearance`);
  await page.getByTestId("theme-builder").waitFor();
  await shot(page, `${out}/appearance.png`);

  await page.goto(`${base}/themes`);
  await page.getByTestId("gallery-card").first().waitFor();
  await shot(page, `${out}/gallery.png`);
  await desktop.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const mobile = await phone.newPage();
  await mobile.goto(`${base}/ada`);
  await mobile.getByRole("heading", { name: "Ada Lovelace" }).waitFor();
  await shot(mobile, `${out}/public-page.png`);
  await phone.close();

  await browser.close();
  console.log(`Saved screenshots to ${out}/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
