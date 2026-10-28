/**
 * Takes the README screenshots against a running server on a freshly seeded database (demo
 * profiles only, no admin yet: the script completes /setup itself with a code it issues).
 *
 *   npm run build && node .next/standalone/server.js   (PORT=3100, DATABASE_URL and S3_* pointing at seeded stores)
 *   npx tsx scripts/screenshots.ts                      (DATABASE_URL from .env, pointing at the same database)
 */
import "dotenv/config";
import { chromium, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { issueSetupCode } from "../src/lib/data/setup";
import { prisma } from "../src/lib/db";

const base = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const out = "docs/screenshots";
const PASSWORD = "correct horse battery staple";

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

  // Nothing public shows before the admin exists, so first run through /setup with a fresh code.
  const stamp = Date.now().toString(36);
  const admin = { username: `andrea${stamp}`, email: `andrea-${stamp}@example.com` };
  const code = await issueSetupCode();
  if (!code) throw new Error("The database already has an admin: screenshots need a freshly seeded one");
  await page.goto(`${base}/setup`);
  await page.getByLabel("Setup code").fill(code);
  await page.getByLabel("Username").fill(admin.username);
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create the admin account" }).click();
  await page.waitForURL(/\/dashboard$/);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/$/);

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

  // The same editor in dark mode, scrolled to the folders and the social icons.
  // By role: the login page lingers hidden in the DOM after the redirect, with a toggle of its own.
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await page.getByTestId("socials-editor").evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shot(page, `${out}/editor-dark.png`);
  await page.getByRole("button", { name: "Switch to light mode" }).click();

  await page.goto(`${base}/dashboard/stats`);
  await page.getByTestId("clicks-per-link").waitFor();
  await shot(page, `${out}/stats.png`);

  await page.goto(`${base}/dashboard/appearance`);
  await page.getByTestId("theme-builder").waitFor();
  await shot(page, `${out}/appearance.png`);

  await page.goto(`${base}/themes`);
  await page.getByTestId("gallery-card").first().waitFor();
  await shot(page, `${out}/gallery.png`);

  // Sign-up requests come from a second, logged-out context; the admin created above reviews them.
  await page.goto(`${base}/dashboard`);
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/$/);
  await page.goto(`${base}/login`);
  await page.getByLabel("Email").fill(admin.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/dashboard$/);

  const visitor = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })).newPage();
  const requests = [
    { username: `marie${stamp}`, email: `marie-${stamp}@example.com` },
    { username: `alan${stamp}`, email: `alan-${stamp}@example.com` },
    { username: `nope${stamp}`, email: `nope-${stamp}@example.com` },
  ];
  for (const who of requests) {
    await visitor.goto(`${base}/signup`);
    await visitor.getByLabel("Username").fill(who.username);
    await visitor.getByLabel("Email").fill(who.email);
    await visitor.getByLabel("Password").fill(PASSWORD);
    await visitor.getByRole("button", { name: "Request my page" }).click();
    await visitor.getByTestId("request-sent").waitFor();
  }

  await page.goto(`${base}/dashboard/requests`);
  await page.getByTestId("pending-requests").waitFor();
  await page.getByRole("button", { name: `Deny ${requests[2].username}`, exact: true }).click();
  await page.getByTestId("decided-requests").getByTestId("request-row").filter({ hasText: requests[2].username }).waitFor();
  await shot(page, `${out}/requests.png`);

  await visitor.goto(`${base}/login`);
  await visitor.getByLabel("Email").fill(requests[2].email);
  await visitor.getByLabel("Password").fill(PASSWORD);
  await visitor.getByRole("button", { name: "Log in" }).click();
  await visitor.getByTestId("toast").waitFor();
  await shot(visitor, `${out}/login-denied.png`);
  await visitor.context().close();
  await desktop.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
  const mobile = await phone.newPage();
  await mobile.goto(`${base}/ada`);
  await mobile.getByRole("heading", { name: "Ada Lovelace" }).waitFor();
  await shot(mobile, `${out}/public-page.png`);
  // The collapsed folder, opened: its row grows into a box holding the links.
  const folder = mobile.locator("details[data-folder]").first();
  await folder.locator("summary").click();
  await mobile.waitForTimeout(400); // the chevron finishes turning
  await mobile.mouse.move(0, 0);
  await folder.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await shot(mobile, `${out}/folder-open.png`);
  await phone.close();

  await browser.close();
  console.log(`Saved screenshots to ${out}/`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
