import { describe, expect, it } from "vitest";
import { seedProjects } from "@/lib/seed-projects";
import { buildContext, buildItinerary, buildListing } from "@/lib/generation";
import { projectSchema, type Project } from "@/lib/schemas";
import { cloneProductSkeleton, sourcePdfTheme } from "./clone";

function finishedSource(): Project {
  const base = structuredClone(seedProjects[0]);
  const context = buildContext(base);
  const itinerary = buildItinerary(context, {
    duration: "7 days",
    travelerType: "Couple",
  });
  itinerary.coverImage = "data:image/jpeg;base64,cover";
  itinerary.pdfTheme = "noir";
  const edition = {
    id: "src-edition",
    duration: "7 days" as const,
    travelerType: "Couple" as const,
    cities: ["Tokyo", "Kyoto"],
    route: [
      { id: "r1", city: "Tokyo", nights: 4 },
      { id: "r2", city: "Kyoto", nights: 3, arriveBy: "train" as const },
    ],
    itineraryId: itinerary.id,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  itinerary.plannedEditionId = edition.id;
  return projectSchema.parse({
    ...base,
    positioning: "Human-paced Japan.",
    itineraries: [itinerary],
    listing: buildListing(context),
    productionPlan: {
      ...base.productionPlan,
      editions: [edition],
      review: {
        liveDataVerified: true,
        presentationReviewed: true,
        backupConfirmed: true,
      },
    },
    status: "Ready to sell",
  });
}

const series = {
  seriesId: "series-1",
  seriesName: "Food & culture series",
  role: "variant" as const,
  sourceProductId: "japan-family-7",
  addedAt: "2026-07-01T00:00:00.000Z",
};

describe("cloneProductSkeleton", () => {
  it("preserves commercial structure and blanks country content", () => {
    const source = finishedSource();
    const clone = cloneProductSkeleton({
      source,
      targetCountry: "Italy",
      series,
    });

    // Structure preserved
    expect(clone.productionPlan.offerModel).toBe(
      source.productionPlan.offerModel,
    );
    expect(clone.productionPlan.channels).toEqual(
      source.productionPlan.channels,
    );
    expect(clone.productionPlan.outputs).toEqual(source.productionPlan.outputs);
    expect(clone.brandStyle).toEqual(source.brandStyle);
    expect(clone.productionPlan.editions).toHaveLength(1);
    expect(clone.productionPlan.editions[0]).toMatchObject({
      duration: "7 days",
      travelerType: "Couple",
      sourceEditionId: "src-edition",
    });
    expect(clone.tripConfigs.map((config) => config.travelStyles)).toEqual(
      source.tripConfigs.map((config) => config.travelStyles),
    );

    // Country content blanked
    expect(clone.country).toBe("Italy");
    expect(clone.regions).toEqual([]);
    expect(clone.positioning).toBe("");
    expect(clone.itineraries).toEqual([]);
    expect(clone.listing).toBeUndefined();
    expect(clone.imagePrompts).toEqual([]);
    expect(clone.coverImage).toBe("");
    expect(clone.productionPlan.editions[0].route).toEqual([]);
    expect(clone.productionPlan.editions[0].itineraryId).toBeUndefined();
    expect(clone.aiRuns).toEqual([]);
    expect(clone.status).toBe("Draft");
    expect(clone.productionPlan.review.liveDataVerified).toBe(false);

    // Identity
    expect(clone.id).not.toBe(source.id);
    expect(clone.name).toContain("Italy");
    expect(clone.name).not.toContain("Japan");
    expect(clone.series).toEqual(series);
  });

  it("keeps the source untouched and passes schema validation", () => {
    const source = finishedSource();
    const before = JSON.stringify(source);
    const clone = cloneProductSkeleton({
      source,
      targetCountry: "Portugal",
      series,
    });
    expect(JSON.stringify(source)).toBe(before);
    expect(() => projectSchema.parse(clone)).not.toThrow();
  });

  it("carries the source PDF theme forward", () => {
    expect(sourcePdfTheme(finishedSource())).toBe("noir");
  });
});
