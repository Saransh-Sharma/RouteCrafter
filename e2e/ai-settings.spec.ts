import {
  FULL_PROJECT_ID,
  expect,
  fullProject,
  mockAiImage,
  mockAiText,
  mockImageDataUrl,
  prepareApp,
  test,
} from "./fixtures";

test("persists provider settings, tests a mocked connection, and removes the key", async ({
  page,
}) => {
  await prepareApp(page, { projects: [fullProject] });
  await mockAiText(page, "RouteCrafter AI settings connection OK");
  await page.goto("/settings");

  const openAiCard = page
    .getByText("OpenAI", { exact: true })
    .first()
    .locator("xpath=ancestor::div[contains(@class, 'rc-card')]");
  await openAiCard.locator('input[type="password"]').fill("sk-e2e-settings-key");
  await openAiCard.getByRole("button", { name: "Save key" }).click();
  await expect(openAiCard.getByText("Saved as sk-e...-key")).toBeVisible();

  await openAiCard.locator("input").nth(1).fill("gpt-e2e-custom");
  await openAiCard.getByRole("button", { name: "Test connection" }).click();
  await expect(
    openAiCard.getByText("Connection worked. This may appear in provider usage."),
  ).toBeVisible();

  const temperature = page
    .getByText("Temperature", { exact: true })
    .locator("..")
    .locator("input");
  await temperature.fill("0.3");
  await page.reload();
  await expect(openAiCard.getByText("Saved as sk-e...-key")).toBeVisible();
  await expect(openAiCard.locator("input").nth(1)).toHaveValue("gpt-e2e-custom");
  await expect(temperature).toHaveValue("0.3");

  await openAiCard.getByRole("button", { name: "Remove" }).click();
  await expect(openAiCard.getByText("Saved only in this browser.")).toBeVisible();
  await expect(
    openAiCard.getByRole("button", { name: "Test connection" }),
  ).toBeDisabled();
});

test("blocks AI execution without a configured key", async ({ page }) => {
  await prepareApp(page, { projects: [fullProject] });
  await page.goto(`/projects/${FULL_PROJECT_ID}`);
  await page.getByRole("button", { name: "Prompt Studio" }).click();
  await page.getByRole("button", { name: "Run with AI" }).click();

  await expect(page.getByText("Billable request")).toBeVisible();
  await expect(page.getByRole("link", { name: "Add key in Settings" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirm billable run" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Close AI run sheet" }).click();
  await expect(page.getByText("Billable request")).toHaveCount(0);
});

test("previews and applies a mocked structured listing while recording usage", async ({
  page,
}) => {
  await prepareApp(page, { projects: [fullProject], withAiKey: true });
  const proposedListing = {
    ...fullProject.listing!,
    shortDescription:
      "Mocked AI proposal for a rail-first Portugal culinary escape.",
  };
  await mockAiText(page, JSON.stringify(proposedListing));
  await page.goto(`/projects/${FULL_PROJECT_ID}`);
  await page.getByRole("button", { name: "Listing Copy" }).click();

  const shortDescription = page
    .getByText("Short description", { exact: true })
    .locator("..")
    .locator("textarea");
  await expect(shortDescription).not.toHaveValue(/Mocked AI proposal/);
  await page.getByRole("button", { name: "AI improve listing" }).first().click();
  await expect(page.getByText("Billable request")).toBeVisible();
  await page.getByRole("button", { name: "Confirm billable run" }).click();
  await expect(page.getByText("AI proposal", { exact: true })).toBeVisible();
  await expect(page.getByText("Ready to apply after your review.")).toBeVisible();
  await expect(shortDescription).not.toHaveValue(/Mocked AI proposal/);
  await page.getByRole("button", { name: "Replace listing" }).click();
  await expect(shortDescription).toHaveValue(/Mocked AI proposal/);

  await page.getByRole("button", { name: "Export", exact: true }).last().click();
  const usageRow = page
    .getByText("AI usage appendix", { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rc-card')]");
  await expect(usageRow.getByText("2", { exact: true })).toBeVisible();
});

test("rejects invalid AI JSON and applies a mocked generated image only after review", async ({
  page,
}) => {
  await prepareApp(page, { projects: [fullProject], withAiKey: true });
  await mockAiText(page, '{"packages":"not-an-array"}');
  await page.goto(`/projects/${FULL_PROJECT_ID}`);
  await page.getByRole("button", { name: "Listing Copy" }).click();
  await page.getByRole("button", { name: "AI improve listing" }).first().click();
  await page.getByRole("button", { name: "Confirm billable run" }).click();
  await expect(
    page.getByText(
      "The model returned listing JSON RouteCrafter could not safely apply.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Replace listing" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Discard" }).click();

  await page.unroute("**/api/ai/text");
  await mockAiImage(page, mockImageDataUrl);
  await page.getByRole("button", { name: "Image Prompts" }).click();
  await page.getByRole("button", { name: "AI create image" }).first().click();
  await expect(page.getByText("Billable request")).toBeVisible();
  await page.getByRole("button", { name: "Confirm billable run" }).click();
  await expect(
    page.getByAltText("AI generated RouteCrafter visual"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply image" }).click();
  await expect(
    page.getByAltText(/generated visual/).first(),
  ).toBeVisible();
});
