import { describe, expect, it } from "vitest";
import { NATURAL_LANGUAGE_RULES } from "./language";

describe("NATURAL_LANGUAGE_RULES", () => {
  it("leads with positive planner guidance", () => {
    expect(NATURAL_LANGUAGE_RULES).toContain("NATURAL LANGUAGE RULES");
    expect(NATURAL_LANGUAGE_RULES).toContain("working travel planner");
  });

  it("names overused AI filler words to rewrite", () => {
    expect(NATURAL_LANGUAGE_RULES).toContain("gentle");
    expect(NATURAL_LANGUAGE_RULES).toContain("hidden gem");
  });

  it("includes a weak/strong example pair", () => {
    expect(NATURAL_LANGUAGE_RULES).toContain("Enjoy a gentle morning");
    expect(NATURAL_LANGUAGE_RULES).toContain("Start at the market");
  });
});
