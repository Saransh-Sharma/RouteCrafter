import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
        const payload = init?.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify({
            project: { project: payload.project, revision: 1 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );
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

  afterEach(() => {
    vi.unstubAllEnvs();
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

  it("serializes rapid cloud sync writes with the returned revision", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const project = useProjectsStore.getState().projects[0];
    let resolveFirst!: (response: Response) => void;
    const firstResponse = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        if (fetchMock.mock.calls.length === 1) return firstResponse;
        const payload = init?.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify({
            project: { project: payload.project, revision: 3 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    useProjectsStore.setState({
      lastCloudRevisionByProject: { [project.id]: 1 },
    });

    useProjectsStore.getState().update(project.id, { name: "First edit" });
    useProjectsStore.getState().update(project.id, { country: "Japan" });
    await Promise.resolve();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFirst(
      new Response(
        JSON.stringify({
          project: {
            project: JSON.parse(
              String((fetchMock.mock.calls[0][1] as RequestInit).body),
            ).project,
            revision: 2,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(
      String((fetchMock.mock.calls[0][1] as RequestInit).body),
    );
    const secondBody = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body),
    );
    expect(firstBody.expectedRevision).toBe(1);
    expect(secondBody.expectedRevision).toBe(2);
    expect(secondBody.project.country).toBe("Japan");
    expect(useProjectsStore.getState().lastCloudRevisionByProject[project.id]).toBe(3);
  });

  it("merges cloud hydration with local-only projects", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const local = {
      ...structuredClone(seedProjects[0]),
      id: "local-only-project",
      name: "Local Only Project",
      updatedAt: "2026-06-15T00:00:00.000Z",
    };
    const cloud = {
      ...structuredClone(seedProjects[1]),
      id: "cloud-project",
      name: "Cloud Project",
      updatedAt: "2026-06-16T00:00:00.000Z",
    };
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const path = String(url);
      if (path === "/api/projects") {
        return new Response(
          JSON.stringify({ projects: [{ project: cloud, revision: 4 }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          projects: [
            { project: cloud, revision: 4 },
            { project: local, revision: 1 },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    useProjectsStore.setState({
      projects: [local],
      initialized: true,
      cloudHydrated: false,
      lastCloudRevisionByProject: {},
    });

    await useProjectsStore.getState().hydrateCloudProjects();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useProjectsStore.getState().projects.map((project) => project.id)).toEqual([
      "cloud-project",
      "local-only-project",
    ]);
    expect(useProjectsStore.getState().lastCloudRevisionByProject).toMatchObject({
      "cloud-project": 4,
      "local-only-project": 1,
    });
  });

  it("sends the expected cloud revision when deleting", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const project = useProjectsStore.getState().projects[0];
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    useProjectsStore.setState({
      lastCloudRevisionByProject: { [project.id]: 7 },
    });

    expect(useProjectsStore.getState().remove(project.id).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/projects/${project.id}`,
      expect.objectContaining({
        method: "DELETE",
        body: JSON.stringify({ expectedRevision: 7 }),
      }),
    );
  });

  it("retries the latest queued project snapshot after a failed sync", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const project = useProjectsStore.getState().projects[0];
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            project: {
              project: { ...project, name: "Recovered edit" },
              revision: 2,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    useProjectsStore.getState().update(project.id, { name: "Failed edit" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    useProjectsStore.getState().update(project.id, { name: "Recovered edit" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const retryBody = JSON.parse(
      String((fetchMock.mock.calls[1][1] as RequestInit).body),
    );
    expect(retryBody.project.name).toBe("Recovered edit");
    expect(useProjectsStore.getState().syncStatus).toBe("synced");
  });
});
