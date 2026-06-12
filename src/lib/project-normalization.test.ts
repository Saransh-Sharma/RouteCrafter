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

  it("preserves an intentionally empty initialized project list", () => {
    expect(
      normalizePersistedProjects({ projects: [], initialized: true }),
    ).toEqual({ projects: [], initialized: true });
  });
});
