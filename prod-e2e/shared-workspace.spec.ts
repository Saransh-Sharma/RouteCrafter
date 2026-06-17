import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
} from "@playwright/test";
import {
  CURRENT_SCHEMA_VERSION,
  projectSchema,
  type Project,
} from "../src/lib/schemas";

/**
 * Verifies the shared global workspace against the live deployment:
 * - a project created by user A is visible to user B,
 * - user B can edit it,
 * - a stale write (last-write-wins guard) returns 409,
 * - after re-reading the latest revision, the write succeeds (explicit overwrite),
 * - a stale delete also returns 409 and succeeds after re-reading the revision,
 * - the lightweight /api/projects/revisions endpoint backs cheap polling.
 *
 * Opt-in only (real cloud + billed account). Requires ROUTECRAFTER_PROD_AUDIT=1
 * and credentials for two distinct users.
 */

const baseURL =
  process.env.ROUTECRAFTER_PROD_BASE_URL ?? "https://route-crafter.vercel.app";

const userA = {
  username: process.env.ROUTECRAFTER_PROD_USERNAME ?? "saransh",
  password: process.env.ROUTECRAFTER_PROD_PASSWORD,
};
const userB = {
  username: process.env.ROUTECRAFTER_SECOND_USERNAME ?? "saumya",
  password: process.env.ROUTECRAFTER_SECOND_PASSWORD,
};

type CloudProject = {
  project: Project;
  revision: number;
  updatedByName?: string | null;
};

