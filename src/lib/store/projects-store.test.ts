import { beforeEach, describe, expect, it } from "vitest";
import { seedProjects } from "../seed-projects";
import {
  MAX_PERSISTED_STATE_CHARS,
  useProjectsStore,
} from "./projects-store";
import { useActivityStore } from "./activity-store";
import { useAuthStore } from "./auth-store";

describe("projects store mutations", () => {
  beforeEach(() => {
    localStorage.clear();
    useActivityStore.setState({ entries: [] });
    useAuthStore.setState({
      user: {
        id: "user_test",
        username: "test",
        displayName: "Test User",
        email: "test@example.com",
        role: "editor",
      },
      isHydrating: false,
      isSubmitting: false,
      error: null,
    });
    useProjectsStore.setState({
      projects: [structuredClone(seedProjects[0])],
      initialized: true,
      hasHydrated: true,
      persistenceError: null,
    });
  });

  it("logs the specific project fields changed by an update", () => {
    const project = useProjectsStore.getState().projects[0];
    const result = useProjectsStore.getState().update(project.id, {
      name: "Japan Premium Itinerary Product",
      country: "Japan and South Korea",
    });

    expect(result.ok).toBe(true);
    const entry = useActivityStore.getState().entries[0];
    expect(entry).toMatchObject({
      projectId: project.id,
      userId: "user_test",
      action: "updated",
      detail: "updated name, country, and status",
    });
  });

  it("keeps a generic update detail when only noisy fields changed", () => {
    const project = useProjectsStore.getState().projects[0];
    const result = useProjectsStore.getState().updateProject(project.id, (p) => ({
      ...p,
      updatedAt: "2026-02-01T00:00:00.000Z",
    }));

    expect(result.ok).toBe(true);
    expect(useActivityStore.getState().entries[0]?.detail).toBe(
      "updated project details",
    );
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

  it("invalidates publish confirmation after a readiness-sensitive edit", () => {
    const project = useProjectsStore.getState().projects[0];
    useProjectsStore.setState({
      projects: [
        {
          ...project,
          status: "Ready to sell",
          productionPlan: {
            ...project.productionPlan,
            review: {
              liveDataVerified: true,
              presentationReviewed: true,
              backupConfirmed: true,
              confirmedAt: "2026-06-13T10:00:00.000Z",
            },
          },
        },
      ],
    });

    useProjectsStore.getState().update(project.id, {
      positioning: "A newly revised product promise.",
    });

    const updated = useProjectsStore.getState().projects[0];
    expect(updated.status).toBe("In progress");
    expect(updated.productionPlan.review).toEqual({
      liveDataVerified: false,
      presentationReviewed: false,
      backupConfirmed: false,
    });
  });

  it("resets publish confirmation when duplicating a ready project", () => {
    const project = useProjectsStore.getState().projects[0];
    useProjectsStore.setState({
      projects: [
        {
          ...project,
          status: "Ready to sell",
          productionPlan: {
            ...project.productionPlan,
            review: {
              liveDataVerified: true,
              presentationReviewed: true,
              backupConfirmed: true,
              confirmedAt: "2026-06-13T10:00:00.000Z",
            },
          },
        },
      ],
    });

    const copy = useProjectsStore.getState().duplicate(project.id);

    expect(copy?.status).toBe("Draft");
    expect(copy?.productionPlan.review).toEqual({
      liveDataVerified: false,
      presentationReviewed: false,
      backupConfirmed: false,
    });
  });
});
