import { describe, expect, it } from "vitest";
import { seedProjects } from "../seed-projects";
import { createEmptyTripConfig } from "../schemas";
import { buildContext } from "./context";
import { buildItinerary } from "./itinerary";

function projectWithConfig() {
  return {
    ...structuredClone(seedProjects[0]),
    tripConfigs: [
      createEmptyTripConfig({
        duration: "7 days",
        customDays: 9,
        cities: ["Tokyo", "Kyoto"],
        travelStyles: ["Food/culture heavy"],
      }),
    ],
  };
}

describe("itinerary duration resolution", () => {
  it.each(["3 days", "7 days", "14 days"] as const)(
    "keeps %s metadata and day count aligned",
    (duration) => {
      const itinerary = buildItinerary(buildContext(projectWithConfig()), {
        duration,
      });
      const count = Number.parseInt(duration, 10);

      expect(itinerary.duration).toBe(duration);
      expect(itinerary.title).toContain(duration);
      expect(itinerary.overview).toContain(duration);
      expect(itinerary.days).toHaveLength(count);
    },
  );

  it("uses custom days for the primary configuration", () => {
    const itinerary = buildItinerary(buildContext(projectWithConfig()));

    expect(itinerary.duration).toBe("9 days");
    expect(itinerary.title).toContain("9 days");
    expect(itinerary.overview).toContain("9 days");
    expect(itinerary.days).toHaveLength(9);
  });

  it("uses the selected style in audience copy", () => {
    const itinerary = buildItinerary(buildContext(projectWithConfig()), {
      duration: "3 days",
      style: "Romantic",
    });

    expect(itinerary.whoFor).toContain("romantic");
  });
});
