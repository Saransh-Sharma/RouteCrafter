import { defineConfig, devices } from "@playwright/test";

// Manual production audit only. Requires ROUTECRAFTER_PROD_AUDIT=1 — see prod-e2e/README.md.
delete process.env.NO_COLOR;

export default defineConfig({
  testDir: "./prod-e2e",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  timeout: 14_400_000,
  retries: 0,
  expect: {
    timeout: 30_000,
  },
  reporter: "list",
  outputDir: "test-results/production",
  use: {
    baseURL:
      process.env.ROUTECRAFTER_PROD_BASE_URL ??
      "https://route-crafter.vercel.app",
    actionTimeout: 45_000,
    navigationTimeout: 60_000,
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "on",
    screenshot: "on",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "production-chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
