import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildContext, buildItinerary } from "@/lib/generation";
import { seedProjects } from "@/lib/seed-projects";
import type { AiResult, AiTextRequest } from "./types";

vi.mock("./client", () => ({ requestAiText: vi.fn() }));
import { requestAiText } from "./client";
import { requestDayDetails } from "./day-details-client";

const mockRequestAiText = vi.mocked(requestAiText);

const project = structuredClone(seedProjects[0]);
const itinerary = buildItinerary(buildContext(project), { duration: "3 days" });
const day = itinerary.days[0];

const baseRequest: AiTextRequest = {
  provider: "openai",
  apiKey: "sk-test",
  model: "gpt-5.4",
  prompt: "",
  taskType: "dayDetails",
  maxOutputTokens: 4000,
};

function result(overrides: Partial<AiResult>): AiResult {
  return {
    provider: "openai",
    model: "gpt-5.4",
    credentialSource: "server",
    ...overrides,
  };
}

describe("requestDayDetails (two-pass orchestrator)", () => {
  beforeEach(() => {
    mockRequestAiText.mockReset();
  });

  it("runs a grounded research pass then a plain JSON pass", async () => {
    mockRequestAiText
      .mockResolvedValueOnce(
        result({
          text: "Research prose about Fuglen Tokyo.",
          citations: [{ url: "https://x.test/fuglen", title: "Fuglen" }],
          grounded: true,
          aiRunId: "research-1",
        }),
      )
      .mockResolvedValueOnce(
        result({ text: '{"restaurants":[]}', aiRunId: "format-1" }),
      );

    const out = await requestDayDetails({
      request: baseRequest,
      signal: new AbortController().signal,
      project,
      itinerary,
      day,
    });

    expect(mockRequestAiText).toHaveBeenCalledTimes(2);

    const [researchReq] = mockRequestAiText.mock.calls[0];
    expect(researchReq.enableWebSearch).toBe(true);
    expect(researchReq.responseFormat).toBeUndefined();
    expect(researchReq.taskType).toBe("dayDetails");

    const [formatReq] = mockRequestAiText.mock.calls[1];
    expect(formatReq.enableWebSearch).toBe(false);
    expect(formatReq.responseFormat).toBe("json");
    // Citations from pass 1 are injected into the format prompt.
    expect(formatReq.prompt).toContain("Sources found during research");
    expect(formatReq.prompt).toContain("https://x.test/fuglen");

    // Result carries pass-2 JSON, propagated grounding/citations, both run ids.
    expect(out.text).toBe('{"restaurants":[]}');
    expect(out.grounded).toBe(true);
    expect(out.citations).toEqual([
      { url: "https://x.test/fuglen", title: "Fuglen" },
    ]);
    expect(out.aiRunIds).toEqual(["research-1", "format-1"]);
  });

  it("omits the sources block and propagates ungrounded when no citations", async () => {
    mockRequestAiText
      .mockResolvedValueOnce(
        result({ text: "No sources found.", grounded: false }),
      )
      .mockResolvedValueOnce(result({ text: "{}" }));

    const out = await requestDayDetails({
      request: baseRequest,
      signal: new AbortController().signal,
      project,
      itinerary,
      day,
    });

    const [formatReq] = mockRequestAiText.mock.calls[1];
    expect(formatReq.prompt).not.toContain("Sources found during research");
    expect(out.grounded).toBe(false);
  });
});
