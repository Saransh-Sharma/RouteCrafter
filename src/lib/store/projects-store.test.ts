import { beforeEach, describe, expect, it } from "vitest";
import { seedProjects } from "../seed-projects";
import {
  MAX_PERSISTED_STATE_CHARS,
  useProjectsStore,
} from "./projects-store";

describe("projects store mutations", () => {
  beforeEach(() => {
    useProjectsStore.setState({
      projects: [structuredClone(seedProjects[0])],
      initialized: true,
      hasHydrated: true,
      persistenceError: null,
    });
  });

  it("applies nested itinerary patches against the latest project state", () => {
    const project = useProjectsStore.getState().projects[0];
    const now = "2026-01-01T00:00:00.000Z";
    useProjectsStore.getState().update(project.id, {
      itineraries: [
        {
          id: "itinerary",
          title: "Trip",
          subtitle: "",
          country: "Japan",
          duration: "3 days",
          travelerType: "Couple",
          overview: "",
          whoFor: "",
          routeSummary: "",
          bestStayAreas: "",
          days: [
            {
              day: 1,
              title: "Arrival",
              base: "",
              morning: "",
              lunch: "",
              afternoon: "",
              evening: "",
              dinner: "",
              transportNotes: "",
              bookingNotes: "",
              walkingIntensity: "",
              optionalUpgrade: "",
              lowEnergyAlternative: "",
              rainyDayAlternative: "",
              whyThisWorks: "",
              image: "",
            },
          ],
          foodGuide: "",
          transportGuide: "",
          packingList: "",
          etiquetteSafety: "",
          bookingChecklist: "",
          personalizationQuestions: "",
          verificationNotes: "",
          pdfTheme: "beige",
          coverImage: "",
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    const store = useProjectsStore.getState();
    expect(
      store.patchItinerary(project.id, "itinerary", { pdfTheme: "sage" }).ok,
    ).toBe(true);
    expect(
      store.patchItinerary(project.id, "itinerary", (itinerary) => ({
        ...itinerary,
        coverImage: "data:image/jpeg;base64,abc",
      })).ok,
    ).toBe(true);

    const itinerary =
      useProjectsStore.getState().projects[0].itineraries[0];
    expect(itinerary.pdfTheme).toBe("sage");
    expect(itinerary.coverImage).toBe("data:image/jpeg;base64,abc");
  });

  it("rejects oversized updates and keeps the previous project", () => {
    const project = useProjectsStore.getState().projects[0];
    const result = useProjectsStore.getState().update(project.id, {
      generated: { huge: "x".repeat(MAX_PERSISTED_STATE_CHARS) },
    });

    expect(result.ok).toBe(false);
    expect(useProjectsStore.getState().projects[0].generated.huge).toBeUndefined();
    expect(useProjectsStore.getState().persistenceError).toContain(
      "browser-storage limit",
    );
  });

  it("keeps an intentionally empty project list empty after rehydration", async () => {
    const id = useProjectsStore.getState().projects[0].id;
    expect(useProjectsStore.getState().remove(id).ok).toBe(true);
    expect(useProjectsStore.getState().projects).toEqual([]);

    await useProjectsStore.persist.rehydrate();

    expect(useProjectsStore.getState().initialized).toBe(true);
    expect(useProjectsStore.getState().projects).toEqual([]);
  });
});
