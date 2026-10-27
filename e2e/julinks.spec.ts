import { expect, test, type Page } from "@playwright/test";
import { SignJWT } from "jose";
import pg from "pg";
import sharp from "sharp";
import { E2E_DATABASE_URL, E2E_SESSION_SECRET } from "../playwright.config";

const run = Date.now().toString(36);
const user = {
  username: `e2e${run}`,
  email: `e2e-${run}@example.com`,
  password: "correct horse battery staple",
  // A new account's display name starts as its username.
  displayName: `e2e${run}`,
};
// Two more sign-ups: one gets approved as a client, one denied.
const newcomer = { username: `new${run}`, email: `new-${run}@example.com`, password: "correct horse battery staple" };
const refused = { username: `nope${run}`, email: `nope-${run}@example.com`, password: "correct horse battery staple" };

type Credentials = { username: string; email: string; password: string };

/** Asks for a page; invite only, so this ends on the "waiting for approval" confirmation, not the dashboard. */
async function requestPage(page: Page, who: Credentials) {
  await page.goto("/signup");
  await page.getByLabel("Username").fill(who.username);
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Request my page" }).click();
  await expect(page.getByTestId("request-sent")).toContainText(`/${who.username}`);
}

async function submitLogin(page: Page, who: { email: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Log in" }).click();
}

async function loginAs(page: Page, who: { email: string; password: string }) {
  await submitLogin(page, who);
  await expect(page).toHaveURL(/\/dashboard$/);
  // The login page's markup lingers until the dashboard has streamed in; wait for its header.
  await expect(page.getByRole("banner").getByRole("button", { name: "Log out" })).toBeVisible();
}

async function login(page: Page) {
  await loginAs(page, user);
}

async function logout(page: Page) {
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
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

// The chain starts from "only the demo profiles exist", so the first sign-up becomes the admin.
// Done here rather than in a global setup because a retry re-runs the whole serial chain and must start clean too.
test.beforeAll(async () => {
  const client = new pg.Client({ connectionString: E2E_DATABASE_URL });
  await client.connect();
  try {
    await client.query('delete from users where "isDemo" = false');
  } finally {
    await client.end();
  }
});

test("landing page shows the seeded demo profile", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /One link for everything/ })).toBeVisible();
  await page.getByRole("link", { name: "See an example" }).click();
  await expect(page).toHaveURL(/\/ada$/);
  await expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Poetical science" })).toHaveAttribute("href", /^\/l\//);
});

test("invite only: the first real account is the admin, requests wait for approval, denied ones are told so at login", async ({ page }) => {
  // The database holds only the seeded demo profiles, which do not count: this sign-up becomes the admin and lands in the dashboard.
  await page.goto("/signup");
  await page.getByLabel("Username").fill(user.username);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Request my page" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("requests-nav")).toBeVisible();
  await expect(page.getByTestId("requests-count")).toHaveCount(0);
  await logout(page);

  await requestPage(page, newcomer);
  await requestPage(page, refused);

  // A pending request cannot log in yet; the toast says so.
  await submitLogin(page, newcomer);
  await expect(page.getByTestId("toast")).toContainText("waiting for approval");
  await expect(page).toHaveURL(/\/login$/);
  // Nor does it have a public page.
  await page.goto(`/${newcomer.username}`);
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();

  // The admin sees both requests, approves one as a client and denies the other.
  await login(page);
  await expect(page.getByTestId("requests-count")).toHaveText("2");
  await page.getByTestId("requests-nav").click();
  await expect(page).toHaveURL(/\/dashboard\/requests$/);
  const pendingRows = page.getByTestId("pending-requests").getByTestId("request-row");
  await expect(pendingRows).toHaveCount(2);
  // Demo profiles are not requests.
  await expect(page.getByTestId("request-row").filter({ hasText: "/ada" })).toHaveCount(0);
  await page.getByLabel(`Role for ${newcomer.username}`).selectOption("client");
  await page.getByRole("button", { name: `Approve ${newcomer.username}` }).click();
  await expect(page.getByTestId("decided-requests").getByTestId("request-row").filter({ hasText: `/${newcomer.username}` })).toHaveAttribute("data-status", "approved");
  await page.getByRole("button", { name: `Deny ${refused.username}` }).click();
  await expect(page.getByTestId("decided-requests").getByTestId("request-row").filter({ hasText: `/${refused.username}` })).toHaveAttribute("data-status", "denied");
  await expect(page.getByTestId("no-pending")).toBeVisible();
  await expect(page.getByTestId("requests-count")).toHaveCount(0);
  await logout(page);

  // Denied: a toast at login, no session.
  await submitLogin(page, refused);
  await expect(page.getByTestId("toast")).toContainText("has been denied");
  await expect(page).toHaveURL(/\/login$/);

  // Approved: logs in normally, and clients never see the Requests page.
  await loginAs(page, newcomer);
  await expect(page.getByTestId("requests-nav")).toHaveCount(0);
  await page.goto("/dashboard/requests");
  await expect(page.getByRole("heading", { name: "Nothing here" })).toBeVisible();
  // Leave the browser logged out so the next test logs in as the admin again.
  await page.goto("/dashboard");
  await logout(page);
});

