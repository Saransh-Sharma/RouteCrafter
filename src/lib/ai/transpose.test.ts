import { describe, expect, it } from "vitest";
import { seedProjects } from "@/lib/seed-projects";
import { buildContext, buildItinerary } from "@/lib/generation";
import { projectSchema, type Project } from "@/lib/schemas";
import {
  buildListingReferenceFocus,
  buildRouteTranspositionPrompt,
  buildStyleReferenceDigest,
  routeTranspositionSchema,
} from "./transpose";

function sourceWithRoute(): Project {
  const base = structuredClone(seedProjects[0]);
  return projectSchema.parse({
    ...base,
    positioning: "Human-paced Japan with food and rail.",
    productionPlan: {
      ...base.productionPlan,
      editions: [
        {
          id: "src-edition",
          duration: "7 days",
          travelerType: "Couple",
          cities: [],
          route: [
            { id: "r1", city: "Tokyo", nights: 4 },
            { id: "r2", city: "Kyoto", nights: 3, arriveBy: "train" },
          ],
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
  });
}

describe("buildRouteTranspositionPrompt", () => {
  it("includes the source route table, night budget, and constraints", () => {
    const source = sourceWithRoute();
    const prompt = buildRouteTranspositionPrompt({
      source,
      edition: source.productionPlan.editions[0],
      targetCountry: "Italy",
    });

    expect(prompt).toContain("Tokyo — 4 nights");
    expect(prompt).toContain("Kyoto — 3 nights (arrive by train)");
    expect(prompt).toContain("exactly 7 nights");
    expect(prompt).toContain("Target country: Italy");
    expect(prompt).toContain("same number of stops");
    expect(prompt).toContain("real, canonical destination in Italy");
    expect(prompt).toContain("Do not invent live hours");
    expect(prompt).toContain("Return only valid JSON");
  });

  it("asks for a from-scratch route when nothing seeds one", () => {
    // A bare batch-mode spec: no explicit route, no brief cities, no regions.
    const source = projectSchema.parse({
      ...sourceWithRoute(),
      regions: [],
      tripConfigs: [],
    });
    const edition = {
      ...source.productionPlan.editions[0],
      route: [],
      cities: [],
    };
    const prompt = buildRouteTranspositionPrompt({
      source,
      edition,
      targetCountry: "Portugal",
    });
    expect(prompt).toContain("design the canonical route from scratch");
  });
});

describe("routeTranspositionSchema", () => {
  it("accepts a well-formed response and rejects an empty route", () => {
    expect(
      routeTranspositionSchema.parse({
        name: "Italy Food & Culture Itinerary Product",
        regions: ["Rome", "Florence"],
        positioning: "Human-paced Italy.",
        targetAudience: "First-time couples",
        route: [
          { city: "Rome", nights: 4 },
          { city: "Florence", nights: 3, arriveBy: "train" },
        ],
      }).route,
    ).toHaveLength(2);

    expect(
      routeTranspositionSchema.safeParse({ name: "X", route: [] }).success,
    ).toBe(false);
  });
});

describe("style and listing references", () => {
  it("digests the source itinerary without leaking whole-document JSON", () => {
    const source = sourceWithRoute();
    const itinerary = buildItinerary(buildContext(source), {
      duration: "7 days",
      travelerType: "Couple",
    });
    itinerary.overview = "A relaxed, food-first route.";
    const digest = buildStyleReferenceDigest(itinerary);

    expect(digest).toContain("Match the structure, voice");
    expect(digest).toContain("do NOT reuse its places");
    expect(digest!.length).toBeLessThan(2500);
  });

  it("returns undefined without a source itinerary or listing", () => {
    expect(buildStyleReferenceDigest(undefined)).toBeUndefined();
    expect(
      buildListingReferenceFocus(sourceWithRoute()),
    ).toBeUndefined();
  });
});
