import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import path from "node:path";

const alias = { "@": path.resolve(__dirname, "src") };

/**
 * Three test projects:
 *  - unit:        pure functions, no database       (npm test)
 *  - component:   React components in jsdom          (npm test)
 *  - integration: data layer against real PostgreSQL (npm run test:integration)
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
          env: { SESSION_SECRET: "unit-test-secret-that-is-long-enough-123456" },
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "component",
          environment: "jsdom",
          include: ["tests/component/**/*.test.tsx"],
          setupFiles: ["tests/component/setup.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          fileParallelism: false,
          env: { SESSION_SECRET: "integration-test-secret-that-is-long-enough", LINK_PREVIEW_ALLOW_PRIVATE: "1" },
        },
      },
    ],
  },
});
