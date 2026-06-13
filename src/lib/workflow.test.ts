import { describe, expect, it } from "vitest";
import { buildContext, buildItinerary, buildListing } from "./generation";
import { normalizeProject } from "./project-normalization";
import { createEmptyTripConfig, projectSchema } from "./schemas";
import {
  getProjectWorkflow,
  itineraryBlockers,
  readinessFingerprint,
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
});
