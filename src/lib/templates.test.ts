import { describe, expect, it } from "vitest";
import { seedProjects } from "./seed-projects";
import { sanitizeProjectForTemplate } from "./templates";

describe("template sanitization", () => {
  it("remints edition and route stop ids while stripping coordinates by default", () => {
    const project = {
      ...structuredClone(seedProjects[0]),
      productionPlan: {
        ...seedProjects[0].productionPlan,
        editions: [
          {
            id: "edition-original",
            duration: "7 days" as const,
            travelerType: "Couple" as const,
            cities: ["Kyoto"],
            route: [
              {
                id: "stop-original",
                city: "Kyoto",
                nights: 7,
                coords: {
                  lat: 35.0116,
                  lng: 135.7681,
                  label: "Kyoto, Japan",
                  provider: "nominatim",
                },
              },
            ],
            itineraryId: "itinerary-original",
            sourceEditionId: "source",
            createdAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
    };

    const template = sanitizeProjectForTemplate(project, {
      name: "Japan starter",
      description: "Starter",
    });

    const edition = template.project.productionPlan.editions[0];
    expect(edition.id).not.toBe("edition-original");
    expect(edition.itineraryId).toBeUndefined();
    expect(edition.sourceEditionId).toBeUndefined();
    expect(edition.route[0].id).not.toBe("stop-original");
    expect(edition.route[0].coords).toBeUndefined();
  });

  it("keeps mapped coordinates only when explicitly requested", () => {
    const project = {
      ...structuredClone(seedProjects[0]),
      productionPlan: {
        ...seedProjects[0].productionPlan,
        editions: [
          {
            id: "edition-original",
            duration: "7 days" as const,
            travelerType: "Couple" as const,
            cities: ["Kyoto"],
            route: [
              {
                id: "stop-original",
                city: "Kyoto",
                nights: 7,
                coords: { lat: 35, lng: 135, provider: "nominatim" },
              },
            ],
            createdAt: "2026-06-01T00:00:00.000Z",
          },
        ],
      },
    };

    const template = sanitizeProjectForTemplate(project, {
      name: "Mapped starter",
      includeStarterRoute: true,
      includeMappedCoords: true,
    });

    expect(template.project.productionPlan.editions[0].route[0].coords).toEqual({
      lat: 35,
      lng: 135,
      provider: "nominatim",
    });
  });

  it("remints trip config ids and preserves brand style and pdf theme", () => {
    const project = structuredClone(seedProjects[0]);
    const originalConfigId = project.tripConfigs[0]?.id;
    project.brandStyle = { ...project.brandStyle, voice: "premium" };
    project.itineraries = [
      {
        id: "itinerary",
        title: "Trip",
        subtitle: "",
        country: "Japan",
        duration: "7 days",
        travelerType: "Couple",
        overview: "",
        whoFor: "",
        routeSummary: "",
        bestStayAreas: "",
        days: [],
        foodGuide: "",
        transportGuide: "",
        packingList: "",
        etiquetteSafety: "",
        bookingChecklist: "",
        personalizationQuestions: "",
        verificationNotes: "Old verification notes",
        pdfTheme: "sage",
        coverImage: "https://example.com/cover.jpg",
        hiddenElements: [],
        customBlocks: [],
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z",
      },
    ];

    const template = sanitizeProjectForTemplate(project, {
      name: "Style starter",
    });

    expect(template.project.brandStyle.voice).toBe("premium");
    expect(template.project.pdfTheme).toBe("sage");
    if (originalConfigId) {
      expect(template.project.tripConfigs[0].id).not.toBe(originalConfigId);
    }
  });
});
