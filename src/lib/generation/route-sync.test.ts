import { describe, expect, it } from "vitest";
import { itineraryOutputSchema, type RouteStop } from "../schemas";
import { routeDayMap, routeSummaryText, syncItineraryToRoute } from "./route-sync";

function itinerary(bases: string[]) {
  return itineraryOutputSchema.parse({
    id: "itin",
    title: "Trip",
    country: "Japan",
    duration: `${bases.length} days`,
    travelerType: "Couple",
    routeSummary: "stale",
    days: bases.map((base, i) => ({
      day: i + 1,
      title: `Day ${i + 1}`,
      base,
      morning: `Edited morning in ${base}`,
    })),
    createdAt: "now",
    updatedAt: "now",
  });
}

const route: RouteStop[] = [
  { id: "a", city: "Tokyo", nights: 2 },
  { id: "b", city: "Kyoto", nights: 2, arriveBy: "train" },
  { id: "c", city: "Osaka", nights: 1, arriveBy: "flight" },
];

describe("routeDayMap", () => {
  it("expands nights into per-day city slots with arrival legs on day one", () => {
    expect(routeDayMap(route)).toEqual([
      { city: "Tokyo", arriveBy: undefined },
      { city: "Tokyo", arriveBy: undefined },
      { city: "Kyoto", arriveBy: "train" },
      { city: "Kyoto", arriveBy: undefined },
      { city: "Osaka", arriveBy: "flight" },
    ]);
  });
});

describe("routeSummaryText", () => {
  it("renders the route with transport modes", () => {
    expect(routeSummaryText(route)).toBe(
      "Tokyo → (train) Kyoto → (flight) Osaka",
    );
  });
});

describe("syncItineraryToRoute", () => {
  it("preserves unchanged days and flags re-based days for refresh", () => {
    // Existing 5-day itinerary already matching Tokyo/Tokyo/Kyoto/Kyoto/Osaka.
    const base = itinerary(["Tokyo", "Tokyo", "Kyoto", "Kyoto", "Osaka"]);
    // Swap Kyoto and Osaka order in the route.
    const reordered: RouteStop[] = [
      { id: "a", city: "Tokyo", nights: 2 },
      { id: "c", city: "Osaka", nights: 1, arriveBy: "flight" },
      { id: "b", city: "Kyoto", nights: 2, arriveBy: "train" },
    ];
    const { next, changedDays, removedDays } = syncItineraryToRoute(
      base,
      reordered,
    );

    expect(next.days).toHaveLength(5);
    expect(next.days.map((d) => d.base)).toEqual([
      "Tokyo",
      "Tokyo",
      "Osaka",
      "Kyoto",
      "Kyoto",
    ]);
    // Day 1-2 unchanged → keep prose, no flag.
    expect(next.days[0].needsRefresh).toBe(false);
    expect(next.days[0].morning).toBe("Edited morning in Tokyo");
    // Day 3 (Kyoto→Osaka) and Day 5 (Osaka→Kyoto) re-based; Day 4 stays Kyoto.
    expect(changedDays).toEqual([3, 5]);
    expect(next.days[2].needsRefresh).toBe(true);
    expect(next.days[3].needsRefresh).toBe(false);
    expect(next.days[3].morning).toBe("Edited morning in Kyoto");
    expect(removedDays).toEqual([]);
    expect(next.routeSummary).toBe("Tokyo → (flight) Osaka → (train) Kyoto");
  });

  it("grows and shrinks day count to match route nights", () => {
    const grown = syncItineraryToRoute(itinerary(["Tokyo"]), route);
    expect(grown.next.days).toHaveLength(5);
    expect(grown.removedDays).toEqual([]);

    const shrunk = syncItineraryToRoute(
      itinerary(["Tokyo", "Tokyo", "Kyoto", "Kyoto", "Osaka"]),
      [{ id: "a", city: "Tokyo", nights: 2 }],
    );
    expect(shrunk.next.days).toHaveLength(2);
    expect(shrunk.removedDays).toEqual([3, 4, 5]);
  });
});
