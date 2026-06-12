import {
  FULL_PROJECT_ID,
  expect,
  mockImageDataUrl,
  test,
} from "./fixtures";

test("edits itinerary content, reorders days, and exports markdown", async ({
  seededPage: page,
}) => {
  await page.goto(`/projects/${FULL_PROJECT_ID}`);
  await page.getByRole("button", { name: "Expanded Itinerary" }).click();

  const title = page.locator("input").first();
  await title.fill("Portugal Rail and Food Escape");
  await page.getByRole("button", { name: "Add day" }).click();
  await expect(page.getByText("Days (6)")).toBeVisible();
  await page.getByRole("button", { name: "Remove day" }).last().click();
  await expect(page.getByText("Days (5)")).toBeVisible();

  const dayTitles = page.getByPlaceholder("Day title");
  await expect(dayTitles.first()).toHaveValue("Arrival & orientation");
  await page.getByRole("button", { name: "Move day down" }).first().click();
  await expect(dayTitles.first()).toHaveValue("Day 2");
  await dayTitles.first().fill("Lisbon neighborhoods and markets");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Markdown" }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("5days-itinerary.md");

  await page.reload();
  await page.getByRole("button", { name: "Expanded Itinerary" }).click();
  await expect(page.locator("input").first()).toHaveValue(
    "Portugal Rail and Food Escape",
  );
  await expect(page.getByPlaceholder("Day title").first()).toHaveValue(
    "Lisbon neighborhoods and markets",
  );
});

test("edits listing sections, manages repeatable fields, and marks the project ready", async ({
  seededPage: page,
}) => {
  await page.goto(`/projects/${FULL_PROJECT_ID}`);
  await page.getByRole("button", { name: "Listing Copy" }).click();

  const firstTitle = page.locator("input").first();
  await firstTitle.fill("I will plan a rail-first Portugal food itinerary");
  await page.getByRole("button", { name: "Add title" }).click();
  await expect(page.getByRole("button", { name: "Remove title" })).toHaveCount(6);
  await page.getByRole("button", { name: "Remove title" }).last().click();
  await expect(page.getByRole("button", { name: "Remove title" })).toHaveCount(5);

  await page.getByPlaceholder("e.g. $45").first().fill("$79");
  await page.getByRole("button", { name: "Add FAQ" }).click();
  await expect(page.getByRole("button", { name: "Remove FAQ" })).toHaveCount(5);
  await page.getByRole("button", { name: "Remove FAQ" }).last().click();
  await page.getByRole("button", { name: "Mark ready to sell" }).click();
  await expect(page.getByText("Ready to sell", { exact: true }).first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Markdown" }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("listing.md");

  await page.reload();
  await page.getByRole("button", { name: "Listing Copy" }).click();
  await expect(page.locator("input").first()).toHaveValue(
    "I will plan a rail-first Portugal food itinerary",
  );
  await expect(page.getByPlaceholder("e.g. $45").first()).toHaveValue("$79");
  await expect(
    page.getByRole("button", { name: "Mark ready to sell" }),
  ).toHaveCount(0);
});

test("updates PDF theme and cover image and invokes the native print path", async ({
  seededPage: page,
}) => {
  await page.goto(`/projects/${FULL_PROJECT_ID}`);
  await page.getByRole("button", { name: "PDF Builder" }).click();
  await expect(page.getByRole("heading", { name: "PDF builder" })).toBeVisible();
  await expect(page.getByText("Five Days Across Portugal")).toBeVisible();

  const noir = page.getByRole("button", { name: "Noir" });
  await noir.click();
  await expect(noir).toHaveClass(/ring-2/);

  const imageUrl = page.getByPlaceholder("or paste image URL").first();
  await imageUrl.fill(mockImageDataUrl);
  await imageUrl.blur();
  await expect(page.getByAltText("preview")).toBeVisible();

  await page.evaluate(() => {
    window.print = () => {
      document.body.dataset.printInvoked = "true";
    };
  });
  await page.getByRole("button", { name: "Print / Save as PDF" }).click();
  await expect
    .poll(() => page.evaluate(() => document.body.dataset.printInvoked))
    .toBe("true");

  await page.reload();
  await page.getByRole("button", { name: "PDF Builder" }).click();
  await expect(page.getByRole("button", { name: "Noir" })).toHaveClass(/ring-2/);
  await expect(page.getByAltText("preview")).toBeVisible();
});

test("downloads every available artifact from the central export hub", async ({
  seededPage: page,
}) => {
  await page.goto(`/projects/${FULL_PROJECT_ID}`);
  await page.getByRole("button", { name: "Export", exact: true }).last().click();
  await expect(
    page.getByRole("heading", { name: "Export your work" }),
  ).toBeVisible();

  const fullExport = page
    .getByText("Full project export", { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rc-card')]");
  const jsonDownload = page.waitForEvent("download");
  await fullExport.getByRole("button", { name: "JSON" }).click();
  expect((await jsonDownload).suggestedFilename()).toBe(
    "portugal-editorial-escape.json",
  );

  const bundleDownload = page.waitForEvent("download");
  await fullExport.getByRole("button", { name: "Markdown bundle" }).click();
  expect((await bundleDownload).suggestedFilename()).toContain("bundle.md");

  for (const [title, button, suffix] of [
    ["Itinerary matrix", "CSV", "matrix.csv"],
    ["Listing copy", "Markdown", "listing.md"],
    ["Portfolio image prompts", "Markdown", "image-prompts.md"],
    ["AI usage appendix", "Markdown", "ai-usage.md"],
    ["Generated prompts", "Markdown", "prompts.md"],
  ] as const) {
    const row = page
      .getByText(title, { exact: true })
      .locator("xpath=ancestor::div[contains(@class, 'rc-card')]");
    const downloadPromise = page.waitForEvent("download");
    await row.getByRole("button", { name: button }).click();
    expect((await downloadPromise).suggestedFilename()).toContain(suffix);
  }

  const itineraryRow = page
    .getByText("Itineraries", { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rc-card')]");
  for (const [button, suffix] of [
    ["MD", "itinerary.md"],
    ["CSV", "itinerary.csv"],
  ] as const) {
    const downloadPromise = page.waitForEvent("download");
    await itineraryRow.getByRole("button", { name: button }).click();
    expect((await downloadPromise).suggestedFilename()).toContain(suffix);
  }
});
