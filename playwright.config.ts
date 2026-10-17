import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const databaseUrl = process.env.E2E_DATABASE_URL ?? "postgresql://linkdeck:linkdeck@127.0.0.1:5432/linkdeck_e2e";

/**
 * End-to-end tests run against the production build (`npm run build` first),
 * served the way the Docker image serves it (the standalone server), on its
 * own database. CI builds once, then runs this.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: [
      "npx prisma migrate deploy",
      "npx tsx prisma/seed.ts",
      "cp -r public .next/standalone/ && cp -r .next/static .next/standalone/.next/",
      `PORT=${port} HOSTNAME=127.0.0.1 node .next/standalone/server.js`,
    ].join(" && "),
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      DATABASE_URL: databaseUrl,
      SESSION_SECRET: "e2e-session-secret-that-is-long-enough-123456",
    },
  },
});
