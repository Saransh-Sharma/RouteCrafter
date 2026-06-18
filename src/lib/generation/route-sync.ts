import {
  dayPlanSchema,
  TRANSPORT_META,
  type DayPlan,
  type ItineraryOutput,
  type RouteStop,
  type TransportMode,
} from "../schemas";

/** One entry per trip day: the base city and the leg taken to arrive (day 1 of a stop only). */
export interface RouteDay {
  city: string;
  arriveBy?: TransportMode;
}

/** Expand a route into a per-day array (a stop with N nights owns N days). */
export function routeDayMap(route: RouteStop[]): RouteDay[] {
  const days: RouteDay[] = [];
  for (const stop of route) {
    const nights = Math.max(stop.nights ?? 0, 0);
    for (let d = 0; d < nights; d += 1) {
      days.push({ city: stop.city, arriveBy: d === 0 ? stop.arriveBy : undefined });
    }
  }
  return days;
}

/** Human-readable route line with transport, e.g. "Tokyo → (train) Kyoto → (flight) Osaka". */
export function routeSummaryText(route: RouteStop[]): string {
  return route
    .map((stop, index) => {
      if (index === 0) return stop.city;
      const mode = TRANSPORT_META[stop.arriveBy ?? "train"].label.toLowerCase();
      return `(${mode}) ${stop.city}`;
    })
    .join(" → ");
}

/** Deterministic transition sentence set on the arrival day of each new stop. */
export function transitionNote(toCity: string, mode: TransportMode): string {
  return `Travel to ${toCity} by ${TRANSPORT_META[mode].label.toLowerCase()}.`;
}

export interface RouteSyncResult {
  next: ItineraryOutput;
  changedDays: number[];
  removedDays: number[];
}

/**
 * Re-sync an existing itinerary's structure to a route — no AI, no cost.
 *
 * Updates day count, each day's base city, transition transport notes, the
 * route summary, and the duration label. Hand-written activity prose is
 * preserved; days whose base city changed (or newly added days) are flagged
 * `needsRefresh` so the user can choose a billable AI refresh.
 */
export function syncItineraryToRoute(
  itinerary: ItineraryOutput,
  route: RouteStop[],
): RouteSyncResult {
  const map = routeDayMap(route);
  const dayCount = map.length;
  const changedDays: number[] = [];
  const removedDays: number[] = [];

  const days: DayPlan[] = [];
  for (let i = 0; i < dayCount; i += 1) {
    const dayNumber = i + 1;
    const base = map[i]?.city ?? itinerary.country;
    const arriveBy = map[i]?.arriveBy;
    const existing = itinerary.days[i];

    if (existing) {
      const baseChanged = (existing.base ?? "").trim() !== base;
      days.push({
        ...existing,
        day: dayNumber,
        base,
        transportNotes: arriveBy ? transitionNote(base, arriveBy) : "",
        needsRefresh: existing.needsRefresh || baseChanged,
      });
      if (baseChanged) changedDays.push(dayNumber);
    } else {
      days.push(
        dayPlanSchema.parse({
          day: dayNumber,
          title: dayNumber === 1 ? "Arrival & orientation" : `Day ${dayNumber}`,
          base,
          transportNotes: arriveBy ? transitionNote(base, arriveBy) : "",
          needsRefresh: true,
        }),
      );
      changedDays.push(dayNumber);
    }
  }

  for (let i = dayCount; i < itinerary.days.length; i += 1) {
    removedDays.push(i + 1);
  }

  const next: ItineraryOutput = {
    ...itinerary,
    duration: `${dayCount} days`,
    routeSummary: route.length ? routeSummaryText(route) : itinerary.routeSummary,
    days,
    updatedAt: new Date().toISOString(),
  };

  return { next, changedDays, removedDays };
}
