import { describe, expect, it } from "vitest";
import { seedProjects } from "../seed-projects";
import { createEmptyTripConfig } from "../schemas";
import { buildContext, configBlock, durationLabel } from "./context";
import {
  buildItinerary,
  durationOverrideFromLabel,
  realignItineraryDurationText,
} from "./itinerary";

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

describe("edition extra cities", () => {
  it("merges extra cities onto base cities and de-dupes", () => {
    const ctx = buildContext(projectWithConfig(), {
      extraCities: ["Osaka", "Tokyo"],
    });

    expect(ctx.config.cities).toEqual(["Tokyo", "Kyoto", "Osaka"]);
    expect(configBlock(ctx)).toContain("Tokyo, Kyoto, Osaka");
  });

  it("seeds the itinerary route summary with merged cities", () => {
    const itinerary = buildItinerary(
      buildContext(projectWithConfig(), { extraCities: ["Osaka"] }),
      { duration: "3 days" },
    );

    expect(itinerary.routeSummary).toContain("Osaka");
    expect(itinerary.overview).toContain("Osaka");
  });

  it("leaves base cities unchanged when no extras are given", () => {
    const ctx = buildContext(projectWithConfig());
    expect(ctx.config.cities).toEqual(["Tokyo", "Kyoto"]);
  });
});

describe("buildContext duration overrides", () => {
  it("overrides the base brief duration and traveler type", () => {
    const ctx = buildContext(projectWithConfig(), {
      duration: "14 days",
      travelerType: "Family",
    });

    expect(durationLabel(ctx)).toBe("14 days");
    expect(ctx.config.travelerType).toBe("Family");
    expect(configBlock(ctx)).toContain("Duration: 14 days");
    expect(configBlock(ctx)).toContain("Traveler type: Family");
  });

  it("honors a custom-day override label", () => {
    const ctx = buildContext(projectWithConfig(), { customDays: 12 });
    expect(durationLabel(ctx)).toBe("12 days");
  });

  it("falls back to the base brief when no override is given", () => {
    // projectWithConfig's base config is "7 days" with customDays 9 -> "9 days".
    const ctx = buildContext(projectWithConfig());
    expect(durationLabel(ctx)).toBe("9 days");
  });
});

describe("durationOverrideFromLabel", () => {
  it("passes enum labels through as duration", () => {
    expect(durationOverrideFromLabel("14 days")).toEqual({ duration: "14 days" });
  });

  it("treats non-enum labels as custom day counts", () => {
    expect(durationOverrideFromLabel("12 days")).toEqual({ customDays: 12 });
  });
});

describe("realignItineraryDurationText", () => {
  const stale = {
    ...buildItinerary(buildContext(projectWithConfig()), { duration: "7 days" }),
    duration: "14 days",
    title: "7 days Vietnam itinerary",
    subtitle: "Couple - Romantic - Mid-range",
    overview: "An energetic 7 days Vietnam route for couples.",
    whoFor: "Couples who want a 7 days escape.",
  };

  it("replaces the stale label inferred from the title", () => {
    const fixed = realignItineraryDurationText(stale);
    expect(fixed.title).toBe("14 days Vietnam itinerary");
    expect(fixed.overview).toBe("An energetic 14 days Vietnam route for couples.");
    expect(fixed.whoFor).toContain("14 days");
  });

  it("uses an explicit stale label when supplied (clone path)", () => {
    const fixed = realignItineraryDurationText(
      { ...stale, title: "Romantic Vietnam Escape" },
      "7 days",
    );
    expect(fixed.overview).toContain("14 days");
    expect(fixed.title).toBe("Romantic Vietnam Escape");
  });

  it("is a no-op when the label already matches", () => {
    const itinerary = { ...stale, title: "14 days Vietnam itinerary" };
    expect(realignItineraryDurationText(itinerary)).toBe(itinerary);
  });

  it("respects word boundaries so it does not corrupt larger numbers", () => {
    const fixed = realignItineraryDurationText({
      ...stale,
      title: "7 days Vietnam itinerary",
      overview: "Core 7 days plus a 17 days extension.",
      whoFor: "",
    });
    expect(fixed.overview).toBe("Core 14 days plus a 17 days extension.");
  });
});
