import { expect, test, type Page } from "@playwright/test";

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

  // Profile: display name and theme.
  await page.getByLabel("Display name").fill("Ada Two");
  await page.getByLabel("Bio").fill("Testing all the things");
  await page.getByText("Sunrise", { exact: true }).click();
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.goto(`/${user.username}`);
  await expect(page.getByRole("heading", { name: "Ada Two" })).toBeVisible();
  await expect(page.getByText("Testing all the things")).toBeVisible();
  await expect(page.locator("[data-theme]")).toHaveAttribute("data-theme", "sunrise");
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
