import { expect, test as setup } from "@playwright/test";

const authFile = "e2e/.auth/admin.json";

setup("authenticate as the seeded admin user", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    data: { username: "admin", password: "admin-e2e-password" },
  });
  expect(response.ok()).toBeTruthy();
  await request.storageState({ path: authFile });
});
