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
  await page.getByRole("tab", { name: "Daily plan" }).click();
  await expect(page).toHaveURL(/tool=days/);

  await page.getByRole("button", { name: "Expand day 1" }).click();
  const dayTitles = page.getByPlaceholder("Day title");
  await dayTitles.first().fill("Lisbon neighborhoods and markets");
  await page.reload();
  await page.getByRole("button", { name: "Expand day 1" }).click();
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
    await expect(
      page.getByRole("heading", { name: "Turn each edition into a complete itinerary" }),
    ).toBeVisible();

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

  await page.getByRole("tab", { name: /Publish/ }).first().click();
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

test("updates PDF presentation text from the sidebar preview controls", async ({
  seededPage: page,
}) => {
  await page.goto(`/projects/${FULL_PROJECT_ID}?stage=package&tool=pdf`);
  await expect(page.getByRole("heading", { name: "PDF builder" })).toBeVisible();

  const controls = page.getByRole("region", {
    name: "PDF presentation controls",
  });
  const preview = page.getByRole("region", { name: "PDF preview" });

  await controls
    .getByLabel("Title", { exact: true })
    .fill("Sidebar live PDF title");
  await controls
    .getByLabel("Subtitle", { exact: true })
    .fill("Sidebar live PDF subtitle");
  await controls
    .getByLabel("Trip overview")
    .fill("Sidebar live overview copy for the PDF preview.");

  await expect(preview.getByText("Sidebar live PDF title")).toBeVisible();
  await expect(preview.getByText("Sidebar live PDF subtitle")).toBeVisible();
  await expect(
    preview.getByText("Sidebar live overview copy for the PDF preview."),
  ).toBeVisible();

  await controls.getByRole("button", { name: /Days/ }).click();
  const firstDay = controls.locator("details").first();
  await firstDay.getByText(/^Day 1 -/).click();
  await firstDay.getByLabel("Day title").fill("Sidebar live day title");
  await expect(preview.getByText("Sidebar live day title")).toBeVisible();

  await controls.getByRole("button", { name: "Guides" }).click();
  await controls
    .getByLabel("Food & cafe guide")
    .fill("Sidebar live food guide copy.");
  await expect(preview.getByText("Sidebar live food guide copy.")).toBeVisible();
});

test("scrolls PDF presentation controls and preview independently", async ({
  seededPage: page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`/projects/${FULL_PROJECT_ID}?stage=package&tool=pdf`);
  await expect(page.getByRole("heading", { name: "PDF builder" })).toBeVisible();

  const controls = page.getByRole("region", {
    name: "PDF presentation controls",
  });
  const preview = page.getByRole("region", { name: "PDF preview" });

  await page.getByRole("button", { name: /Day images/ }).click();

  await expect
    .poll(() =>
      controls.evaluate(
        (element) => element.scrollHeight > element.clientHeight,
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      preview.evaluate((element) => element.scrollHeight > element.clientHeight),
    )
    .toBe(true);

  await expect
    .poll(() =>
      controls.evaluate((element) => getComputedStyle(element).overflowY),
    )
    .toMatch(/auto|scroll/);
  await expect
    .poll(() =>
      preview.evaluate((element) => getComputedStyle(element).overflowY),
    )
    .toMatch(/auto|scroll/);

  const initialPreviewScroll = await preview.evaluate(
    (element) => element.scrollTop,
  );
  await controls.hover();
  await page.mouse.wheel(0, 500);
  await expect
    .poll(() => controls.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect(await preview.evaluate((element) => element.scrollTop)).toBe(
    initialPreviewScroll,
  );

  const controlsScrollAfterWheel = await controls.evaluate(
    (element) => element.scrollTop,
  );
  await preview.hover();
  await page.mouse.wheel(0, 500);
  await expect
    .poll(() => preview.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(initialPreviewScroll);
  expect(await controls.evaluate((element) => element.scrollTop)).toBe(
    controlsScrollAfterWheel,
  );
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
