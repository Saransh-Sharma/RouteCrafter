import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markAiRunApplied } from "./capture";

describe("asset and AI run capture helpers", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks each unique AI run as applied", async () => {
    await markAiRunApplied({
      aiRunId: "run-a",
      aiRunIds: ["run-a", "run-b"],
      projectId: "project-1",
      assetId: "asset-1",
    });

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "/api/ai/runs/run-a/apply",
      "/api/ai/runs/run-b/apply",
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      credentials: "include",
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      projectId: "project-1",
      assetId: "asset-1",
    });
  });
});
