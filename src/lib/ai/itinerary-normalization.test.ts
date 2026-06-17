import { describe, expect, it } from "vitest";
import { buildContext, buildItinerary } from "@/lib/generation";
import { seedProjects } from "@/lib/seed-projects";
import { normalizeAiItinerary } from "./itinerary-normalization";

describe("AI itinerary normalization", () => {
  it("preserves selected itinerary metadata and coerces enum lists", () => {
    const project = structuredClone(seedProjects[0]);
    const current = buildItinerary(buildContext(project), {
      duration: "7 days",
      travelerType: "Couple",
      style: "Classic first-timer",
      budget: "Mid-range",
    });
    current.id = "itinerary-1";
    current.plannedEditionId = "edition-1";
    current.pdfTheme = "sage";
    current.coverImage = "data:image/png;base64,cover";

    const normalized = normalizeAiItinerary(
      {
        ...current,
        id: "model-id",
        plannedEditionId: "model-edition",
        country: "Wrong country",
        duration: "14 days",
        travelerType: "Family",
        style:
          "Classic first-timer, Premium comfort, Family-friendly, Budget-friendly",
        budget: "Premium, Luxury",
        pdfTheme: "noir",
        coverImage: "",
      },
      {
        project,
        current,
        fallback: {
          id: "fallback-id",
          duration: "3 days",
          travelerType: "Solo",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      },
    );

    expect(normalized.id).toBe("itinerary-1");
    expect(normalized.plannedEditionId).toBe("edition-1");
    expect(normalized.country).toBe(project.country);
    expect(normalized.duration).toBe("7 days");
    expect(normalized.travelerType).toBe("Couple");
    expect(normalized.style).toBe("Classic first-timer");
    expect(normalized.budget).toBe("Premium");
    expect(normalized.pdfTheme).toBe("sage");
    expect(normalized.coverImage).toBe("data:image/png;base64,cover");
  });
});
