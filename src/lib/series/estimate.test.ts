import { describe, expect, it } from "vitest";
import { seedProjects } from "@/lib/seed-projects";
import { projectSchema, type Project } from "@/lib/schemas";
import { estimateSeriesCost } from "./estimate";

function sourceWithEditions(): Project {
  const base = structuredClone(seedProjects[0]);
  return projectSchema.parse({
    ...base,
    productionPlan: {
      ...base.productionPlan,
      editions: [
        {
          id: "e-7",
          duration: "7 days",
          travelerType: "Couple",
          cities: [],
          route: [],
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    },
  });
}

describe("estimateSeriesCost", () => {
  it("scales linearly with countries and counts the calls", () => {
    const source = sourceWithEditions();
    const one = estimateSeriesCost({
      source,
      countries: 1,
      provider: "openai",
      model: "gpt-5.4",
      withImages: false,
    });
    const three = estimateSeriesCost({
      source,
      countries: 3,
      provider: "openai",
      model: "gpt-5.4",
      withImages: false,
    });

    expect(one).not.toBeNull();
    expect(three).not.toBeNull();
    // 7 days -> 2 chunks; + overview + route + listing = 5 calls per country.
    expect(one!.textCalls).toBe(5);
    expect(three!.textCalls).toBe(15);
    expect(three!.total.highUsd).toBeCloseTo(one!.total.highUsd * 3, 6);
    expect(one!.imagesPerCountry).toBe(0);
  });

  it("adds itemized image cost only when opted in", () => {
    const source = sourceWithEditions();
    const textOnly = estimateSeriesCost({
      source,
      countries: 2,
      provider: "openai",
      model: "gpt-5.4",
      withImages: false,
    })!;
    const withImages = estimateSeriesCost({
      source,
      countries: 2,
      provider: "openai",
      model: "gpt-5.4",
      withImages: true,
      imageProvider: "openai",
      imageModel: "gpt-image-2",
      imageSize: "1024x1024",
      imageQuality: "medium",
    })!;

    expect(withImages.imagesPerCountry).toBe(6);
    expect(withImages.total.highUsd).toBeGreaterThan(textOnly.total.highUsd);
    // 6 medium 1024x1024 images ≈ $0.053 each per country.
    expect(
      withImages.perCountry.highUsd - textOnly.perCountry.highUsd,
    ).toBeGreaterThan(0.3);
  });

  it("returns null for unknown model pricing", () => {
    expect(
      estimateSeriesCost({
        source: sourceWithEditions(),
        countries: 1,
        provider: "openai",
        model: "unknown-model",
        withImages: false,
      }),
    ).toBeNull();
  });
});
