import {
  EMPTY_PROJECT_ID,
  FULL_PROJECT_ID,
  emptyProject,
  expect,
  prepareApp,
  test,
} from "./fixtures";

const workspaceTabs = [
  "Overview",
  "Trip Configuration",
  "Prompt Studio",
  "Image Prompts",
  "Itinerary Matrix",
  "Expanded Itinerary",
  "Listing Copy",
  "PDF Builder",
  "Export",
];

test("renders every implemented workspace module and overview readiness", async ({
  seededPage: page,
}) => {
  await page.goto(`/projects/${FULL_PROJECT_ID}`);
  for (const tab of workspaceTabs) {
    await expect(
      page.getByRole("button", { name: tab, exact: true }).last(),
    ).toBeVisible();
  }
  await expect(page.getByText("First-time couples")).toBeVisible();
  await expect(page.getByText("Lisbon · Sintra · Porto")).toBeVisible();
  await expect(page.getByText("AI assist mode")).toBeVisible();
  await expect(
    page.getByText(/Add a provider key to unlock paid AI drafting/),
  ).toBeVisible();
  await expect(page.getByText("Verify before delivery")).toBeVisible();
});

test("auto-saves valid trip configuration and rejects an invalid custom duration", async ({
  page,
}) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/projects/${EMPTY_PROJECT_ID}`);
  await page.getByRole("button", { name: "Trip Configuration" }).click();

  const cityInput = page
    .getByText("Cities / regions to include", { exact: true })
    .locator("..")
    .getByRole("textbox");
  await cityInput.fill("Coimbra");
  await cityInput.press("Enter");
  await page.getByLabel("Trip duration").selectOption("10 days");
  await page.getByLabel("Custom days (optional)").fill("61");
  await expect(
    page.getByText("Custom days must be 60 or fewer."),
  ).toBeVisible();

  await page.getByLabel("Custom days (optional)").fill("6");
  await page.getByLabel("Pace").selectOption("Relaxed");
  await page.getByLabel("Budget level").selectOption("Premium");
  await page.getByRole("button", { name: "Nature/adventure" }).click();
  await page.getByRole("button", { name: "Boutique" }).click();
  await page.getByRole("button", { name: "Local food" }).click();
  await page.getByLabel("Season / month").fill("Late September");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("routecrafter:v1") ?? ""),
    )
    .toContain("Coimbra");

  await page.reload();
  await page.getByRole("button", { name: "Trip Configuration" }).click();
  await expect(page.getByText("Coimbra", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Trip duration")).toHaveValue("10 days");
  await expect(page.getByLabel("Custom days (optional)")).toHaveValue("6");
  await expect(page.getByLabel("Pace")).toHaveValue("Relaxed");
  await expect(
    page.getByRole("button", { name: "Nature/adventure" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("generates, edits, copies, and persists the complete prompt catalog", async ({
  page,
}) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/projects/${EMPTY_PROJECT_ID}`);
  await page.getByRole("button", { name: "Prompt Studio" }).click();
  await page.getByRole("button", { name: "Generate all prompts" }).click();

  const promptEditor = page.locator("textarea").first();
  await expect(promptEditor).toHaveValue(/Portugal/);
  await expect(page.getByRole("button", { name: "Export raw" })).toBeVisible();
  await promptEditor.fill("E2E edited positioning prompt");
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Prompt Studio" }).click();
  await expect(page.locator("textarea").first()).toHaveValue(
    "E2E edited positioning prompt",
  );
});

test("generates five image briefs, edits one, marks it final, and exports markdown", async ({
  page,
}) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/projects/${EMPTY_PROJECT_ID}`);
  await page.getByRole("button", { name: "Image Prompts" }).click();
  await page.getByRole("button", { name: "Generate all five" }).click();

  await expect(
    page.getByRole("heading", { name: "Portfolio image prompts" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark final" })).toHaveCount(5);
  const title = page.locator("input").first();
  await title.fill("Portugal launch hero");
  await page.getByRole("button", { name: "Mark final" }).first().click();
  await expect(page.getByText("1 / 5 final")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Markdown" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("image-prompts.md");

  await page.reload();
  await page.getByRole("button", { name: "Image Prompts" }).click();
  await expect(page.locator('input[value="Portugal launch hero"]')).toBeVisible();
  await expect(page.getByText("1 / 5 final")).toBeVisible();
});

test("generates a matrix, edits a route, and hands a cell to itinerary creation", async ({
  page,
}) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/projects/${EMPTY_PROJECT_ID}`);
  await page.getByRole("button", { name: "Itinerary Matrix" }).click();
  await page.getByRole("button", { name: "Generate matrix" }).click();

  await expect(
    page.getByRole("heading", { name: "Itinerary matrix" }),
  ).toBeVisible();
  const firstSpine = page.locator("textarea").first();
  await firstSpine.fill("Lisbon -> Sintra -> Porto with rail-first pacing");
  await page
    .getByRole("button", { name: "Expand 5 days Couple" })
    .click();

  await expect(page.getByRole("button", { name: "Create itinerary" })).toBeVisible();
  const durationField = page
    .getByText("Duration", { exact: true })
    .locator("..")
    .locator("select");
  await expect(durationField).toHaveValue("5 days");
  await page.getByRole("button", { name: "Create itinerary" }).click();
  await expect(page.getByText("Days (5)")).toBeVisible();
  await expect(page.locator('input[value="Five Days Across Portugal"]')).toHaveCount(0);
  await expect(page.locator('input[value="5 days Portugal itinerary"]')).toBeVisible();
});
