import { describe, expect, it } from "vitest";
import {
  estimateAiRunCost,
  formatCostEstimate,
  formatUsd,
} from "./pricing";

describe("AI cost estimates", () => {
  it("estimates a GPT-5.4 text range from prompt and output limits", () => {
    const estimate = estimateAiRunCost({
      mode: "text",
      provider: "openai",
      model: "gpt-5.4",
      prompt: "a".repeat(300),
      taskType: "prompt",
      maxOutputTokens: 4000,
    });

    expect(estimate).toMatchObject({
      currency: "USD",
      inputTokensLow: 75,
      inputTokensHigh: 100,
      outputTokensLow: 500,
      outputTokensHigh: 4000,
    });
    expect(estimate?.lowUsd).toBeCloseTo(0.0076875);
    expect(estimate?.highUsd).toBeCloseTo(0.06025);
    expect(formatCostEstimate(estimate)).toBe("$0.008-$0.060");
  });

  it("uses published GPT Image 2 output pricing for medium 1024 images", () => {
    const estimate = estimateAiRunCost({
      mode: "image",
      provider: "openai",
      model: "gpt-image-2",
      prompt: "a".repeat(300),
      taskType: "imageGeneration",
      size: "1024x1024",
      quality: "medium",
    });

    expect(estimate?.lowUsd).toBeCloseTo(0.053375);
    expect(estimate?.highUsd).toBeCloseTo(0.0535);
    expect(estimate?.basis).toContain("medium 1024x1024 image");
  });

  it("supports built-in Anthropic and Gemini pricing", () => {
    const anthropic = estimateAiRunCost({
      mode: "text",
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      prompt: "Draft a listing",
      taskType: "listing",
      maxOutputTokens: 2000,
    });
    const gemini = estimateAiRunCost({
      mode: "image",
      provider: "gemini",
      model: "gemini-3.1-flash-image",
      prompt: "Create a cover image",
      taskType: "imageGeneration",
      size: "1024x1024",
      quality: "medium",
    });

    expect(anthropic).not.toBeNull();
    expect(gemini?.lowUsd).toBeGreaterThanOrEqual(0.067);
  });

  it("does not invent estimates for custom or unknown models", () => {
    expect(
      estimateAiRunCost({
        mode: "text",
        provider: "openai",
        model: "gpt-private-custom",
        prompt: "Hello",
        taskType: "prompt",
        maxOutputTokens: 1000,
      }),
    ).toBeNull();
    expect(formatCostEstimate(null)).toBe("Estimate unavailable");
  });

  it("formats small USD amounts without rounding them to zero", () => {
    expect(formatUsd(0.0004)).toBe("$0.0004");
    expect(formatUsd(0.053)).toBe("$0.053");
  });
});
