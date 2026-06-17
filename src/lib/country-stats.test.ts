import { describe, expect, it } from "vitest";
import type { Project } from "./types";
import { normalizeProject } from "./project-normalization";
import { countryNameToIso } from "./country-geo";
import {
  EMPTY_COUNTRY_FILL,
  countryFillColor,
  groupProjectsByCountry,
  sortByActivity,
  sortByCompletion,
} from "./country-stats";

function makeProject(
  country: string,
  status: Project["status"],
  overrides: Partial<{ id: string; name: string; updatedAt: string }> = {},
): Project {
  return normalizeProject({
    id: overrides.id ?? `${country}-${status}-${Math.random()}`,
    name: overrides.name ?? `${country} product`,
    country,
    status,
    updatedAt: overrides.updatedAt ?? "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
}

describe("groupProjectsByCountry", () => {
  it("groups projects and splits finished vs in-progress", () => {
    const projects = [
      makeProject("Japan", "Ready to sell"),
      makeProject("Japan", "Draft"),
      makeProject("Japan", "In progress"),
      makeProject("Italy", "In progress"),
    ];
    const groups = groupProjectsByCountry(projects);
    const japan = groups.find((g) => g.country === "Japan");
    const italy = groups.find((g) => g.country === "Italy");

    expect(groups).toHaveLength(2);
    expect(japan?.finished).toHaveLength(1);
    expect(japan?.inProgress).toHaveLength(2);
    expect(japan?.total).toBe(3);
    expect(japan?.greenRatio).toBeCloseTo(1 / 3);
    expect(japan?.iso).toBe("JP");
    expect(italy?.greenRatio).toBe(0);
  });

  it("matches countries case-insensitively and skips blanks", () => {
    const groups = groupProjectsByCountry([
      makeProject("japan", "Draft"),
      makeProject("Japan", "Ready to sell"),
      makeProject("   ", "Draft"),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].total).toBe(2);
  });
});

describe("sorting", () => {
  it("sortByActivity ranks most recently updated first", () => {
    const groups = groupProjectsByCountry([
      makeProject("Italy", "Draft", { updatedAt: "2026-02-01T00:00:00.000Z" }),
      makeProject("Japan", "Draft", { updatedAt: "2026-05-01T00:00:00.000Z" }),
    ]);
    expect(sortByActivity(groups).map((g) => g.country)).toEqual([
      "Japan",
      "Italy",
    ]);
  });

  it("sortByCompletion ranks most finished first", () => {
    const groups = groupProjectsByCountry([
      makeProject("Italy", "Draft"),
      makeProject("Japan", "Ready to sell"),
      makeProject("Japan", "Ready to sell"),
    ]);
    expect(sortByCompletion(groups)[0].country).toBe("Japan");
  });
});

describe("countryFillColor", () => {
  it("returns the subtle grey for empty countries", () => {
    expect(
      countryFillColor({ total: 0, greenRatio: 0, avgCompletion: 0 }),
    ).toBe(EMPTY_COUNTRY_FILL);
  });

  it("produces an oklch color for populated countries", () => {
    const allFinished = countryFillColor({
      total: 2,
      greenRatio: 1,
      avgCompletion: 100,
    });
    const allDraft = countryFillColor({
      total: 2,
      greenRatio: 0,
      avgCompletion: 10,
    });
    expect(allFinished).toMatch(/^oklch\(/);
    expect(allDraft).toMatch(/^oklch\(/);
    expect(allFinished).not.toBe(allDraft);
  });

  it("deepens (lower lightness) as completion rises for finished work", () => {
    const lightness = (fill: string) =>
      Number(fill.match(/oklch\(([\d.]+)/)?.[1]);
    const early = lightness(
      countryFillColor({ total: 1, greenRatio: 1, avgCompletion: 10 }),
    );
    const complete = lightness(
      countryFillColor({ total: 1, greenRatio: 1, avgCompletion: 100 }),
    );
    expect(complete).toBeLessThan(early);
  });
});

describe("countryNameToIso", () => {
  it("resolves canonical names and common aliases", () => {
    expect(countryNameToIso("Japan")).toBe("JP");
    expect(countryNameToIso("United States")).toBe("US");
    expect(countryNameToIso("USA")).toBe("US");
    expect(countryNameToIso("UK")).toBe("GB");
    expect(countryNameToIso("south korea")).toBe("KR");
    expect(countryNameToIso("Czechia")).toBe("CZ");
  });

  it("returns undefined for unknown names", () => {
    expect(countryNameToIso("Atlantis")).toBeUndefined();
    expect(countryNameToIso("")).toBeUndefined();
  });
});
