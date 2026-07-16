import type { Page } from "@playwright/test";
import { FULL_PROJECT_ID, expect, prepareApp, test, fullProject } from "./fixtures";

/**
 * Cross-country series engine, with the AI provider fully mocked. Covers the
 * happy path, per-country failure isolation + retry, and the guarantee that
 * no image API call happens unless images are explicitly opted in.
 */

interface MockOptions {
  /** Fail requests whose prompt/label mentions this country, N times. */
  failFor?: { country: string; times: number };
}

function transposePayload(country: string) {
  return {
    name: `${country} Editorial Escape`,
    regions: ["Alpha", "Beta"],
    positioning: `Human-paced ${country} with food and rail.`,
    targetAudience: "First-time couples",
    route: [
      { city: `${country} Alpha`, nights: 3 },
      { city: `${country} Beta`, nights: 2, arriveBy: "train" },
    ],
  };
}

function overviewPayload(country: string) {
  return {
    title: `Five Days Across ${country}`,
    subtitle: "A food-first route",
    overview: `A relaxed ${country} route.`,
    whoFor: "First-time couples",
    routeSummary: "Alpha to Beta by rail",
    foodGuide: "Eat locally.",
    transportGuide: "Use rail.",
    packingList: "Light layers.",
    verificationNotes: "Verify live hours and prices before travel.",
  };
}

function daysPayload(first: number, last: number) {
  const days = [];
  for (let day = first; day <= last; day += 1) {
    days.push({
      day,
      title: `Day ${day} highlights`,
      base: day <= 3 ? "Alpha" : "Beta",
      morning: "Neighborhood walk and coffee.",
      lunch: "Seasonal local lunch.",
      afternoon: "One anchor sight, unhurried.",
      evening: "Golden-hour viewpoint.",
      dinner: "Local dinner spot.",
      transportNotes: "Walk and metro.",
      bookingNotes: "Book the anchor sight ahead.",
      lowEnergyAlternative: "Cafe and park loop.",
      rainyDayAlternative: "Covered market and museum.",
      whyThisWorks: "One anchor, no rushing.",
    });
  }
  return { days };
}

function listingPayload(country: string) {
  return {
    titleOptions: [`${country} itinerary — human-paced food & rail`],
    tags: ["itinerary", country.toLowerCase(), "travel-guide"],
    shortDescription: `A ${country} route built around food and rail.`,
    longDescription: `Day-by-day ${country} itinerary with alternatives.`,
    packages: [],
    faqs: [],
    buyerRequirements: [],
    upsells: [],
    deliveryNotes: "Digital PDF delivered after purchase.",
  };
}

async function mockSeriesAi(page: Page, options: MockOptions = {}) {
  const failures = { remaining: options.failFor?.times ?? 0 };
  const imageCalls: string[] = [];

  await page.route("**/api/ai/text", async (route) => {
    const request = route.request().postDataJSON() as {
      taskType: string;
      label?: string;
      prompt: string;
    };
    const label = request.label ?? "";
    const targetCountry =
      request.prompt.match(/Target country: (.+)/)?.[1]?.trim() ??
      label.match(/— ([A-Za-z ]+?) \d/)?.[1]?.trim() ??
      "Italy";

    if (
      options.failFor &&
      failures.remaining > 0 &&
      (request.prompt.includes(options.failFor.country) ||
        label.includes(options.failFor.country))
    ) {
      failures.remaining -= 1;
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ error: "Mock provider outage" }),
      });
      return;
    }

    let payload: unknown;
    if (request.taskType === "transpose") {
      payload = transposePayload(targetCountry);
    } else if (label.includes("- overview")) {
      const country = label.match(/itinerary — (.+?) 5 days/)?.[1] ?? "Italy";
      payload = overviewPayload(country);
    } else if (label.includes("- days")) {
      const range = label.match(/days (\d+)-(\d+)/);
      payload = daysPayload(
        Number(range?.[1] ?? 1),
        Number(range?.[2] ?? 1),
      );
    } else if (request.taskType === "listing") {
      const country = label.match(/Series listing — (.+)/)?.[1] ?? "Italy";
      payload = listingPayload(country);
    } else {
      payload = {};
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        text: JSON.stringify(payload),
        provider: "openai",
        model: "gpt-5.4",
        credentialSource: "server",
        usage: { inputTokens: 500, outputTokens: 700, totalTokens: 1200 },
      }),
    });
  });

  await page.route("**/api/ai/image", async (route) => {
    imageCalls.push(route.request().postDataJSON()?.label ?? "image");
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "Images must not be called" }),
    });
  });

  return { imageCalls };
}

test("multiplies a product to a new country without any image API calls", async ({
  page,
}) => {
  await prepareApp(page, { projects: [fullProject] });
  const { imageCalls } = await mockSeriesAi(page);

  await page.goto(`/products/${FULL_PROJECT_ID}`);
  await page.getByRole("button", { name: "Multiply" }).click();
  await page
    .getByPlaceholder("Type a country and press Enter")
    .fill("Italy");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Prompts only — recommended")).toBeVisible();
  await expect(page.getByText("Estimated cost")).toBeVisible();
  await page.getByRole("button", { name: /Generate 1 product/ }).click();

  await expect(page).toHaveURL(/\/series\//);
  await expect(page.getByText("Italy", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Complete", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("1 of 1 countries complete")).toBeVisible();

  // The generated product is a real, editable sibling.
  await page.getByRole("link", { name: "Open product" }).last().click();
  await expect(
    page.getByRole("heading", { name: "Italy Editorial Escape" }),
  ).toBeVisible();
  await expect(page.getByText("Series", { exact: false }).first()).toBeVisible();

  expect(imageCalls).toEqual([]);
});

test("isolates a failed country and retries only its missing steps", async ({
  page,
}) => {
  await prepareApp(page, { projects: [fullProject] });
  // The client does not retry mocked provider errors, so a single failure
  // lands Slovenia in "failed"; the manual retry then succeeds. (The source
  // country, Portugal, appears in every prompt, so the failing target must
  // be one only its own calls mention.)
  await mockSeriesAi(page, { failFor: { country: "Slovenia", times: 1 } });

  await page.goto(`/products/${FULL_PROJECT_ID}`);
  await page.getByRole("button", { name: "Multiply" }).click();
  const input = page.getByPlaceholder("Type a country and press Enter");
  await input.fill("Italy");
  await page.keyboard.press("Enter");
  await input.fill("Slovenia");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: /Generate 2 products/ }).click();

  await expect(page).toHaveURL(/\/series\//);
  await expect(
    page.getByText("Failed", { exact: true }),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Complete", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("Failed", { exact: true })).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(page.getByText("2 of 2 countries complete")).toBeVisible();
});
