import {
  EMPTY_PROJECT_ID,
  FULL_PROJECT_ID,
  emptyProject,
  expect,
  prepareApp,
  test,
} from "./fixtures";

test("renders the five-stage production route and recommended action", async ({
  seededPage: page,
}) => {
  await page.goto(`/projects/${FULL_PROJECT_ID}`);
  for (const stage of ["Define", "Plan", "Build", "Package", "Publish"]) {
    await expect(
      page.getByRole("button", { name: new RegExp(stage) }).first(),
    ).toBeVisible();
  }
  await expect(page.getByText("Recommended next move")).toBeVisible();
  await expect(page.getByText("Saved locally")).toBeVisible();
});

test("auto-saves the deep trip brief through the workspace header", async ({
  page,
}) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/projects/${EMPTY_PROJECT_ID}?stage=define`);
  await page.getByText("Deep trip brief").click();

  await page.getByLabel("Trip duration").selectOption("10 days");
  await page.getByLabel("Custom days (optional)").fill("6");
  await page.getByLabel("Pace").selectOption("Relaxed");
  await expect(page.getByText(/Saving changes|Saved locally/)).toBeVisible();
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

test("keeps production prompts secondary to the package stage", async ({
  page,
}) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/projects/${EMPTY_PROJECT_ID}?stage=package&tool=prompts`);
  await page.getByRole("button", { name: "Generate all prompts" }).click();
  await expect(page.locator("textarea").first()).toHaveValue(/Portugal/);
  await expect(page).toHaveURL(/stage=package&tool=prompts/);
});

test("plans a unique edition and creates its linked itinerary", async ({
  page,
}) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/projects/${EMPTY_PROJECT_ID}?stage=plan`);
  await page.getByRole("button", { name: "Add to production plan" }).click();
  await expect(page.getByRole("button", { name: "Already planned" })).toBeDisabled();
  await page.getByRole("button", { name: "Start itinerary" }).click();
  await page.getByRole("button", { name: "Create this itinerary" }).click();

  await expect(page).toHaveURL(/stage=build&edition=.+&tool=overview/);
  await expect(page.getByText("Launch checklist")).toBeVisible();
  await expect(page.getByRole("button", { name: "Daily plan" })).toBeVisible();
});

test("shows portfolio visuals only when selected", async ({ page }) => {
  await prepareApp(page, { projects: [emptyProject] });
  await page.goto(`/projects/${EMPTY_PROJECT_ID}?stage=package&tool=visuals`);
  await expect(
    page.getByRole("heading", { name: "Portfolio visuals are not selected" }),
  ).toBeVisible();
});
