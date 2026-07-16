import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("protects pages and APIs from missing or forged sessions", async ({
  page,
  context,
}) => {
  await page.goto("/products/new?mode=template");
  await expect(page).toHaveURL(
    /\/login\?redirect=%2Fproducts%2Fnew%3Fmode%3Dtemplate$/,
  );

  await context.addCookies([
    {
      name: "rc-session",
      value: "not-a-jwt",
      url: "http://localhost:3211",
    },
  ]);
  const apiResponse = await context.request.post("/api/ai/text", { data: {} });
  expect(apiResponse.status()).toBe(401);

  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login\?redirect=%2Fsettings$/);
});

test("logs in with a password, sanitizes the return path, and logs out", async ({
  page,
}) => {
  await page.goto(
    "/login?redirect=javascript%3Adocument.body.dataset.routecrafterXss%3D%27executed%27",
  );
  await page.getByLabel("Username").fill("admin");
  await page.locator("#login-password").fill("admin-e2e-password");
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") &&
      response.request().method() === "POST",
    { timeout: 60_000 },
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  expect((await loginResponse).status()).toBe(200);

  await expect(page).toHaveURL("http://localhost:3211/");
  expect(
    await page.evaluate(
      () => document.body.dataset.routecrafterXss ?? "not-executed",
    ),
  ).toBe("not-executed");
  await page.getByRole("button", { name: "Open account menu" }).click();
  await expect(page.getByText("saransh1337@gmail.com")).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL("http://localhost:3211/login");
});

test("supports keyboard tabs and username-based OTP submission", async ({
  page,
  context,
}) => {
  await context.request.post("/api/auth/login", {
    data: { username: "admin", password: "admin-e2e-password" },
  });
  await page.route("**/api/auth/otp/send", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ username: "saransh" });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.route("**/api/auth/otp/verify", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      username: "saransh",
      code: "123456",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "user_saransh",
          username: "saransh",
          displayName: "Saransh",
          email: "saransh1337@gmail.com",
          role: "editor",
        },
      }),
    });
  });

  await page.goto("/login");
  const passwordTab = page.getByRole("tab", { name: "Password" });
  await passwordTab.focus();
  await page.keyboard.press("ArrowRight");
  const otpTab = page.getByRole("tab", { name: "Email OTP" });
  await expect(otpTab).toHaveAttribute("aria-selected", "true");

  await page.getByLabel("Username").fill("saransh");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Digit 1").fill("1");
  await page.getByLabel("Digit 2").fill("2");
  await page.getByLabel("Digit 3").fill("3");
  await page.getByLabel("Digit 4").fill("4");
  await page.getByLabel("Digit 5").fill("5");
  await page.getByLabel("Digit 6").fill("6");
  await expect(
    page.getByRole("button", { name: "Verify & sign in" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Verify & sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3211/");
});

test("exposes usable account controls on a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.getByLabel("Username").fill("admin");
  await page.locator("#login-password").fill("admin-e2e-password");
  await page.getByRole("button", { name: "Sign in" }).click();

  const menu = page.getByRole("button", { name: "Open account menu" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();
});
