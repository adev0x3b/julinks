import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
/** Also imported by the spec that mints a stale session token. Lives here because e2e/ is outside the Docker build context. */
export const E2E_SESSION_SECRET = "e2e-session-secret-that-is-long-enough-123456";
const databaseUrl = process.env.E2E_DATABASE_URL ?? "postgresql://linkdeck:linkdeck@127.0.0.1:5432/linkdeck_e2e";
// Object storage: a real S3 service when E2E_S3_ENDPOINT is set (SeaweedFS in CI), otherwise the in-memory stand-in on the next port.
const fakeS3Port = port + 1;
const s3Endpoint = process.env.E2E_S3_ENDPOINT ?? `http://127.0.0.1:${fakeS3Port}`;
const s3Env = {
  S3_ENDPOINT: s3Endpoint,
  S3_BUCKET: process.env.E2E_S3_BUCKET ?? "julinks-e2e",
  S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ?? "julinks",
  S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ?? "julinks-secret",
};

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
  webServer: [
    ...(process.env.E2E_S3_ENDPOINT
      ? []
      : [
          {
            command: `npx tsx scripts/fake-s3.ts ${fakeS3Port}`,
            url: `http://127.0.0.1:${fakeS3Port}/healthz`,
            reuseExistingServer: !process.env.CI,
            timeout: 30_000,
          },
        ]),
    {
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
        SESSION_SECRET: E2E_SESSION_SECRET,
        ...s3Env,
      },
    },
  ],
});
