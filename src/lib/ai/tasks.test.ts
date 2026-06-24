import { describe, expect, it } from "vitest";
import { seedProjects } from "@/lib/seed-projects";
import { buildContext } from "@/lib/generation/context";
import { buildItinerary } from "@/lib/generation/itinerary";
import {
  buildBriefExtractionPrompt,
  buildGuidePrompt,
  buildImageGenerationPrompt,
  buildItineraryDaysPrompt,
  buildItineraryOverviewPrompt,
  buildItineraryPrompt,
  buildListingPrompt,
  buildMatrixPrompt,
  buildPromptRunPrompt,
} from "./tasks";

const NL = "NATURAL LANGUAGE RULES";
const project = seedProjects[0];
const itinerary = buildItinerary(buildContext(project));

describe("natural-language guardrails in prose prompts", () => {
  it("are present in the prose- and copy-producing builders", () => {
    expect(buildPromptRunPrompt(project, "Write the overview")).toContain(NL);
    expect(buildMatrixPrompt(project)).toContain(NL);
    expect(buildItineraryPrompt(project)).toContain(NL);
    expect(buildListingPrompt(project)).toContain(NL);
    expect(buildItineraryOverviewPrompt(project, itinerary)).toContain(NL);
    expect(
      buildItineraryDaysPrompt({
        project,
        itinerary,
        days: itinerary.days.slice(0, 1),
      }),
    ).toContain(NL);
    expect(buildGuidePrompt(project, itinerary, "Improve food guide")).toContain(
      NL,
    );
  });

  it("are absent from extraction and image-generation prompts", () => {
    expect(buildBriefExtractionPrompt(project, "A trip brief")).not.toContain(
      NL,
    );
    expect(
      buildImageGenerationPrompt(project, "source", "hero"),
    ).not.toContain(NL);
  });

  it("keeps structured JSON rules after the prose guidance", () => {
    const prompt = buildItineraryPrompt(project);
    expect(prompt).toContain("Return only valid JSON");
    expect(prompt.indexOf(NL)).toBeLessThan(prompt.indexOf("Return only valid JSON"));
  });
});
