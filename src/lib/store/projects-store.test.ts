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
              needsRefresh: false,
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
          hiddenElements: [],
          customBlocks: [],
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

const jsonHeaders = { "Content-Type": "application/json" };

async function flushAsync(times = 4): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

describe("shared workspace cloud freshness and conflicts", () => {
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
      conflictByProject: {},
      lastCloudRevisionByProject: {},
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("refreshFromCloud adopts cloud copies and drops projects deleted elsewhere", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const localA = {
      ...structuredClone(seedProjects[0]),
      id: "project-a",
      name: "Local A",
      updatedAt: "2026-06-10T00:00:00.000Z",
    };
    const localB = {
      ...structuredClone(seedProjects[0]),
      id: "project-b",
      name: "Local B",
      updatedAt: "2026-06-10T00:00:00.000Z",
    };
    useProjectsStore.setState({
      projects: [localA, localB],
      lastCloudRevisionByProject: { "project-a": 1, "project-b": 1 },
    });
    const cloudA = {
      ...localA,
      name: "Cloud A (teammate edit)",
      updatedAt: "2026-06-12T00:00:00.000Z",
    };
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const path = String(url);
      if (path === "/api/projects/revisions") {
        return new Response(
          JSON.stringify({
            revisions: [
              { id: "project-a", revision: 5, updatedAt: cloudA.updatedAt },
            ],
          }),
          { status: 200, headers: jsonHeaders },
        );
      }
      if (path === "/api/projects/project-a") {
        return new Response(
          JSON.stringify({ project: { project: cloudA, revision: 5 } }),
          { status: 200, headers: jsonHeaders },
        );
      }
      return new Response("{}", { status: 404, headers: jsonHeaders });
    });
    vi.stubGlobal("fetch", fetchMock);

    await useProjectsStore.getState().refreshFromCloud();

    const projects = useProjectsStore.getState().projects;
    expect(projects.map((p) => p.id)).toEqual(["project-a"]);
    expect(projects[0].name).toBe("Cloud A (teammate edit)");
    expect(
      useProjectsStore.getState().lastCloudRevisionByProject["project-a"],
    ).toBe(5);
    // project-b was unchanged in the probe but absent from cloud => deleted, so
    // it should not be among the body fetches.
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/projects/project-b",
      expect.anything(),
    );
  });

  it("skips body fetches and commits when nothing changed", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const local = {
      ...structuredClone(seedProjects[0]),
      id: "project-a",
      name: "Local A",
      updatedAt: "2026-06-10T00:00:00.000Z",
    };
    useProjectsStore.setState({
      projects: [local],
      lastCloudRevisionByProject: { "project-a": 3 },
    });
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const path = String(url);
      if (path === "/api/projects/revisions") {
        return new Response(
          JSON.stringify({
            revisions: [
              { id: "project-a", revision: 3, updatedAt: local.updatedAt },
            ],
          }),
          { status: 200, headers: jsonHeaders },
        );
      }
      throw new Error(`unexpected fetch: ${path}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await useProjectsStore.getState().refreshFromCloud();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useProjectsStore.getState().cloudHydrated).toBe(true);
    expect(useProjectsStore.getState().projects[0].name).toBe("Local A");
  });

  it("keeps a dirty project's local copy during a refresh", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const project = useProjectsStore.getState().projects[0];
    let resolveWrite: (value: Response) => void = () => {};
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const path = String(url);
      const method = init?.method ?? "GET";
      if (method === "PUT" || method === "POST") {
        // Hold the write open so the project stays dirty (in-flight) during refresh.
        return new Promise<Response>((resolve) => {
          resolveWrite = resolve;
        });
      }
      if (path === "/api/projects/revisions") {
        return new Response(
          JSON.stringify({
            revisions: [
              { id: project.id, revision: 9, updatedAt: "2026-06-20T00:00:00.000Z" },
            ],
          }),
          { status: 200, headers: jsonHeaders },
        );
      }
      return new Response("{}", { status: 404, headers: jsonHeaders });
    });
    vi.stubGlobal("fetch", fetchMock);
    useProjectsStore.setState({ lastCloudRevisionByProject: { [project.id]: 1 } });

    // Start a local edit; its write is held open => project is dirty/in-flight.
    useProjectsStore.getState().update(project.id, { name: "My unsaved edit" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    await useProjectsStore.getState().refreshFromCloud();

    // The dirty project keeps its local name and the probe does not pull its body.
    expect(
      useProjectsStore.getState().projects.find((p) => p.id === project.id)?.name,
    ).toBe("My unsaved edit");
    expect(fetchMock).not.toHaveBeenCalledWith(
      `/api/projects/${project.id}`,
      expect.objectContaining({ method: "GET" }),
    );
    // The dirty project's expected revision is not advanced by the probe.
    expect(
      useProjectsStore.getState().lastCloudRevisionByProject[project.id],
    ).toBe(1);
    resolveWrite(
      new Response(
        JSON.stringify({ project: { project, revision: 2 } }),
        { status: 200, headers: jsonHeaders },
      ),
    );
    await flushAsync();
  });

  it("never regresses a clean project's revision on a stale read", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const local = {
      ...structuredClone(seedProjects[0]),
      id: "project-a",
      name: "Fresh local (rev 5)",
      updatedAt: "2026-06-15T00:00:00.000Z",
    };
    useProjectsStore.setState({
      projects: [local],
      lastCloudRevisionByProject: { "project-a": 5 },
    });
    // The probe reports a newer revision, but the body fetch returns a stale
    // (lower) revision, simulating read-replica lag.
    const staleBody = {
      ...local,
      name: "Stale replica copy (rev 4)",
      updatedAt: "2026-06-13T00:00:00.000Z",
    };
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const path = String(url);
      if (path === "/api/projects/revisions") {
        return new Response(
          JSON.stringify({
            revisions: [
              { id: "project-a", revision: 6, updatedAt: "2026-06-16T00:00:00.000Z" },
            ],
          }),
          { status: 200, headers: jsonHeaders },
        );
      }
      return new Response(
        JSON.stringify({ project: { project: staleBody, revision: 4 } }),
        { status: 200, headers: jsonHeaders },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await useProjectsStore.getState().refreshFromCloud();

    // The stale body must not overwrite the fresher local copy or lower the revision.
    expect(useProjectsStore.getState().projects[0].name).toBe("Fresh local (rev 5)");
    expect(
      useProjectsStore.getState().lastCloudRevisionByProject["project-a"],
    ).toBe(5);
  });

  it("records a conflict when the cloud rejects a stale write", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const project = useProjectsStore.getState().projects[0];
    const cloudProject = {
      ...structuredClone(project),
      name: "Teammate's newer name",
    };
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "PUT") {
          return new Response(JSON.stringify({ error: "conflict" }), {
            status: 409,
            headers: jsonHeaders,
          });
        }
        return new Response(
          JSON.stringify({
            project: {
              project: cloudProject,
              revision: 9,
              updatedByName: "Teammate",
            },
          }),
          { status: 200, headers: jsonHeaders },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    useProjectsStore.setState({
      lastCloudRevisionByProject: { [project.id]: 1 },
    });

    useProjectsStore.getState().update(project.id, { name: "My local name" });
    await flushAsync();

    const conflict = useProjectsStore.getState().conflictByProject[project.id];
    expect(conflict).toBeTruthy();
    expect(conflict.cloudRevision).toBe(9);
    expect(conflict.updatedByName).toBe("Teammate");
    expect(conflict.cloudProject.name).toBe("Teammate's newer name");
    expect(
      useProjectsStore.getState().lastCloudRevisionByProject[project.id],
    ).toBe(9);
  });

  it("adopts the cloud copy when a conflict is reloaded", () => {
    const project = useProjectsStore.getState().projects[0];
    const cloudProject = { ...structuredClone(project), name: "Cloud wins" };
    useProjectsStore.setState({
      conflictByProject: {
        [project.id]: {
          projectId: project.id,
          cloudProject,
          cloudRevision: 5,
          updatedByName: "Teammate",
          kind: "update",
        },
      },
      lastCloudRevisionByProject: { [project.id]: 5 },
    });

    useProjectsStore.getState().resolveConflictReload(project.id);

    expect(
      useProjectsStore.getState().projects.find((p) => p.id === project.id)
        ?.name,
    ).toBe("Cloud wins");
    expect(
      useProjectsStore.getState().conflictByProject[project.id],
    ).toBeUndefined();
  });

  it("re-syncs the local copy at the latest revision when a conflict is overwritten", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const project = useProjectsStore.getState().projects[0];
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const payload = init?.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify({
            project: { project: payload.project, revision: 6 },
          }),
          { status: 200, headers: jsonHeaders },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    useProjectsStore.setState({
      conflictByProject: {
        [project.id]: {
          projectId: project.id,
          cloudProject: project,
          cloudRevision: 5,
          updatedByName: null,
          kind: "update",
        },
      },
      lastCloudRevisionByProject: { [project.id]: 5 },
    });

    useProjectsStore.getState().resolveConflictOverwrite(project.id);
    await flushAsync();

    expect(
      useProjectsStore.getState().conflictByProject[project.id],
    ).toBeUndefined();
    const putCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit)?.method === "PUT",
    );
    expect(putCall).toBeTruthy();
    const body = JSON.parse(String((putCall![1] as RequestInit).body));
    expect(body.expectedRevision).toBe(5);
    expect(
      useProjectsStore.getState().lastCloudRevisionByProject[project.id],
    ).toBe(6);
  });

  it("reverts an optimistic delete and prompts when the cloud rejects with 409", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const project = useProjectsStore.getState().projects[0];
    const cloudProject = {
      ...structuredClone(project),
      name: "Teammate changed it",
    };
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "DELETE") {
          return new Response(JSON.stringify({ error: "conflict" }), {
            status: 409,
            headers: jsonHeaders,
          });
        }
        // The post-409 refetch returns the latest cloud copy.
        return new Response(
          JSON.stringify({
            project: {
              project: cloudProject,
              revision: 8,
              updatedByName: "Teammate",
            },
          }),
          { status: 200, headers: jsonHeaders },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    useProjectsStore.setState({
      lastCloudRevisionByProject: { [project.id]: 2 },
    });

    expect(useProjectsStore.getState().remove(project.id).ok).toBe(true);
    await flushAsync();

    // Optimistic delete reverted: the project is back, showing the cloud copy.
    const restored = useProjectsStore
      .getState()
      .projects.find((p) => p.id === project.id);
    expect(restored).toBeTruthy();
    expect(restored?.name).toBe("Teammate changed it");

    // A delete-kind conflict is surfaced with the latest revision/attribution.
    const conflict = useProjectsStore.getState().conflictByProject[project.id];
    expect(conflict?.kind).toBe("delete");
    expect(conflict?.cloudRevision).toBe(8);
    expect(conflict?.updatedByName).toBe("Teammate");
    expect(
      useProjectsStore.getState().lastCloudRevisionByProject[project.id],
    ).toBe(8);
    // The generic persistence error is suppressed for conflicts.
    expect(useProjectsStore.getState().persistenceError).toBeNull();
  });

  it("re-attempts the delete at the latest revision when a delete conflict is overwritten", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const project = useProjectsStore.getState().projects[0];
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: jsonHeaders,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    useProjectsStore.setState({
      conflictByProject: {
        [project.id]: {
          projectId: project.id,
          cloudProject: project,
          cloudRevision: 8,
          updatedByName: "Teammate",
          kind: "delete",
        },
      },
      lastCloudRevisionByProject: { [project.id]: 8 },
    });

    useProjectsStore.getState().resolveConflictOverwrite(project.id);
    await flushAsync();

    // The project is dropped locally again and a DELETE is retried at revision 8.
    expect(
      useProjectsStore.getState().projects.find((p) => p.id === project.id),
    ).toBeUndefined();
    const deleteCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit)?.method === "DELETE",
    );
    expect(deleteCall).toBeTruthy();
    const body = JSON.parse(String((deleteCall![1] as RequestInit).body));
    expect(body.expectedRevision).toBe(8);
    expect(
      useProjectsStore.getState().conflictByProject[project.id],
    ).toBeUndefined();
  });

  it("records a deleted conflict when the cloud PUT 404s (deleted elsewhere)", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const project = useProjectsStore.getState().projects[0];
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        if ((init?.method ?? "GET") === "PUT") {
          return new Response(JSON.stringify({ error: "Project was deleted." }), {
            status: 404,
            headers: jsonHeaders,
          });
        }
        return new Response("{}", { status: 200, headers: jsonHeaders });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    useProjectsStore.setState({
      lastCloudRevisionByProject: { [project.id]: 1 },
    });

    useProjectsStore.getState().update(project.id, { name: "My local name" });
    await flushAsync();

    const conflict = useProjectsStore.getState().conflictByProject[project.id];
    expect(conflict?.kind).toBe("deleted");
    // The local copy is retained until the user decides.
    expect(
      useProjectsStore.getState().projects.some((p) => p.id === project.id),
    ).toBe(true);
    // The conflict banner owns this, so no generic persistence error is shown.
    expect(useProjectsStore.getState().persistenceError).toBeNull();
  });

  it("discards the local copy when a deleted conflict is reloaded", () => {
    const project = useProjectsStore.getState().projects[0];
    useProjectsStore.setState({
      conflictByProject: {
        [project.id]: {
          projectId: project.id,
          cloudProject: project,
          cloudRevision: 3,
          updatedByName: null,
          kind: "deleted",
        },
      },
      lastCloudRevisionByProject: { [project.id]: 3 },
    });

    useProjectsStore.getState().resolveConflictReload(project.id);

    expect(
      useProjectsStore.getState().projects.some((p) => p.id === project.id),
    ).toBe(false);
    expect(
      useProjectsStore.getState().conflictByProject[project.id],
    ).toBeUndefined();
    expect(
      useProjectsStore.getState().lastCloudRevisionByProject[project.id],
    ).toBeUndefined();
  });

  it("restores with restore:true when a deleted conflict is overwritten", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    const project = useProjectsStore.getState().projects[0];
    const fetchMock = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const payload = init?.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify({ project: { project: payload.project, revision: 7 } }),
          { status: 200, headers: jsonHeaders },
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    useProjectsStore.setState({
      conflictByProject: {
        [project.id]: {
          projectId: project.id,
          cloudProject: project,
          cloudRevision: 3,
          updatedByName: null,
          kind: "deleted",
        },
      },
      lastCloudRevisionByProject: { [project.id]: 3 },
    });

    useProjectsStore.getState().resolveConflictOverwrite(project.id);
    await flushAsync();

    expect(
      useProjectsStore.getState().conflictByProject[project.id],
    ).toBeUndefined();
    const putCall = fetchMock.mock.calls.find(
      (call) => (call[1] as RequestInit)?.method === "PUT",
    );
    expect(putCall).toBeTruthy();
    const body = JSON.parse(String((putCall![1] as RequestInit).body));
    expect(body.restore).toBe(true);
    expect(
      useProjectsStore.getState().lastCloudRevisionByProject[project.id],
    ).toBe(7);
  });

  it("retries a transient sync failure and eventually succeeds", async () => {
    vi.stubEnv("NEXT_PUBLIC_CLOUD_PERSISTENCE_ENABLED", "true");
    vi.useFakeTimers();
    try {
      const project = useProjectsStore.getState().projects[0];
      let putAttempts = 0;
      const fetchMock = vi.fn(
        async (_url: string | URL | Request, init?: RequestInit) => {
          if ((init?.method ?? "GET") === "PUT") {
            putAttempts += 1;
            if (putAttempts === 1) {
              return new Response(JSON.stringify({ error: "boom" }), {
                status: 500,
                headers: jsonHeaders,
              });
            }
            const payload = init?.body ? JSON.parse(String(init.body)) : {};
            return new Response(
              JSON.stringify({
                project: { project: payload.project, revision: 4 },
              }),
              { status: 200, headers: jsonHeaders },
            );
          }
          return new Response("{}", { status: 200, headers: jsonHeaders });
        },
      );
      vi.stubGlobal("fetch", fetchMock);
      useProjectsStore.setState({
        lastCloudRevisionByProject: { [project.id]: 1 },
      });

      useProjectsStore.getState().update(project.id, { name: "Retry me" });
      await vi.runAllTimersAsync();

      expect(putAttempts).toBeGreaterThanOrEqual(2);
      expect(
        useProjectsStore.getState().lastCloudRevisionByProject[project.id],
      ).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });
});
