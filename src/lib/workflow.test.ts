import { describe, expect, it } from "vitest";
import { buildContext, buildItinerary, buildListing } from "./generation";
import { normalizeProject } from "./project-normalization";
import { createEmptyTripConfig, projectSchema } from "./schemas";
import {
  dayRangeForStop,
  defaultRoute,
  editionContextOptions,
  extractLiveDataClaims,
  getProjectWorkflow,
  itineraryBlockers,
  lintProjectForPublish,
  normalizeRoute,
  readinessFingerprint,
  routeNights,
  routeToCities,
} from "./workflow";

const now = "2026-06-13T10:00:00.000Z";

function projectFixture() {
  const config = createEmptyTripConfig({
    id: "config",
    cities: ["Lisbon", "Porto"],
    duration: "5 days",
    travelerType: "Couple",
    deliverables: ["PDF", "Food guide"],
    updatedAt: now,
  });
  let project = normalizeProject({
    id: "project",
    name: "Portugal Escape",
    country: "Portugal",
    regions: ["Lisbon", "Porto"],
    positioning: "A calm, rail-first introduction to Portugal.",
    targetAudience: "First-time couples",
    tripConfigs: [config],
    productionPlan: {
      offerModel: "digital",
      channels: ["etsy"],
      outputs: ["marketplace-listing", "pdf", "food-guide"],
      editions: [
        {
          id: "edition",
          duration: "5 days",
          travelerType: "Couple",
          createdAt: now,
        },
      ],
      review: {},
    },
    status: "In progress",
    createdAt: now,
    updatedAt: now,
  });
  const itinerary = buildItinerary(buildContext(project), {
    duration: "5 days",
    travelerType: "Couple",
  });
  itinerary.id = "itinerary";
  itinerary.plannedEditionId = "edition";
  itinerary.title = "Five Days in Portugal";
  itinerary.overview = "A balanced route through Lisbon and Porto.";
  itinerary.whoFor = "First-time couples";
  itinerary.routeSummary = "Lisbon to Porto by rail.";
  itinerary.foodGuide = "Neighborhood markets and traditional restaurants.";
  itinerary.verificationNotes = "Verify live hours, prices, and availability.";
  itinerary.days = itinerary.days.map((day) => ({
    ...day,
    base: day.base || "Lisbon",
    morning: "Explore a compact neighborhood on foot.",
  }));
  const listing = buildListing(buildContext(project));
  listing.deliveryNotes = "Delivered as editable PDF and spreadsheet files.";
  project = projectSchema.parse({
    ...project,
    itineraries: [itinerary],
    listing,
    productionPlan: {
      ...project.productionPlan,
      editions: [
        {
          ...project.productionPlan.editions[0],
          itineraryId: itinerary.id,
        },
      ],
    },
  });
  return project;
}

describe("project workflow", () => {
  it("requires committed editions and useful itinerary content", () => {
    const project = projectFixture();
    expect(itineraryBlockers(project, project.productionPlan.editions[0])).toEqual(
      [],
    );
    expect(getProjectWorkflow(project).recommendedStage).toBe("publish");
  });

  it("adapts listing requirements for service offers", () => {
    const project = projectFixture();
    const service = projectSchema.parse({
      ...project,
      productionPlan: {
        ...project.productionPlan,
        offerModel: "service",
        channels: ["fiverr"],
      },
      listing: {
        ...project.listing,
        packages: project.listing?.packages.map((item) => ({
          ...item,
          price: "",
        })),
        buyerRequirements: [],
      },
    });
    const labels = getProjectWorkflow(service).blockers.map((issue) => issue.label);
    expect(labels).toContain("Price at least one service package");
    expect(labels).toContain("Add buyer requirements");
  });

  it("requires all selected portfolio briefs to be final", () => {
    const project = projectSchema.parse({
      ...projectFixture(),
      productionPlan: {
        ...projectFixture().productionPlan,
        outputs: [
          "marketplace-listing",
          "pdf",
          "food-guide",
          "portfolio-visuals",
        ],
      },
    });
    expect(getProjectWorkflow(project).blockers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "portfolio-visuals" }),
      ]),
    );
  });

  it("excludes review and status from readiness invalidation", () => {
    const project = projectFixture();
    const reviewed = projectSchema.parse({
      ...project,
      status: "Ready to sell",
      productionPlan: {
        ...project.productionPlan,
        review: {
          liveDataVerified: true,
          presentationReviewed: true,
          backupConfirmed: true,
          confirmedAt: now,
        },
      },
    });
    expect(readinessFingerprint(reviewed)).toBe(readinessFingerprint(project));
    expect(
      readinessFingerprint({ ...reviewed, positioning: "A different promise." }),
    ).not.toBe(readinessFingerprint(project));
  });

  it("does not duplicate missing verification notes between blockers and linter", () => {
    const project = projectFixture();
    const itinerary = {
      ...project.itineraries[0],
      verificationNotes: "",
    };
    const withoutNotes = projectSchema.parse({
      ...project,
      itineraries: [itinerary],
    });

    const labels = getProjectWorkflow(withoutNotes).blockers.map(
      (issue) => issue.label,
    );

    expect(labels.filter((label) => label.includes("Add verification notes"))).toHaveLength(1);
    expect(lintProjectForPublish(withoutNotes)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "edition-verification-notes" }),
      ]),
    );
  });

  it("extracts only live-data sentences for deterministic fixes", () => {
    const result = extractLiveDataClaims(
      "Start with a quiet garden walk. Museum tickets cost $18. Dinner is flexible.",
    );

    expect(result.claims).toEqual(["Museum tickets cost $18."]);
    expect(result.cleaned).toBe(
      "Start with a quiet garden walk. Dinner is flexible.",
    );
  });
});

