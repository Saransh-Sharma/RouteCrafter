import { describe, expect, it } from "vitest";
import { portfolioImagePromptSchema, projectSchema } from "./index";

describe("AI integration schemas", () => {
  it("defaults accepted generated images on portfolio prompts", () => {
    const prompt = portfolioImagePromptSchema.parse({
      id: "prompt",
      kind: "hero",
      title: "Hero",
      goal: "Goal",
      canvas: "Square",
      layout: "Layout",
      visualElements: "Elements",
      textOverlay: "Text",
      style: "Style",
      negativePrompt: "No clutter",
      countryAccuracyNotes: "Accurate",
      readabilityNotes: "Readable",
    });

    expect(prompt.image).toBe("");
  });

  it("defaults project AI run metadata to an empty list", () => {
    const project = projectSchema.parse({
      id: "project",
      name: "Japan Studio",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(project.aiRuns).toEqual([]);
  });
});
