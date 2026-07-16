import {
  EMPTY_PROJECT_ID,
  FULL_PROJECT_ID,
  emptyProject,
  expect,
  prepareApp,
  test,
} from "./fixtures";

test("renders the four-tab product editor with readiness and export", async ({
  seededPage: page,
}) => {
  await page.goto(`/products/${FULL_PROJECT_ID}`);
  for (const tab of ["Trip", "Itinerary", "PDF", "Listing"]) {
    await expect(
      page.getByRole("tab", { name: tab, exact: true }).first(),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("button", { name: "Readiness checklist" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Export" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Offer model" })).toBeVisible();
});

test("redirects legacy stage URLs into the matching editor tab", async ({
  seededPage: page,
}) => {
  await page.goto(`/projects/${FULL_PROJECT_ID}?stage=package&tool=pdf`);
  await expect(page).toHaveURL(new RegExp(`/products/${FULL_PROJECT_ID}`));
  await expect(page.getByRole("heading", { name: "PDF builder" })).toBeVisible();
});

test("auto-saves the deep trip brief from the Trip tab", async ({ page }) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/products/${EMPTY_PROJECT_ID}?tab=trip`);
  await page.getByText("Deep trip brief").click();

  await page.getByLabel("Trip duration").selectOption("10 days");
  await page.getByLabel("Custom days (optional)").fill("6");
  await page.getByLabel("Pace").selectOption("Relaxed");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("routecrafter:v1") ?? ""),
    )
    .toContain('"customDays":6');

  await page.reload();
  await page.getByText("Deep trip brief").click();
  await expect(page.getByLabel("Trip duration")).toHaveValue("10 days");
  await expect(page.getByLabel("Custom days (optional)")).toHaveValue("6");
});

test("keeps the prompt studio collapsed inside the Listing tab", async ({
  page,
}) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/products/${EMPTY_PROJECT_ID}?tab=listing`);
  await page.getByText("Prompt studio", { exact: true }).click();
  await page.getByRole("button", { name: "Generate all prompts" }).click();
  await expect(page.locator("textarea").first()).toHaveValue(/Portugal/);
  await expect(page).toHaveURL(/tab=listing/);
});

test("plans a unique edition and creates its linked itinerary", async ({
  page,
}) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/products/${EMPTY_PROJECT_ID}?tab=trip`);
  await page.getByRole("button", { name: "Add to production plan" }).click();
  await expect(
    page.getByRole("button", { name: "Already planned" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Start itinerary" }).click();
  await expect(page).toHaveURL(/tab=itinerary/);
  await page.getByRole("button", { name: "Create this itinerary" }).click();
  await expect(page.getByRole("tab", { name: "Daily plan" })).toBeVisible();
});

test("shows portfolio visuals only when selected", async ({ page }) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/products/${EMPTY_PROJECT_ID}?tab=listing`);
  await expect(
    page.getByRole("heading", { name: "Portfolio visuals are not selected" }),
  ).toBeVisible();
});
