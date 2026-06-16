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

test("keeps embedded AI cost badges inside build overview buttons", async ({
  seededPage: page,
}) => {
  for (const width of [1280, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      `/projects/${FULL_PROJECT_ID}?stage=build&edition=e2e-edition&tool=overview`,
    );
    await expect(page.getByText("Current edition")).toBeVisible();

    const aiButtons = [
      page.getByRole("button", { name: /AI fill empty sections/ }),
      page.getByRole("button", { name: /AI add rainy-day alternatives/ }),
      page.getByRole("button", { name: /AI add booking notes/ }),
      page.getByRole("button", { name: /AI add food & transport guides/ }),
    ];

    const boxes = [];
    for (const button of aiButtons) {
      await expect(button).toBeVisible();
      const buttonBox = await button.boundingBox();
      expect(buttonBox).not.toBeNull();
      const badge = button.locator("span").filter({ hasText: /^Est\./ }).last();
      await expect(badge).toBeVisible();
      const badgeBox = await badge.boundingBox();
      expect(badgeBox).not.toBeNull();

      expect(badgeBox!.x).toBeGreaterThanOrEqual(buttonBox!.x);
      expect(badgeBox!.y).toBeGreaterThanOrEqual(buttonBox!.y);
      expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(
        buttonBox!.x + buttonBox!.width + 1,
      );
      expect(badgeBox!.y + badgeBox!.height).toBeLessThanOrEqual(
        buttonBox!.y + buttonBox!.height + 1,
      );
      boxes.push(buttonBox!);
    }

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const separated =
          boxes[i].x + boxes[i].width <= boxes[j].x ||
          boxes[j].x + boxes[j].width <= boxes[i].x ||
          boxes[i].y + boxes[i].height <= boxes[j].y ||
          boxes[j].y + boxes[j].height <= boxes[i].y;
        expect(separated).toBe(true);
      }
    }
  }
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
