import { expect, test, type Page } from "@playwright/test";
import { SignJWT } from "jose";
import sharp from "sharp";
import { E2E_SESSION_SECRET } from "./session-secret";

const run = Date.now().toString(36);
const user = {
  username: `e2e${run}`,
  email: `e2e-${run}@example.com`,
  password: "correct horse battery staple",
  displayName: "E2E Tester",
};

async function signup(page: Page) {
  await page.goto("/signup");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Display name").fill(user.displayName);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Create my page" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** A solid-colour PNG made on the fly, so the repo carries no binary fixtures. */
async function pngFile(name: string, width: number, height: number, background: string) {
  const buffer = await sharp({ create: { width, height, channels: 3, background } })
    .png()
    .toBuffer();
  return { name, mimeType: "image/png", buffer };
}

async function addLink(page: Page, title: string, url: string) {
  await page.getByPlaceholder("Title").fill(title);
  await page.getByPlaceholder("https://…").fill(url);
  await page.getByRole("button", { name: "Add link" }).click();
  await expect(page.getByTestId("link-row").filter({ hasText: title })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("landing page shows the seeded demo profile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /One link for everything/ })).toBeVisible();
  await page.getByRole("link", { name: "See an example" }).click();
  await expect(page).toHaveURL(/\/ada$/);
  await expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Poetical science" })).toHaveAttribute("href", /^\/l\//);
});

test("signup, edit links and profile, and see the public page update", async ({ page }) => {
  await signup(page);

  // Empty state, then two links.
  await expect(page.getByText("Add your first link above.")).toBeVisible();
  await addLink(page, "My blog", "https://example.com/blog");
  await addLink(page, "GitHub", "github.com/adev0x3b");
  await expect(page.getByTestId("link-row")).toHaveCount(2);
  await expect(page.getByTestId("link-row").nth(1)).toContainText("https://github.com/adev0x3b");

  // Live preview reflects both links before leaving the page.
  const preview = page.locator("[data-theme]");
  await expect(preview.getByRole("button", { name: "My blog" })).toBeVisible();
  await expect(preview.getByRole("button", { name: "GitHub" })).toBeVisible();

  // Public page shows both, in order.
  await page.goto(`/${user.username}`);
  await expect(page.getByRole("heading", { name: user.displayName })).toBeVisible();
  const links = page.getByRole("list", { name: "Links" }).getByRole("link");
  await expect(links).toHaveText(["My blog", "GitHub"]);

  // Disable one: the cached public page must be refreshed.
  await page.goto("/dashboard");
  await page.getByRole("switch", { name: "Disable GitHub" }).click();
  await expect(page.getByRole("switch", { name: "Enable GitHub" })).toBeVisible();
  await page.goto(`/${user.username}`);
  await expect(page.getByRole("list", { name: "Links" }).getByRole("link")).toHaveText(["My blog"]);

  // Edit title and URL inline.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Edit My blog" }).click();
  const row = page.getByTestId("link-row").first();
  await row.getByLabel("Title").fill("My new blog");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("link-row").filter({ hasText: "My new blog" })).toBeVisible();

  // Profile: display name and bio.
  await page.getByLabel("Display name").fill("Ada Two");
  await page.getByLabel("Bio").fill("Testing all the things");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.goto(`/${user.username}`);
  await expect(page.getByRole("heading", { name: "Ada Two" })).toBeVisible();
  await expect(page.getByText("Testing all the things")).toBeVisible();
  await expect(page.locator("[data-theme]")).toHaveAttribute("data-theme", "Midnight");
});

test("pictures: avatar and link thumbnails are stored, served and shown on the public page", async ({ page }) => {
  await login(page);

  // Avatar: choosing a file uploads it; the editor and the public page show the stored WebP.
  await page.getByLabel("Upload avatar").setInputFiles(await pngFile("avatar.png", 300, 200, "#8800ff"));
  const avatar = page.getByTestId("avatar-image");
  await expect(avatar).toBeVisible();
  const avatarSrc = (await avatar.getAttribute("src"))!;
  expect(avatarSrc).toMatch(/^\/img\/avatars\/[a-z0-9]+\/[a-f0-9]{24}\.webp$/);
  const served = await page.request.get(avatarSrc);
  expect(served.status()).toBe(200);
  expect(served.headers()["content-type"]).toBe("image/webp");
  expect(served.headers()["cache-control"]).toContain("immutable");

  // A file that is not an image is refused with a message.
  await page.getByLabel("Upload avatar").setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await expect(page.getByText("Upload a PNG, JPEG or WebP image")).toBeVisible();

  // Link thumbnail.
  await page.getByLabel("Picture file for My new blog").setInputFiles(await pngFile("thumb.png", 64, 64, "#00aa55"));
  await expect(page.getByTestId("link-thumbnail")).toBeVisible();

  await page.goto(`/${user.username}`);
  await expect(page.locator("img.jl-avatar")).toHaveAttribute("src", avatarSrc);
  await expect(page.getByRole("link", { name: "My new blog" }).locator("img")).toHaveAttribute("src", /^\/img\/thumbnails\//);

  // Remove the avatar: initials come back.
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(page.getByTestId("avatar-image")).toHaveCount(0);
  await page.goto(`/${user.username}`);
  await expect(page.locator("img.jl-avatar")).toHaveCount(0);

  // Unknown or malformed keys are 404s, never errors.
  expect((await page.request.get("/img/avatars/x/000000000000000000000000.webp")).status()).toBe(404);
  expect((await page.request.get("/img/../etc/passwd")).status()).toBe(404);
});

test("themes: start from a preset, customise, publish, and copy from the gallery", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/appearance");
  await expect(page.getByText("Your page uses the default look")).toBeVisible();

  // Start from Sunrise: a theme of our own, active at once.
  await page.getByRole("button", { name: "Sunrise" }).click();
  await expect(page.getByTestId("theme-card")).toHaveCount(1);
  await expect(page.getByTestId("theme-card").first()).toContainText("Active");
  await page.goto(`/${user.username}`);
  await expect(page.locator("[data-theme]")).toHaveAttribute("data-theme", "Sunrise");

  // Customise it: name, a colour, corners, a background image, then save.
  await page.goto("/dashboard/appearance");
  await page.getByLabel("Name", { exact: true }).fill("Sunset Mono");
  await page.getByLabel("Background", { exact: true }).fill("#112233");
  await page.getByLabel("Corners").selectOption("none");
  await page.getByLabel("Font").selectOption("mono");
  const preview = page.locator("[data-theme]");
  await expect(preview).toHaveAttribute("data-theme", "Sunset Mono");
  await expect(preview).toHaveCSS("--jl-radius", "0px");
  await page.getByLabel("Upload background image").setInputFiles(await pngFile("bg.png", 400, 300, "#ffcc00"));
  await expect(page.getByTestId("background-image")).toBeVisible();
  await page.getByRole("button", { name: "Save theme" }).click();
  await expect(page.getByText("Theme saved")).toBeVisible();

  await page.goto(`/${user.username}`);
  const pub = page.locator("[data-theme]");
  await expect(pub).toHaveAttribute("data-theme", "Sunset Mono");
  await expect(pub).toHaveCSS("--jl-radius", "0px");
  const bg = await pub.evaluate((el) => getComputedStyle(el).getPropertyValue("--jl-bg"));
  expect(bg).toContain('url("/img/backgrounds/');
  expect(bg).toContain("#112233");

  // Publish it: it appears in the gallery with attribution.
  await page.goto("/dashboard/appearance");
  await page.getByRole("button", { name: "Publish Sunset Mono" }).click();
  await expect(page.getByTestId("theme-card").first()).toContainText("Public");
  await page.goto("/themes");
  const card = page.getByTestId("gallery-card").filter({ hasText: "Sunset Mono" });
  await expect(card).toBeVisible();
  await expect(card).toContainText(`@${user.username}`);
  // The seeded demo themes are there too.
  await expect(page.getByTestId("gallery-card").filter({ hasText: "Poetical Science" })).toBeVisible();

  // Copy a seeded theme: it becomes ours, active, with the background copied under our prefix.
  await page.getByRole("button", { name: "Use Poetical Science" }).click();
  await expect(page).toHaveURL(/\/dashboard\/appearance\?theme=/);
  await expect(page.getByTestId("theme-card")).toHaveCount(2);
  const copied = page.getByTestId("theme-card").filter({ hasText: "Poetical Science" });
  await expect(copied).toContainText("Active");
  await page.goto(`/${user.username}`);
  await expect(page.locator("[data-theme]")).toHaveAttribute("data-theme", "Poetical Science");
  const copiedBg = await page.locator("[data-theme]").evaluate((el) => getComputedStyle(el).getPropertyValue("--jl-bg"));
  expect(copiedBg).toContain('url("/img/backgrounds/');

  // Unpublish and delete: gallery and page follow.
  await page.goto("/dashboard/appearance");
  await page.getByRole("button", { name: "Unpublish Sunset Mono" }).click();
  await expect(page.getByTestId("theme-card").filter({ hasText: "Sunset Mono" })).not.toContainText("Public");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete Poetical Science" }).click();
  await expect(page.getByTestId("theme-card")).toHaveCount(1);
  await page.goto("/themes");
  await expect(page.getByTestId("gallery-card").filter({ hasText: "Sunset Mono" })).toHaveCount(0);
  await page.goto(`/${user.username}`);
  await expect(page.locator("[data-theme]")).toHaveAttribute("data-theme", "Midnight");
});

test("clicks redirect, are counted, and show up in stats", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto(`/${user.username}`);
  const href = await page.getByRole("link", { name: "My new blog" }).getAttribute("href");
  expect(href).toMatch(/^\/l\//);

  for (let i = 0; i < 3; i++) {
    const response = await page.request.get(href!, { maxRedirects: 0, headers: { referer: "https://news.ycombinator.com/" } });
    expect(response.status()).toBe(302);
    expect(response.headers()["location"]).toBe("https://example.com/blog");
  }

  await expect
    .poll(async () => {
      await page.goto("/dashboard/stats");
      return page.getByTestId("link-clicks").first().textContent();
    })
    .toBe("3");
  await expect(page.getByText("news.ycombinator.com")).toBeVisible();

  // Disabled link does not redirect.
  await page.goto("/dashboard");
  const disabledRow = page.getByTestId("link-row").filter({ hasText: "GitHub" });
  await expect(disabledRow).toBeVisible();
  await page.goto(`/${user.username}`);
  await expect(page.getByRole("link", { name: "GitHub" })).toHaveCount(0);
});

test("dragging a link changes the public order", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByRole("switch", { name: "Enable GitHub" }).click();
  await expect(page.getByRole("switch", { name: "Disable GitHub" })).toBeVisible();

  // Drag the GitHub row's handle onto the first row (PointerSensor activates after 4px).
  const handle = page.getByRole("button", { name: "Drag to reorder GitHub" });
  const from = (await handle.boundingBox())!;
  const target = (await page.getByTestId("link-row").first().boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 - 10, { steps: 3 });
  await page.mouse.move(from.x + from.width / 2, target.y + 4, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByTestId("link-row").first()).toContainText("GitHub");
  await expect(page.getByTestId("order-status")).toHaveText("Order saved");

  await page.goto(`/${user.username}`);
  await expect(page.getByRole("list", { name: "Links" }).getByRole("link")).toHaveText(["GitHub", "My new blog"]);
});

test("auth guards and 404s", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
  const response = await page.goto("/api/health");
  expect(response?.status()).toBe(200);
  await page.goto("/no-such-user-here");
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
  const click = await page.request.get("/l/does-not-exist", { maxRedirects: 0 });
  expect(click.status()).toBe(404);
});

test("a session cookie for a user that no longer exists is cleared instead of looping", async ({ page, context }) => {
  // The token is validly signed, as after a database reset that kept SESSION_SECRET.
  const token = await new SignJWT({ sub: "no-such-user" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(E2E_SESSION_SECRET));
  await context.addCookies([{ name: "julinks_session", value: token, domain: "127.0.0.1", path: "/" }]);

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?expired=1$/);
  await expect(page.getByRole("status")).toHaveText("Your session has expired. Please log in again.");
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === "julinks_session")).toBeUndefined();

  // Without the cookie, /login renders normally and /dashboard bounces to it.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