test("edit links and profile, and see the public page update", async ({ page }) => {
  await login(page);

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
  const links = page.getByRole("list", { name: "Links", exact: true }).getByRole("link");
  await expect(links).toHaveText(["My blog", "GitHub"]);

  // Disable one: the cached public page must be refreshed.
  await page.goto("/dashboard");
  await page.getByRole("switch", { name: "Disable GitHub" }).click();
  // The switch flips optimistically and stays disabled until the server has saved; navigating earlier would abort the save.
  await expect(page.getByRole("switch", { name: "Enable GitHub" })).toBeEnabled();
  await page.goto(`/${user.username}`);
  await expect(page.getByRole("list", { name: "Links", exact: true }).getByRole("link")).toHaveText(["My blog"]);

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

test("pictures: avatar and link pictures are stored, served, laid out and centred on the public page", async ({ page }) => {
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

  // Avatar focal point: "Adjust" opens the picker; clicking near the top-left corner moves the point there.
  await page.getByRole("button", { name: "Adjust" }).click();
  const avatarArea = page.getByTestId("avatar-adjust").getByTestId("focal-point-area");
  const avatarBox = (await avatarArea.boundingBox())!;
  await avatarArea.click({ position: { x: avatarBox.width * 0.1, y: avatarBox.height * 0.2 } });
  await expect(avatar).toHaveCSS("object-position", "10% 20%");
  await expect(page.getByTestId("avatar-adjust").getByRole("status")).toHaveText("Saved");
  await page.getByRole("button", { name: "Done" }).click();

  // Link picture: the square opens the panel; uploading there turns the panel into the picture's settings.
  await page.getByRole("button", { name: "Add picture for My new blog" }).click();
  await page.getByLabel("Picture file for My new blog").setInputFiles(await pngFile("thumb.png", 640, 400, "#00aa55"));
  await expect(page.getByTestId("link-row").filter({ hasText: "My new blog" }).getByTestId("link-thumbnail")).toBeVisible();
  const panel = page.getByTestId("picture-panel");
  await panel.getByText("Big, above the title").click();
  await expect(panel.getByLabel(/^Big, above the title/)).toBeChecked();
  const linkArea = panel.getByTestId("focal-point-area");
  const linkBox = (await linkArea.boundingBox())!;
  await linkArea.click({ position: { x: linkBox.width * 0.9, y: linkBox.height * 0.5 } });
  await expect(panel.getByTestId("focal-point-preview")).toHaveCSS("object-position", "90% 50%");
  // The live preview switches to the big layout straight away; the settings save after a short pause.
  await expect(page.locator("[data-layout='featured']").first()).toBeVisible();
  await expect(panel.getByRole("status")).toHaveText("Saved");

  await page.goto(`/${user.username}`);
  await expect(page.locator("img.jl-avatar")).toHaveAttribute("src", avatarSrc);
  await expect(page.locator("img.jl-avatar")).toHaveCSS("object-position", "10% 20%");
  const blog = page.getByRole("link", { name: "My new blog" });
  await expect(blog).toHaveAttribute("data-layout", "featured");
  await expect(blog.locator("img")).toHaveAttribute("src", /^\/img\/thumbnails\//);
  await expect(blog.locator("img")).toHaveCSS("object-position", "90% 50%");

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

test("a link's own preview image becomes its picture: on its own after adding, and on demand", async ({ page, baseURL }) => {
  await login(page);
  // The seeded /ada page advertises Ada's avatar as og:image, so a link to it gets a picture without any upload.
  await addLink(page, "Ada's page", `${baseURL}/ada`);
  const row = page.getByTestId("link-row").filter({ hasText: "Ada's page" });
  // The automatic grab runs after the add has answered; the editor shows it on the next load.
  await expect
    .poll(async () => {
      await page.reload();
      return row.getByTestId("link-thumbnail").count();
    }, { timeout: 15_000 })
    .toBe(1);
  const first = await row.getByTestId("link-thumbnail").getAttribute("src");
  expect(first).toMatch(/^\/img\/thumbnails\//);

  // On demand, from the picture panel.
  await row.getByRole("button", { name: "Picture settings for Ada's page" }).click();
  await page.getByRole("button", { name: "Grab picture from the link Ada's page" }).click();
  await expect(page.getByRole("button", { name: "Grab picture from the link Ada's page" })).toBeEnabled();
  await expect(page.getByTestId("picture-panel").getByRole("alert")).toHaveCount(0);
  await expect(row.getByTestId("link-thumbnail")).toHaveAttribute("src", first!);

  // A page with no preview image says so instead of failing silently.
  await addLink(page, "Nothing here", `${baseURL}/themes`);
  const bare = page.getByTestId("link-row").filter({ hasText: "Nothing here" });
  await bare.getByRole("button", { name: "Add picture for Nothing here" }).click();
  await page.getByRole("button", { name: "Grab picture from the link Nothing here" }).click();
  await expect(page.getByTestId("picture-panel").getByRole("alert")).toContainText("does not advertise");
  page.on("dialog", (d) => d.accept());
  await bare.getByRole("button", { name: "Delete Nothing here" }).click();
  await expect(page.getByTestId("link-row")).toHaveCount(3);
  await page.getByRole("button", { name: "Delete Ada's page" }).click();
  await expect(page.getByTestId("link-row")).toHaveCount(2);
});

test("bio lines, social icons and folders show on the public page", async ({ page }) => {
  await login(page);

  // Bio with a line break: the emoji row stays under the text.
  await page.getByLabel("Bio").fill("Testing all the things\n✨ 🎨");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  // Social icons: a handle and an email, saved as a row.
  await page.getByRole("button", { name: "Add icon" }).click();
  await page.getByLabel("Instagram handle or URL").fill("@e2e");
  await page.getByRole("button", { name: "Add icon" }).click();
  await page.getByLabel("Email handle or URL").fill("not-an-address");
  await page.getByRole("button", { name: "Save icons" }).click();
  await expect(page.getByTestId("socials-editor").getByRole("alert")).toContainText("Email address");
  await page.getByLabel("Email handle or URL").fill("e2e@example.com");
  await page.getByRole("button", { name: "Save icons" }).click();
  await expect(page.getByText("Icons saved")).toBeVisible();

  // Folders: create one, put a link in it.
  await page.getByLabel("Folder name").fill("Articles");
  await page.getByRole("button", { name: "Add folder" }).click();
  await expect(page.getByTestId("folder-row")).toHaveCount(1);
  await page.getByLabel("Folder for My new blog").selectOption({ label: "Articles" });
  // The preview groups it straight away.
  await expect(page.locator("[data-theme] [data-folder]")).toHaveAttribute("data-collapsed", "false");

  await page.goto(`/${user.username}`);
  const bio = page.getByText(/Testing all the things/);
  await expect(bio).toHaveCSS("white-space", "pre-line");
  expect(await bio.textContent()).toBe("Testing all the things\n✨ 🎨");
  const icons = page.getByRole("list", { name: "Social links" }).getByRole("link");
  await expect(icons).toHaveCount(2);
  await expect(icons.nth(0)).toHaveAttribute("href", "https://instagram.com/e2e");
  await expect(icons.nth(1)).toHaveAttribute("href", "mailto:e2e@example.com");
  await expect(page.getByRole("heading", { level: 2, name: "Articles" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Articles" }).getByRole("link", { name: "My new blog" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Links", exact: true }).getByRole("link", { name: "My new blog" })).toHaveCount(0);

  // Collapsed: the folder becomes a row that opens on tap.
  await page.goto("/dashboard");
  await page.getByLabel("Collapse Articles on the page").check();
  await expect(page.getByTestId("folder-row")).toHaveAttribute("data-collapsed", "true");
  await page.goto(`/${user.username}`);
  const folder = page.locator("details[data-folder]");
  await expect(folder).toBeVisible();
  await expect(folder.getByRole("link", { name: "My new blog" })).toBeHidden();
  await folder.locator("summary").click();
  await expect(folder.getByRole("link", { name: "My new blog" })).toBeVisible();

  // Deleting the folder sends the link back to the main list.
  await page.goto("/dashboard");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete folder Articles" }).click();
  await expect(page.getByTestId("folder-row")).toHaveCount(0);
  await page.goto(`/${user.username}`);
  await expect(page.getByRole("list", { name: "Links", exact: true }).getByRole("link", { name: "My new blog" })).toBeVisible();
});

test("dark mode is a toggle that sticks", async ({ page }) => {
  await login(page);
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("banner").getByTestId("theme-toggle").click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await page.goto("/login/expired");
  await page.goto("/login");
  await expect(html).toHaveClass(/dark/);
  await page.getByTestId("theme-toggle").click();
  await expect(html).not.toHaveClass(/dark/);
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
  await expect(page.getByRole("list", { name: "Links", exact: true }).getByRole("link")).toHaveText(["GitHub", "My new blog"]);
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
