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
});
