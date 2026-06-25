import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildContext, buildItinerary } from "@/lib/generation";
import { itineraryOutputSchema } from "@/lib/schemas";
import { seedProjects } from "@/lib/seed-projects";
import { requestAiText } from "./client";
import { requestStructuredItineraryDraft } from "./itinerary-draft-client";

vi.mock("./client", () => ({
  requestAiText: vi.fn(),
}));

describe("structured itinerary draft orchestration", () => {
  beforeEach(() => {
    vi.mocked(requestAiText).mockReset();
  });

  it("builds a complete itinerary from overview and day chunks", async () => {
    const project = structuredClone(seedProjects[0]);
    const current = buildItinerary(buildContext(project), {
      duration: "7 days",
      travelerType: "Couple",
      style: "Classic first-timer",
      budget: "Mid-range",
    });
    const mockRequestAiText = vi.mocked(requestAiText);
    mockRequestAiText
      .mockResolvedValueOnce({
        provider: "openai",
        model: "gpt-5.4",
        credentialSource: "server",
        aiRunId: "run-overview",
        text: JSON.stringify({
          title: "Polished Japan itinerary",
          overview: "A compact premium route.",
          routeSummary: "Tokyo -> Hakone -> Kyoto -> Osaka",
          style: "Classic first-timer, Premium comfort",
          budget: "Mid-range",
        }),
      })
      .mockResolvedValueOnce({
        provider: "openai",
        model: "gpt-5.4",
        credentialSource: "server",
        aiRunId: "run-days-1-4",
        text: JSON.stringify({
          days: current.days.slice(0, 4).map((day) => ({
            ...day,
            morning: `Day ${day.day} morning plan`,
          })),
        }),
      })
      .mockResolvedValueOnce({
        provider: "openai",
        model: "gpt-5.4",
        credentialSource: "server",
        aiRunId: "run-days-5-7",
        text: JSON.stringify({
          days: current.days.slice(4).map((day) => ({
            ...day,
            evening: `Day ${day.day} evening plan`,
          })),
        }),
      });

    const result = await requestStructuredItineraryDraft({
      request: {
        provider: "openai",
        model: "gpt-5.4",
        prompt: "ignored by orchestrator",
        taskType: "itinerary",
        maxOutputTokens: 4000,
        responseFormat: "json",
      },
      signal: new AbortController().signal,
      project,
      current,
      focus: "Build a complete itinerary.",
    });

    const itinerary = itineraryOutputSchema.parse(JSON.parse(result.text ?? ""));
    expect(mockRequestAiText).toHaveBeenCalledTimes(3);
    expect(itinerary.id).toBe(current.id);
    expect(itinerary.travelerType).toBe("Couple");
    expect(itinerary.style).toBe("Classic first-timer");
    expect(itinerary.days).toHaveLength(7);
    expect(itinerary.days[0].morning).toBe("Day 1 morning plan");
    expect(itinerary.days[6].evening).toBe("Day 7 evening plan");
    expect(result.aiRunId).toBe("run-overview");
    expect(result.aiRunIds).toEqual([
      "run-overview",
      "run-days-1-4",
      "run-days-5-7",
    ]);
  });

  it("splits a truncated day chunk and still returns every day", async () => {
    const project = structuredClone(seedProjects[0]);
    const current = buildItinerary(buildContext(project), {
      duration: "7 days",
      travelerType: "Couple",
      style: "Classic first-timer",
      budget: "Mid-range",
    });
    const mockRequestAiText = vi.mocked(requestAiText);
    const okOverview = {
      provider: "openai" as const,
      model: "gpt-5.4",
      credentialSource: "server" as const,
      text: JSON.stringify({ title: "Itinerary", overview: "Route." }),
    };
    const daysResponse = (slice: typeof current.days) => ({
      provider: "openai" as const,
      model: "gpt-5.4",
      credentialSource: "server" as const,
      text: JSON.stringify({ days: slice.map((day) => ({ ...day })) }),
    });
    mockRequestAiText
      .mockResolvedValueOnce(okOverview)
      // days 1-4 comes back truncated (does not end in } or ])
      .mockResolvedValueOnce({
        provider: "openai",
        model: "gpt-5.4",
        credentialSource: "server",
        text: '{"days":[{"day":1,"morning":"cut off',
      })
      // recursive split: days 1-2 then days 3-4
      .mockResolvedValueOnce(daysResponse(current.days.slice(0, 2)))
      .mockResolvedValueOnce(daysResponse(current.days.slice(2, 4)))
      // final chunk days 5-7
      .mockResolvedValueOnce(daysResponse(current.days.slice(4)));

    const result = await requestStructuredItineraryDraft({
      request: {
        provider: "openai",
        model: "gpt-5.4",
        prompt: "ignored",
        taskType: "itinerary",
        maxOutputTokens: 4000,
        responseFormat: "json",
      },
      signal: new AbortController().signal,
      project,
      current,
    });

    const itinerary = itineraryOutputSchema.parse(JSON.parse(result.text ?? ""));
    expect(mockRequestAiText).toHaveBeenCalledTimes(5);
    expect(itinerary.days).toHaveLength(7);
    expect(itinerary.days.map((day) => day.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("threads overrides + instructions into prompts and the result, and reports progress", async () => {
    const project = structuredClone(seedProjects[0]);
    const current = buildItinerary(buildContext(project), {
      duration: "7 days",
      travelerType: "Couple",
      style: "Classic first-timer",
      budget: "Mid-range",
    });
    const mockRequestAiText = vi.mocked(requestAiText);
    const ok = (text: string) => ({
      provider: "openai" as const,
      model: "gpt-5.4",
      credentialSource: "server" as const,
      text,
    });
    mockRequestAiText
      .mockResolvedValueOnce(ok(JSON.stringify({ title: "Itinerary" })))
      .mockResolvedValueOnce(
        ok(JSON.stringify({ days: current.days.slice(0, 4) })),
      )
      .mockResolvedValueOnce(ok(JSON.stringify({ days: current.days.slice(4) })));

    const progress: { id: string; status: string }[] = [];
    const result = await requestStructuredItineraryDraft({
      request: {
        provider: "openai",
        model: "gpt-5.4",
        prompt: "ignored",
        taskType: "itinerary",
        maxOutputTokens: 4000,
        responseFormat: "json",
      },
      signal: new AbortController().signal,
      project,
      current,
      overrides: { style: "Romantic", budget: "Luxury", pace: "Relaxed" },
      instructions: "Emphasize hidden-gem dinners",
      onProgress: (event) =>
        progress.push({ id: event.id, status: event.status }),
    });

    // Overrides + instructions reach the overview prompt.
    const overviewPrompt = mockRequestAiText.mock.calls[0][0].prompt;
    expect(overviewPrompt).toContain("Romantic");
    expect(overviewPrompt).toContain("Emphasize hidden-gem dinners");

    // Chosen levers stay authoritative on the applied itinerary.
    const itinerary = itineraryOutputSchema.parse(JSON.parse(result.text ?? ""));
    expect(itinerary.style).toBe("Romantic");
    expect(itinerary.budget).toBe("Luxury");
    expect(itinerary.days.every((day) => day.pace === "Relaxed")).toBe(true);

    // Progress fires start + done for the overview and each day chunk.
    expect(progress).toContainEqual({ id: "overview", status: "start" });
    expect(progress).toContainEqual({ id: "overview", status: "done" });
    expect(progress.filter((step) => step.status === "done")).toHaveLength(3);
  });
});