test.describe.serial("shared global workspace", () => {
  test.beforeAll(() => {
    if (process.env.ROUTECRAFTER_PROD_AUDIT !== "1") {
      throw new Error(
        "Shared workspace audit is opt-in only. Set ROUTECRAFTER_PROD_AUDIT=1 to run this suite.",
      );
    }
    if (!userA.password || !userB.password) {
      throw new Error(
        "Both ROUTECRAFTER_PROD_PASSWORD and ROUTECRAFTER_SECOND_PASSWORD are required for the two-user shared workspace test.",
      );
    }
    if (userA.username === userB.username) {
      throw new Error(
        "ROUTECRAFTER_PROD_USERNAME and ROUTECRAFTER_SECOND_USERNAME must be different users.",
      );
    }
  });

  test("shares projects across users and guards stale writes", async () => {
    const contextA = await playwrightRequest.newContext({ baseURL });
    const contextB = await playwrightRequest.newContext({ baseURL });
    const project = buildSharedProject();

    try {
      await login(contextA, userA);
      await login(contextB, userB);

      // User A creates the project.
      const createResponse = await contextA.post("/api/projects", {
        data: {
          project,
          activityDetail: "shared-workspace e2e: created by user A",
        },
      });
      expect(
        createResponse.ok(),
        await safeText(createResponse),
      ).toBeTruthy();
      const created = (await createResponse.json()).project as CloudProject;

      // User B sees user A's project in the shared list.
      const listForB = await contextB.get("/api/projects", {
        headers: { Accept: "application/json" },
      });
      expect(listForB.ok()).toBeTruthy();
      const listBody = (await listForB.json()) as { projects: CloudProject[] };
      const visibleToB = listBody.projects.find(
        (item) => item.project.id === project.id,
      );
      expect(
        visibleToB,
        "user B should see the project user A created",
      ).toBeTruthy();

      // User B edits user A's project with the current revision.
      const editByB = await contextB.put(`/api/projects/${project.id}`, {
        data: {
          project: { ...project, name: `${project.name} (edited by B)` },
          expectedRevision: created.revision,
          activityDetail: "shared-workspace e2e: edited by user B",
        },
      });
      expect(editByB.ok(), await safeText(editByB)).toBeTruthy();
      const afterB = (await editByB.json()).project as CloudProject;
      expect(afterB.revision).toBe(created.revision + 1);

      // User A now writes with a stale revision => last-write-wins guard rejects it.
      const staleByA = await contextA.put(`/api/projects/${project.id}`, {
        data: {
          project: { ...project, name: `${project.name} (stale by A)` },
          expectedRevision: created.revision,
          activityDetail: "shared-workspace e2e: stale write by user A",
        },
      });
      expect(staleByA.status()).toBe(409);

      // User A re-reads the latest revision and overwrites successfully.
      const reread = await contextA.get(`/api/projects/${project.id}`, {
        headers: { Accept: "application/json" },
      });
      expect(reread.ok()).toBeTruthy();
      const latest = (await reread.json()).project as CloudProject;
      const overwriteByA = await contextA.put(`/api/projects/${project.id}`, {
        data: {
          project: {
            ...latest.project,
            name: `${project.name} (overwritten by A)`,
          },
          expectedRevision: latest.revision,
          activityDetail: "shared-workspace e2e: overwrite by user A",
        },
      });
      expect(overwriteByA.ok(), await safeText(overwriteByA)).toBeTruthy();
    } finally {
      await cleanup(contextA, project.id);
      await contextA.dispose();
      await contextB.dispose();
    }
  });

  test("guards stale deletes and lists revisions cheaply", async () => {
    const contextA = await playwrightRequest.newContext({ baseURL });
    const contextB = await playwrightRequest.newContext({ baseURL });
    const project = buildSharedProject();

    try {
      await login(contextA, userA);
      await login(contextB, userB);

      // User A creates the project.
      const createResponse = await contextA.post("/api/projects", {
        data: {
          project,
          activityDetail: "shared-workspace e2e: created by user A (delete test)",
        },
      });
      expect(createResponse.ok(), await safeText(createResponse)).toBeTruthy();
      const created = (await createResponse.json()).project as CloudProject;

      // The lightweight revisions endpoint reports the project for cheap polling.
      const revisionsResponse = await contextB.get("/api/projects/revisions", {
        headers: { Accept: "application/json" },
      });
      expect(revisionsResponse.ok(), await safeText(revisionsResponse)).toBeTruthy();
      const revisionsBody = (await revisionsResponse.json()) as {
        revisions: { id: string; revision: number; updatedAt: string }[];
      };
      const summary = revisionsBody.revisions.find((r) => r.id === project.id);
      expect(summary, "revisions endpoint should list the new project").toBeTruthy();
      expect(summary?.revision).toBe(created.revision);

      // User B edits the project, advancing its revision.
      const editByB = await contextB.put(`/api/projects/${project.id}`, {
        data: {
          project: { ...project, name: `${project.name} (edited by B)` },
          expectedRevision: created.revision,
          activityDetail: "shared-workspace e2e: edited by user B (delete test)",
        },
      });
      expect(editByB.ok(), await safeText(editByB)).toBeTruthy();

      // User A attempts to delete with the now-stale revision => 409.
      const staleDeleteByA = await contextA.delete(`/api/projects/${project.id}`, {
        data: { expectedRevision: created.revision },
      });
      expect(staleDeleteByA.status()).toBe(409);

      // The project still exists after the rejected delete.
      const stillThere = await contextA.get(`/api/projects/${project.id}`, {
        headers: { Accept: "application/json" },
      });
      expect(stillThere.ok()).toBeTruthy();
      const latest = (await stillThere.json()).project as CloudProject;

      // After re-reading the latest revision, the delete succeeds (overwrite).
      const deleteByA = await contextA.delete(`/api/projects/${project.id}`, {
        data: { expectedRevision: latest.revision },
      });
      expect(deleteByA.ok(), await safeText(deleteByA)).toBeTruthy();

      // The project is gone for everyone.
      const goneForB = await contextB.get(`/api/projects/${project.id}`, {
        headers: { Accept: "application/json" },
      });
      expect(goneForB.status()).toBe(404);
    } finally {
      await cleanup(contextA, project.id);
      await contextA.dispose();
      await contextB.dispose();
    }
  });
});

function buildSharedProject(): Project {
  const now = new Date().toISOString();
  const id = `prod-e2e-shared-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return projectSchema.parse({
    id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: `Prod E2E Shared Workspace ${id}`,
    country: "Portugal",
    status: "Draft",
    accent: "sage",
    createdAt: now,
    updatedAt: now,
  });
}

async function login(
  request: APIRequestContext,
  user: { username: string; password?: string },
): Promise<void> {
  const response = await request.post("/api/auth/login", {
    data: { username: user.username, password: user.password },
  });
  if (response.status() === 429) {
    const seconds = Number(response.headers()["retry-after"]);
    await new Promise((resolve) =>
      setTimeout(resolve, Number.isFinite(seconds) ? seconds * 1000 : 60_000),
    );
    return login(request, user);
  }
  expect(response.status(), await safeText(response)).toBe(200);
}

async function cleanup(request: APIRequestContext, projectId: string) {
  try {
    const response = await request.get(`/api/projects/${projectId}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok()) return;
    const latest = (await response.json()).project as CloudProject;
    await request.delete(`/api/projects/${projectId}`, {
      data: { expectedRevision: latest.revision },
    });
  } catch {
    // Best-effort cleanup; stale fixtures can be removed from the dashboard.
  }
}

async function safeText(response: {
  text: () => Promise<string>;
}): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}
