import { describe, expect, it, vi } from "vitest";
import { buildContext, buildItinerary } from "@/lib/generation";
import { itineraryOutputSchema } from "@/lib/schemas";
import { seedProjects } from "@/lib/seed-projects";
import { requestAiText } from "./client";
import { requestStructuredItineraryDraft } from "./itinerary-draft-client";

vi.mock("./client", () => ({
  requestAiText: vi.fn(),
}));

describe("structured itinerary draft orchestration", () => {
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
  });
});