describe("editionContextOptions", () => {
  it("prefers the linked edition's duration and traveler type", () => {
    const base = projectFixture();
    const project = projectSchema.parse({
      ...base,
      productionPlan: {
        ...base.productionPlan,
        editions: [
          ...base.productionPlan.editions,
          {
            id: "edition-14",
            duration: "14 days",
            travelerType: "Family",
            createdAt: now,
          },
        ],
      },
    });
    // A 14-day edition's itinerary still carrying a stale 7-day-ish base.
    const itinerary = {
      ...project.itineraries[0],
      plannedEditionId: "edition-14",
      duration: "7 days",
      travelerType: "Couple" as const,
    };

    expect(editionContextOptions(project, itinerary)).toMatchObject({
      duration: "14 days",
      travelerType: "Family",
    });
  });

  it("falls back to the itinerary's own label when unlinked", () => {
    const project = projectFixture();
    const itinerary = {
      ...project.itineraries[0],
      plannedEditionId: undefined,
      duration: "10 days",
      travelerType: "Group" as const,
    };

    expect(editionContextOptions(project, itinerary)).toMatchObject({
      duration: "10 days",
      travelerType: "Group",
    });
  });

  it("returns only extra cities when no itinerary is given", () => {
    const project = projectFixture();
    expect(editionContextOptions(project)).toEqual({ extraCities: [] });
  });
});

describe("route helpers", () => {
  it("defaultRoute spreads nights evenly, remainder to earliest stops", () => {
    const route = defaultRoute(["Tokyo", "Kyoto", "Osaka"], [], 7);
    expect(route.map((s) => s.city)).toEqual(["Tokyo", "Kyoto", "Osaka"]);
    expect(route.map((s) => s.nights)).toEqual([3, 2, 2]);
    expect(routeNights(route)).toBe(7);
    expect(route[0].arriveBy).toBeUndefined();
    expect(route[1].arriveBy).toBe("train");
  });

  it("defaultRoute merges brief cities with extras and de-dupes", () => {
    const route = defaultRoute(["Tokyo"], ["Tokyo", "Kyoto"], 4);
    expect(route.map((s) => s.city)).toEqual(["Tokyo", "Kyoto"]);
    expect(routeNights(route)).toBe(4);
  });

  it("dayRangeForStop is cumulative (2+2+1 => 1-2 / 3-4 / 5)", () => {
    const route = [
      { id: "a", city: "Tokyo", nights: 2 },
      { id: "b", city: "Kyoto", nights: 2, arriveBy: "train" as const },
      { id: "c", city: "Osaka", nights: 1, arriveBy: "flight" as const },
    ];
    expect(dayRangeForStop(route, 0)).toEqual({ start: 1, end: 2 });
    expect(dayRangeForStop(route, 1)).toEqual({ start: 3, end: 4 });
    expect(dayRangeForStop(route, 2)).toEqual({ start: 5, end: 5 });
  });

  it("routeToCities returns only stops beyond the brief", () => {
    const route = [
      { id: "a", city: "Tokyo", nights: 2 },
      { id: "b", city: "Kyoto", nights: 2 },
      { id: "c", city: "Hakone", nights: 1 },
    ];
    expect(routeToCities(route, ["Tokyo", "Kyoto"])).toEqual(["Hakone"]);
  });

  it("normalizeRoute clears the first leg and back-fills the rest", () => {
    const route = normalizeRoute([
      { id: "a", city: "Tokyo", nights: 2, arriveBy: "flight" as const },
      { id: "b", city: "Kyoto", nights: 2 },
    ]);
    expect(route[0].arriveBy).toBeUndefined();
    expect(route[1].arriveBy).toBe("train");
  });
});
