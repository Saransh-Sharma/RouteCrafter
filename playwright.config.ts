import { defineConfig, devices } from "@playwright/test";

delete process.env.NO_COLOR;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  retries: process.env.CI ? 2 : 0,
  expect: {
    timeout: 20_000,
  },
  reporter: "list",
  use: {
    baseURL: "http://localhost:3211",
    permissions: ["clipboard-read", "clipboard-write"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      dependencies: ["setup"],
      testIgnore: /.*\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
    },
  ],
  webServer: {
    command: "npm run dev -- -p 3211",
    url: "http://localhost:3211/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXTAUTH_SECRET: "e2e-secret-that-is-long-enough-for-routecrafter",
      USER_ADMIN_PASSWORD: "admin-e2e-password",
      USER_SARANSH_PASSWORD: "saransh-e2e-password",
      USER_SAUMYA_PASSWORD: "saumya-e2e-password",
    },
  },
});
