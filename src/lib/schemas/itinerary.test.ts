import { describe, expect, it } from "vitest";
import { dayDetailsSchema, dayPlanSchema } from "./itinerary";

describe("dayDetailsSchema", () => {
  it("defaults every section to an empty array", () => {
    const details = dayDetailsSchema.parse({});
    expect(details).toMatchObject({
      base: "",
      restaurants: [],
      stays: [],
      activities: [],
      shopping: [],
      trivia: [],
      generatedAt: "",
    });
  });

  it("fills recommendation defaults for partial items", () => {
    const details = dayDetailsSchema.parse({
      restaurants: [{ name: "Ippudo" }],
      trivia: [{ text: "Ramen capital" }],
    });
    expect(details.restaurants[0]).toMatchObject({
      name: "Ippudo",
      area: "",
      category: "",
      whyItFits: "",
      priceBand: "",
      source: "",
      caveat: "",
    });
    expect(details.trivia[0]).toEqual({ text: "Ramen capital", source: "" });
  });
});

describe("dayPlanSchema details field", () => {
  it("parses a day with no details (back-compat)", () => {
    const day = dayPlanSchema.parse({ day: 1, title: "Arrival" });
    expect(day.details).toBeUndefined();
  });

  it("parses a day carrying a details page", () => {
    const day = dayPlanSchema.parse({
      day: 2,
      title: "Explore",
      details: { restaurants: [{ name: "Den" }] },
    });
    expect(day.details?.restaurants[0]?.name).toBe("Den");
  });
});
