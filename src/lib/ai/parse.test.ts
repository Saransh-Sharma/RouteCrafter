import { describe, expect, it } from "vitest";
import { isLikelyTruncatedJson } from "./parse";

describe("AI JSON parsing helpers", () => {
  it("detects JSON cut off mid-field", () => {
    expect(
      isLikelyTruncatedJson(
        '{"days":[{"day":7,"evening":"Transfer to the airport if time',
      ),
    ).toBe(true);
  });

  it("does not flag complete objects", () => {
    expect(isLikelyTruncatedJson('{"days":[]}')).toBe(false);
  });
});
