import { describe, expect, it } from "vitest";
import { buildContext, buildItinerary } from "@/lib/generation";
import { seedProjects } from "@/lib/seed-projects";
import { PDF_PAGE_MODEL, buildPdfPages } from "./pdf-page-model";

function baseItinerary() {
  const project = structuredClone(seedProjects[0]);
  return buildItinerary(buildContext(project), { duration: "3 days" });
}

describe("buildPdfPages", () => {
  it("uses an image-day template and moves notes to a dedicated page", () => {
    const itinerary = baseItinerary();
    itinerary.days[0].image = "https://example.com/day.jpg";
    itinerary.days[0].transportNotes = "Use taxis for the first transfer.";
    itinerary.days[0].whyThisWorks = "This keeps arrival day low friction.";

    const pages = buildPdfPages(itinerary);

    expect(
      pages.some(
        (page) => page.type === "day-image-plan" && page.dayIndex === 0,
      ),
    ).toBe(true);
    expect(
      pages.some((page) => page.type === "day-notes" && page.dayIndex === 0),
    ).toBe(true);
  });

  it("splits unusually long schedule rows into continuation pages", () => {
    const itinerary = baseItinerary();
    itinerary.days[0].morning = Array.from(
      { length: 300 },
      (_, index) => `Detailed arrival instruction ${index + 1}`,
    ).join(" ");

    const pages = buildPdfPages(itinerary);
    const continuation = pages.find(
      (page) => page.type === "day-plan-continuation" && page.dayIndex === 0,
    );

    expect(continuation).toBeTruthy();
    if (continuation?.type === "day-plan-continuation") {
      expect(continuation.rows.some((row) => row.key === "morning")).toBe(true);
    }
  });

  it("splits long overview and guide text into continuation pages", () => {
    const itinerary = baseItinerary();
    itinerary.overview = Array.from(
      { length: 70 },
      (_, index) => `Overview paragraph ${index + 1} with buyer-facing context.`,
    ).join("\n\n");
    itinerary.foodGuide = Array.from(
      { length: 95 },
      (_, index) => `Guide paragraph ${index + 1} with practical detail.`,
    ).join("\n\n");

    const pages = buildPdfPages(itinerary);

    expect(pages.some((page) => page.type === "overview-continuation")).toBe(
      true,
    );
    expect(pages.some((page) => page.type === "guides-continuation")).toBe(
      true,
    );
  });

  it("keeps every estimated page below the fixed A4 printable body", () => {
    const itinerary = baseItinerary();
    const longText = Array.from(
      { length: 160 },
      (_, index) => `Segment ${index + 1} with enough words to wrap cleanly`,
    ).join(" ");
    itinerary.overview = longText;
    itinerary.foodGuide = longText;
    itinerary.transportGuide = longText;
    itinerary.days[0].image = "https://example.com/day.jpg";
    itinerary.days[0].morning = longText;
    itinerary.days[0].whyThisWorks = longText;

    const pages = buildPdfPages(itinerary);

    expect(pages.length).toBeGreaterThan(8);
    for (const page of pages) {
      expect(page.estimatedHeightMm).toBeLessThanOrEqual(
        PDF_PAGE_MODEL.bodyHeightMm,
      );
    }
  });

  it("marks later day-notes pages as continuations explicitly", () => {
    const itinerary = baseItinerary();
    const longText = Array.from(
      { length: 180 },
      (_, index) => `Note segment ${index + 1} with enough copy to wrap`,
    ).join(" ");
    itinerary.days[0].transportNotes = longText;
    itinerary.days[0].bookingNotes = longText;
    itinerary.days[0].whyThisWorks = longText;

    const notePages = buildPdfPages(itinerary).filter(
      (page) => page.type === "day-notes" && page.dayIndex === 0,
    );

    expect(notePages.length).toBeGreaterThan(1);
    expect(notePages[0]?.continuation).toBe(false);
    expect(notePages.slice(1).every((page) => page.continuation)).toBe(true);
  });

  it("hard-splits overlong tokens before estimating row chunks", () => {
    const itinerary = baseItinerary();
    itinerary.days[0].morning = "x".repeat(1200);

    const morningRows = buildPdfPages(itinerary).flatMap((page) =>
      "rows" in page ? page.rows.filter((row) => row.key === "morning") : [],
    );

    expect(morningRows.length).toBeGreaterThan(1);
    expect(morningRows.every((row) => row.value.length <= 82 * 6)).toBe(true);
  });

  it("paginates local details across multiple estimated pages", () => {
    const itinerary = baseItinerary();
    itinerary.days[0].details = {
      base: "Shibuya",
      restaurants: Array.from({ length: 34 }, (_, index) => ({
        name: `Restaurant ${index + 1}`,
        area: "Central",
        category: "casual",
        whyItFits:
          "Useful for a buyer-facing itinerary because it keeps the local context concrete.",
        priceBand: "$$",
        source: `https://example.com/restaurant-${index + 1}`,
        caveat: "Verify hours before visiting.",
      })),
      stays: [],
      activities: [],
      shopping: [],
      trivia: Array.from({ length: 10 }, (_, index) => ({
        text: `Local trivia ${index + 1} with enough context to estimate line height.`,
        source: "",
      })),
      generatedAt: "2026-06-29T00:00:00.000Z",
    };

    const detailPages = buildPdfPages(itinerary).filter(
      (page) => page.type === "local-details" && page.dayIndex === 0,
    );
    const renderedRestaurantIndexes = detailPages.flatMap((page) =>
      page.sections.flatMap((section) =>
        section.key === "restaurants" ? section.itemIndexes : [],
      ),
    );
    const renderedTriviaIndexes = detailPages.flatMap(
      (page) => page.triviaIndexes,
    );

    expect(detailPages.length).toBeGreaterThan(1);
    expect(detailPages[0]?.continuation).toBe(false);
    expect(detailPages.slice(1).every((page) => page.continuation)).toBe(true);
    expect(renderedRestaurantIndexes).toHaveLength(34);
    expect(renderedTriviaIndexes).toHaveLength(10);
    for (const page of detailPages) {
      expect(page.estimatedHeightMm).toBeLessThanOrEqual(
        PDF_PAGE_MODEL.bodyHeightMm,
      );
    }
  });

  it("omits local detail pages when all detail content is hidden", () => {
    const itinerary = baseItinerary();
    itinerary.hiddenElements = ["day:1:details:restaurants"];
    itinerary.days[0].details = {
      base: "Shibuya",
      restaurants: [
        {
          name: "Fuglen Tokyo",
          area: "Tomigaya",
          category: "cafe",
          whyItFits: "Slow morning coffee near the park.",
          priceBand: "$$",
          source: "https://example.com/fuglen",
          caveat: "Verify hours before visiting.",
        },
      ],
      stays: [],
      activities: [],
      shopping: [],
      trivia: [],
      generatedAt: "2026-06-29T00:00:00.000Z",
    };

    expect(
      buildPdfPages(itinerary).some((page) => page.type === "local-details"),
    ).toBe(false);
  });
});
