import type {
  Duration,
  ItineraryOutput,
  OutputRequirement,
  PlannedEdition,
  Project,
  RouteStop,
  TransportMode,
  TravelerType,
} from "./types";
import { durationOverrideFromLabel } from "./generation/itinerary";

/**
 * Planned-edition and route helpers. An edition is a committed
 * duration × traveler-type variant of one product, with an ordered,
 * time-aware multi-city route.
 */

export const OUTPUT_LABELS: Record<OutputRequirement, string> = {
  "marketplace-listing": "Marketplace listing",
  pdf: "PDF",
  spreadsheet: "Spreadsheet",
  "packing-list": "Packing list",
  "food-guide": "Food guide",
  "booking-checklist": "Booking checklist",
  "portfolio-visuals": "Portfolio visuals",
  "map-pins-legacy": "Map pins (legacy)",
};

export function editionLabel(edition: PlannedEdition): string {
  const duration = edition.customDays
    ? `${edition.customDays} days`
    : edition.duration;
  return `${duration} · ${edition.travelerType}`;
}

export function editionDayCount(edition: PlannedEdition): number {
  return edition.customDays ?? Number.parseInt(edition.duration, 10);
}

export function itineraryForEdition(
  project: Project,
  edition: PlannedEdition,
): ItineraryOutput | undefined {
  if (edition.itineraryId) {
    const linked = project.itineraries.find(
      (itinerary) => itinerary.id === edition.itineraryId,
    );
    if (linked) return linked;
  }
  return project.itineraries.find(
    (itinerary) =>
      itinerary.plannedEditionId === edition.id ||
      (itinerary.duration ===
        (edition.customDays ? `${edition.customDays} days` : edition.duration) &&
        itinerary.travelerType === edition.travelerType),
  );
}

/** Additive cities for the planned edition linked to this itinerary, if any. */
export function editionExtraCities(
  project: Project,
  itinerary?: ItineraryOutput | null,
): string[] {
  const id = itinerary?.plannedEditionId;
  if (!id) return [];
  return project.productionPlan.editions.find((e) => e.id === id)?.cities ?? [];
}

/** Generation-context overrides for the edition an itinerary belongs to, so AI
 *  prompts reflect that edition's cities, duration, and traveler type instead of
 *  the project's first trip config. Prefers the linked edition; falls back to the
 *  itinerary's own stored duration/traveler type when there is no link. */
export function editionContextOptions(
  project: Project,
  itinerary?: ItineraryOutput | null,
): {
  extraCities: string[];
  duration?: Duration;
  customDays?: number;
  travelerType?: TravelerType;
} {
  const extraCities = editionExtraCities(project, itinerary);
  const edition = itinerary?.plannedEditionId
    ? project.productionPlan.editions.find(
        (e) => e.id === itinerary.plannedEditionId,
      )
    : undefined;
  if (edition) {
    return {
      extraCities,
      duration: edition.duration,
      customDays: edition.customDays,
      travelerType: edition.travelerType,
    };
  }
  if (itinerary) {
    return {
      extraCities,
      ...durationOverrideFromLabel(itinerary.duration),
      travelerType: itinerary.travelerType,
    };
  }
  return { extraCities };
}

/* ----------------------------------------------------------------------------
 * Route (ordered, time-aware stops) helpers
 * ------------------------------------------------------------------------- */

/** Total nights placed across the route. With our model this equals trip days. */
export function routeNights(route: RouteStop[]): number {
  return route.reduce((sum, stop) => sum + (stop.nights ?? 0), 0);
}

/**
 * Inclusive day span a stop occupies, 1-based. A stop starting after `o`
 * cumulative nights with `n` nights spans days `o+1 … o+n` (min one day shown).
 */
export function dayRangeForStop(
  route: RouteStop[],
  index: number,
): { start: number; end: number } {
  const offset = route
    .slice(0, index)
    .reduce((sum, stop) => sum + (stop.nights ?? 0), 0);
  const nights = Math.max(route[index]?.nights ?? 0, 1);
  return { start: offset + 1, end: offset + nights };
}

/**
 * Build an ordered route from the brief cities plus edition extras, spreading
 * `dayCount` nights as evenly as possible (remainder to the earliest stops).
 * Used to seed editions that have no explicit route yet.
 */
export function defaultRoute(
  baseCities: string[],
  extra: string[],
  dayCount: number,
): RouteStop[] {
  const cities = [
    ...new Set([...baseCities, ...extra].map((c) => c.trim()).filter(Boolean)),
  ];
  const count = cities.length;
  if (!count) return [];
  const each = Math.floor(dayCount / count);
  let remainder = dayCount % count;
  return cities.map((city, index) => {
    let nights = each + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    if (nights < 1) nights = index === 0 ? 1 : 0; // guarantee a real first stop
    return {
      id: crypto.randomUUID(),
      city,
      nights,
      arriveBy: index === 0 ? undefined : ("train" as TransportMode),
    } satisfies RouteStop;
  });
}

/** The edition's explicit route, or a lazily-built default for legacy editions. */
export function editionRoute(
  project: Project,
  edition: PlannedEdition,
): RouteStop[] {
  if (edition.route?.length) return edition.route;
  const base = project.tripConfigs[0]?.cities.length
    ? project.tripConfigs[0].cities
    : project.regions;
  return defaultRoute(base, edition.cities, editionDayCount(edition));
}

/** Derive the flat `cities` extras list (route cities not in the brief). */
export function routeToCities(
  route: RouteStop[],
  baseCities: string[],
): string[] {
  const baseSet = new Set(baseCities);
  return [...new Set(route.map((stop) => stop.city))].filter(
    (city) => !baseSet.has(city),
  );
}

/** Keep transport coherent: first stop has no inbound leg; others default. */
export function normalizeRoute(route: RouteStop[]): RouteStop[] {
  return route.map((stop, index) => ({
    ...stop,
    arriveBy:
      index === 0 ? undefined : stop.arriveBy ?? ("train" as TransportMode),
  }));
}
