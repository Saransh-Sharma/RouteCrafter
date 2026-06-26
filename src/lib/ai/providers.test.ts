import { describe, expect, it } from "vitest";
import { webSearchSupported } from "./providers";

describe("webSearchSupported", () => {
  it("is true only for OpenAI (the only wired web-search provider)", () => {
    expect(webSearchSupported("openai")).toBe(true);
    expect(webSearchSupported("anthropic")).toBe(false);
    expect(webSearchSupported("gemini")).toBe(false);
  });
});
