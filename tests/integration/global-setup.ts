import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";
import { startFakeS3 } from "../support/fake-s3";

declare module "vitest" {
  export interface ProvidedContext {
    s3Endpoint: string;
  }
}

/**
 * Before the integration project runs: migrate the test database once, and
 * point the storage layer at a real S3 service (TEST_S3_ENDPOINT, as in CI) or at the
 * in-memory stand-in started here.
 */
export default async function globalSetup(project: TestProject) {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://linkdeck:linkdeck@127.0.0.1:5432/linkdeck_test";
  process.env.DATABASE_URL = url;
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });

  const fake = process.env.TEST_S3_ENDPOINT ? null : await startFakeS3();
  project.provide("s3Endpoint", process.env.TEST_S3_ENDPOINT ?? fake!.url);
  return async () => {
    await fake?.close();
  };
}
