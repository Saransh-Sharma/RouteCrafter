import {
  FULL_PROJECT_ID,
  expect,
  mockImageDataUrl,
  test,
} from "./fixtures";

test("edits a linked itinerary and persists the deep editor location", async ({
  seededPage: page,
}) => {
  await page.goto(
    `/projects/${FULL_PROJECT_ID}?stage=build&edition=e2e-edition&tool=overview`,
  );
  const title = page.locator("input").first();
  await title.fill("Portugal Rail and Food Escape");
  await page.getByRole("button", { name: "Daily plan" }).click();
  await expect(page).toHaveURL(/tool=days/);

  const dayTitles = page.getByPlaceholder("Day title");
  await dayTitles.first().fill("Lisbon neighborhoods and markets");
  await page.reload();
  await expect(page.getByPlaceholder("Day title").first()).toHaveValue(
    "Lisbon neighborhoods and markets",
  );
});

test("edits the marketplace listing and publishes after final confirmations", async ({
  seededPage: page,
}) => {
  await page.goto(`/projects/${FULL_PROJECT_ID}?stage=package&tool=listing`);
  const firstTitle = page.locator("input").first();
  await firstTitle.fill("I will plan a rail-first Portugal food itinerary");

  await page.getByRole("button", { name: /Publish/ }).first().click();
  await expect(page.getByRole("heading", { name: "Review the launch package" })).toBeVisible();
  for (const checkbox of await page.getByRole("checkbox").all()) {
    await checkbox.check();
  }
  await page.getByRole("button", { name: "Mark ready to sell" }).click();
  await expect(page.getByText("Ready to sell", { exact: true }).first()).toBeVisible();
});

test("updates the selected PDF presentation theme and cover", async ({
  seededPage: page,
}) => {
  await page.goto(`/projects/${FULL_PROJECT_ID}?stage=package&tool=pdf`);
  await expect(page.getByRole("heading", { name: "PDF builder" })).toBeVisible();
  const noir = page.getByRole("button", { name: "Noir" });
  await noir.click();
  await expect(noir).toHaveClass(/ring-2/);
  const imageUrl = page.getByPlaceholder("or paste image URL").first();
  await imageUrl.fill(mockImageDataUrl);
  await imageUrl.blur();
  await expect(page.getByAltText("preview")).toBeVisible();
});

test("downloads portable JSON from the package files tool", async ({
  seededPage: page,
}) => {
  await page.goto(`/projects/${FULL_PROJECT_ID}?stage=package&tool=exports`);
  await expect(page.getByRole("heading", { name: "Export your work" })).toBeVisible();
  const fullExport = page
    .getByText("Full project export", { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rc-card')]");
  const downloadPromise = page.waitForEvent("download");
  await fullExport.getByRole("button", { name: "JSON" }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(
    "portugal-editorial-escape.json",
  );
});
