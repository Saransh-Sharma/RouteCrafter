import {
  FULL_PROJECT_ID,
  expect,
  fullProject,
  mockAiImage,
  mockImageDataUrl,
  prepareApp,
  test,
} from "./fixtures";

test("opens the PDF cover AI sheet above the preview and sends the image request", async ({
  page,
}) => {
  await prepareApp(page, { projects: [fullProject], withAiKey: true });
  await mockAiImage(page, mockImageDataUrl);
  await page.goto(
    `/projects/${FULL_PROJECT_ID}?stage=package&tool=pdf`,
  );

  await page.getByRole("button", { name: "AI create cover image" }).click();
  await expect(page.getByText("AI request estimate")).toBeVisible();

  const dialog = page.locator('[role="dialog"][aria-modal="true"]');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.evaluate((element) => element.parentElement?.tagName),
  ).resolves.toBe("BODY");

  const confirm = page.getByRole("button", { name: /Confirm run/ });
  await expect(confirm).toBeVisible();
  await expect(confirm).toBeEnabled();
  await expect(
    confirm.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const target = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return target === button || Boolean(button.contains(target));
    }),
  ).resolves.toBe(true);

  const responsePromise = page.waitForResponse(
    (candidate) =>
      candidate.url().endsWith("/api/ai/image") &&
      candidate.request().method() === "POST",
  );
  await confirm.click();
  await expect(responsePromise).resolves.toBeTruthy();
  await expect(
    page.getByAltText("AI generated RouteCrafter visual"),
  ).toBeVisible();
});

test("recovers from a transient image API error via Retry on the PDF cover flow", async ({
  page,
}) => {
  let attempts = 0;
  await prepareApp(page, { projects: [fullProject], withAiKey: true });
  await page.route("**/api/ai/image", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error:
            "The provider is temporarily unavailable. No project content was changed.",
        }),
      });
      return;
    }
    const request = route.request().postDataJSON() as { apiKey?: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        image: mockImageDataUrl,
        mimeType: "image/svg+xml",
        provider: "openai",
        model: "gpt-image-2",
        credentialSource: request.apiKey ? "personal" : "server",
        usage: { images: 1 },
      }),
    });
  });

  await page.goto(
    `/projects/${FULL_PROJECT_ID}?stage=package&tool=pdf`,
  );
  await page.getByRole("button", { name: "AI create cover image" }).click();
  await page.getByRole("button", { name: /Confirm run/ }).click();

  await expect(
    page.getByText(/temporarily unavailable/i),
  ).toBeVisible();
  await expect(page.getByText("Prompt that will be retried")).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByAltText("AI generated RouteCrafter visual"),
  ).toBeVisible();
  expect(attempts).toBe(2);
});

test("closes the AI sheet with Escape and returns focus to the trigger", async ({
  page,
}) => {
  await prepareApp(page, { projects: [fullProject], withAiKey: true });
  await page.goto(
    `/projects/${FULL_PROJECT_ID}?stage=package&tool=pdf`,
  );

  const trigger = page.getByRole("button", { name: "AI create cover image" });
  await trigger.click();
  await expect(page.getByText("AI request estimate")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByText("AI request estimate")).toHaveCount(0);
  await expect(
    trigger.evaluate((button) => document.activeElement === button),
  ).resolves.toBe(true);
});

test("recovers from a transient image API error via Retry", async ({ page }) => {
  let attempts = 0;
  await prepareApp(page, { projects: [fullProject], withAiKey: true });
  await page.route("**/api/ai/image", async (route) => {
    attempts += 1;
    if (attempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error:
            "The provider is temporarily unavailable. No project content was changed.",
        }),
      });
      return;
    }
    const request = route.request().postDataJSON() as { apiKey?: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        image: mockImageDataUrl,
        mimeType: "image/svg+xml",
        provider: "openai",
        model: "gpt-image-2",
        credentialSource: request.apiKey ? "personal" : "server",
        usage: { images: 1 },
      }),
    });
  });

  await page.goto(
    `/projects/${FULL_PROJECT_ID}?stage=package&tool=visuals`,
  );
  await page.getByRole("button", { name: "AI create image" }).first().click();
  await page.getByRole("button", { name: /Confirm run/ }).click();

  await expect(
    page.getByText(/temporarily unavailable/i),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(
    page.getByAltText("AI generated RouteCrafter visual"),
  ).toBeVisible();
  expect(attempts).toBe(2);
});
