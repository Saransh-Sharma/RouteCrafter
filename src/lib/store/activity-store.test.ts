import { beforeEach, describe, expect, it, vi } from "vitest";
import { logActivity, useActivityStore } from "./activity-store";

describe("activity store", () => {
  beforeEach(() => {
    localStorage.clear();
    useActivityStore.setState({ entries: [] });
  });

  it("keeps logActivity local-only to avoid duplicate durable activity rows", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    logActivity(
      "project-1",
      "updated",
      "updated project details",
      { id: "user_test", displayName: "Test User" },
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(useActivityStore.getState().entries[0]).toMatchObject({
      projectId: "project-1",
      action: "updated",
      detail: "updated project details",
    });
  });
});
