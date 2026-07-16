import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION } from "./schemas";
import {
  normalizePersistedProjects,
  normalizeProject,
} from "./project-normalization";
import { seedProjects } from "./seed-projects";

describe("project normalization", () => {
  it("adds current PDF defaults to legacy itinerary data", () => {
    const legacy = structuredClone(seedProjects[0]) as Record<string, unknown>;
    const itinerary = {
      id: "legacy-itinerary",
      title: "Legacy",
      country: "Japan",
      duration: "3 days",
      travelerType: "Couple",
      days: [{ day: 1, title: "Arrival" }],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    legacy.schemaVersion = 1;
    legacy.itineraries = [itinerary];

    const normalized = normalizeProject(legacy);

    expect(normalized.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(normalized.itineraries[0].pdfTheme).toBe("beige");
    expect(normalized.itineraries[0].coverImage).toBe("");
    expect(normalized.itineraries[0].days[0].image).toBe("");
  });

  it("repairs stale duration text on an edition's itinerary during load", () => {
    const project = structuredClone(seedProjects[0]) as Record<string, unknown>;
    project.itineraries = [
      {
        id: "it-14",
        plannedEditionId: "edition-14",
        title: "7 days Vietnam itinerary",
        country: "Vietnam",
        duration: "7 days",
        travelerType: "Couple",
        overview: "An energetic 7 days Vietnam route.",
        days: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    project.productionPlan = {
      offerModel: "digital",
      channels: ["etsy"],
      outputs: ["marketplace-listing"],
      editions: [
        {
          id: "edition-14",
          duration: "14 days",
          travelerType: "Couple",
          itineraryId: "it-14",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      review: {},
    };

    const normalized = normalizeProject(project);
    const itinerary = normalized.itineraries[0];

    expect(itinerary.duration).toBe("14 days");
    expect(itinerary.title).toBe("14 days Vietnam itinerary");
    expect(itinerary.overview).toContain("14 days");
    expect(itinerary.overview).not.toContain("7 days");
  });

  it("prefers plannedEditionId over heuristic duration matching", () => {
    const project = structuredClone(seedProjects[0]) as Record<string, unknown>;
    project.itineraries = [
      {
        id: "it-custom",
        plannedEditionId: "edition-14",
        title: "7 days Vietnam itinerary",
        country: "Vietnam",
        duration: "7 days",
        travelerType: "Couple",
        overview: "A 7 days Vietnam route.",
        days: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    project.productionPlan = {
      offerModel: "digital",
      channels: ["etsy"],
      outputs: ["marketplace-listing"],
      editions: [
        {
          id: "edition-7",
          duration: "7 days",
          travelerType: "Couple",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "edition-14",
          duration: "14 days",
          travelerType: "Couple",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      review: {},
    };

    const normalized = normalizeProject(project);

    expect(normalized.itineraries[0].duration).toBe("14 days");
    expect(normalized.itineraries[0].title).toBe("14 days Vietnam itinerary");
  });

  it("preserves an intentionally empty initialized project list", () => {
    expect(
      normalizePersistedProjects({ projects: [], initialized: true }),
    ).toEqual({ projects: [], initialized: true });
  });

  it("migrates legacy deliverables and itineraries into a production plan", () => {
    const legacy = structuredClone(seedProjects[0]) as Record<string, unknown>;
    delete legacy.productionPlan;
    legacy.schemaVersion = 2;
    legacy.deliverables = [
      "PDF",
      "Food guide",
      "Portfolio image prompts",
      "Map pins",
    ];
    legacy.itineraries = [
      {
        id: "legacy-itinerary",
        title: "Legacy",
        country: "Japan",
        duration: "6 days",
        travelerType: "Couple",
        days: [],
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const normalized = normalizeProject(legacy);

    expect(normalized.productionPlan.outputs).toEqual([
      "marketplace-listing",
      "pdf",
      "food-guide",
      "portfolio-visuals",
      "map-pins-legacy",
    ]);
    expect(normalized.productionPlan.editions[0]).toMatchObject({
      duration: "5 days",
      customDays: 6,
      travelerType: "Couple",
      itineraryId: "legacy-itinerary",
    });
    expect(normalized.itineraries[0].plannedEditionId).toBe(
      normalized.productionPlan.editions[0].id,
    );
    expect(normalized.productionPlan.review.liveDataVerified).toBe(false);
  });

  it("strips removed v4 fields and preserves everything else (v4 -> v5)", () => {
    const v4 = structuredClone(seedProjects[0]) as Record<string, unknown>;
    v4.schemaVersion = 4;
    v4.travelStyles = ["Family-friendly"];
    v4.travelerTypes = ["Family", "Couple"];
    v4.durations = ["7 days"];
    v4.deliverables = ["PDF"];
    v4.generated = { "listing-copy": "Some prompt text" };
    v4.matrix = {
      id: "legacy-matrix",
      cells: [
        {
          duration: "7 days",
          travelerType: "Couple",
          variations: [{ label: "Classic", spine: "Tokyo -> Kyoto" }],
        },
      ],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const normalized = normalizeProject(v4) as unknown as Record<
      string,
      unknown
    >;

    expect(normalized.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(normalized.matrix).toBeUndefined();
    expect(normalized.generated).toBeUndefined();
    expect(normalized.travelStyles).toBeUndefined();
    expect(normalized.travelerTypes).toBeUndefined();
    expect(normalized.durations).toBeUndefined();
    expect(normalized.deliverables).toBeUndefined();
    expect(normalized.name).toBe(seedProjects[0].name);
    expect(normalized.country).toBe(seedProjects[0].country);
  });

  it("parses historical aiRuns recorded under removed task types", () => {
    const v4 = structuredClone(seedProjects[0]) as Record<string, unknown>;
    v4.aiRuns = [
      {
        id: "run-1",
        provider: "openai",
        model: "gpt-5.4",
        taskType: "matrix",
        label: "Generated matrix",
        createdAt: "2026-01-01T00:00:00.000Z",
        appliedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const normalized = normalizeProject(v4);

    expect(normalized.aiRuns[0].taskType).toBe("matrix");
  });

  it("seeds the shelf cover image from the first itinerary cover (v5)", () => {
    const v4 = structuredClone(seedProjects[0]) as Record<string, unknown>;
    v4.itineraries = [
      {
        id: "it-1",
        title: "Japan",
        country: "Japan",
        duration: "7 days",
        travelerType: "Couple",
        days: [],
        coverImage: "",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "it-2",
        title: "Japan deluxe",
        country: "Japan",
        duration: "14 days",
        travelerType: "Couple",
        days: [],
        coverImage: "data:image/jpeg;base64,cover",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];

    const normalized = normalizeProject(v4);

    expect(normalized.coverImage).toBe("data:image/jpeg;base64,cover");
  });

  it("keeps an explicit project cover image over itinerary covers", () => {
    const project = structuredClone(seedProjects[0]) as Record<string, unknown>;
    project.coverImage = "data:image/jpeg;base64,explicit";

    expect(normalizeProject(project).coverImage).toBe(
      "data:image/jpeg;base64,explicit",
    );
  });

  it("round-trips a series link", () => {
    const project = structuredClone(seedProjects[0]) as Record<string, unknown>;
    project.series = {
      seriesId: "series-1",
      seriesName: "Southeast Asia pack",
      role: "variant",
      sourceProductId: "japan-family-7",
      addedAt: "2026-01-01T00:00:00.000Z",
    };

    const normalized = normalizeProject(project);

    expect(normalized.series).toMatchObject({
      seriesId: "series-1",
      role: "variant",
      sourceProductId: "japan-family-7",
    });
  });
});
