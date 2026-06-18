import {
  dayPlanSchema,
  itineraryOutputSchema,
  type Budget,
  type Duration,
  type ItineraryOutput,
  type RouteStop,
  type TravelStyle,
  type TravelerType,
} from "../schemas";
import type { GenerationContext } from "./types";
import { list } from "./context";
import { routeDayMap, routeSummaryText, transitionNote } from "./route-sync";

export interface BuildItineraryOptions {
  duration?: Duration;
  customDays?: number;
  travelerType?: TravelerType;
  style?: TravelStyle;
  budget?: Budget;
  /** Ordered, time-aware route. When set, day bases/summary follow it. */
  route?: RouteStop[];
}

export interface ResolvedDuration {
  duration: Duration;
  label: string;
  dayCount: number;
}

/** Parse a day count from a duration label ("7 days" -> 7). */
export function parseDays(duration: string, customDays?: number): number {
  if (customDays && customDays > 0) return customDays;
  const match = duration.match(/\d+/);
  const n = match ? parseInt(match[0], 10) : 0;
  return n > 0 ? n : 5;
}

export function resolveItineraryDuration(
  ctx: GenerationContext,
  opts: Pick<BuildItineraryOptions, "duration" | "customDays"> = {},
): ResolvedDuration {
  const duration = opts.duration ?? ctx.config.duration;
  const customDays =
    opts.customDays ?? (opts.duration ? undefined : ctx.config.customDays);
  const dayCount = parseDays(duration, customDays);
  return {
    duration,
    dayCount,
    label: customDays ? `${dayCount} days` : duration,
  };
}

/** Build a structured, editable itinerary scaffold from the project config. */
export function buildItinerary(
  ctx: GenerationContext,
  opts: BuildItineraryOptions = {},
): ItineraryOutput {
  const { project, config } = ctx;
  const resolvedDuration = resolveItineraryDuration(ctx, opts);
  const travelerType = opts.travelerType ?? config.travelerType;
  const style = opts.style ?? config.travelStyles[0];
  const budget = opts.budget ?? config.budget;

  const cities = config.cities.length ? config.cities : project.regions;
  const country = project.country || "the country";
  const routeMap = opts.route?.length ? routeDayMap(opts.route) : null;

  const days = Array.from({ length: resolvedDuration.dayCount }, (_, i) => {
    const dayNumber = i + 1;
    const routeDay = routeMap?.[i];
    const base =
      routeDay?.city ?? (cities.length ? cities[i % cities.length] : country);
    const isArrival = dayNumber === 1;
    const isDeparture = dayNumber === resolvedDuration.dayCount;
    const title = isArrival
      ? "Arrival & orientation"
      : isDeparture
        ? "Final morning & departure"
        : `Day ${dayNumber}`;
    return dayPlanSchema.parse({
      day: dayNumber,
      title,
      base,
      pace: config.pace,
      transportNotes: routeDay?.arriveBy
        ? transitionNote(base, routeDay.arriveBy)
        : "",
      whyThisWorks: isArrival
        ? "Light first day to account for travel and jet lag."
        : "Grouped nearby sights to reduce backtracking.",
    });
  });

  const now = new Date().toISOString();

  return itineraryOutputSchema.parse({
    id: crypto.randomUUID(),
    title: `${resolvedDuration.label} ${country} itinerary`,
    subtitle: `${travelerType} - ${style ?? "Custom"} - ${budget}`,
    country: project.country,
    duration: resolvedDuration.label,
    travelerType,
    style,
    budget,
    overview: `A ${resolvedDuration.label} ${config.pace.toLowerCase()}-paced itinerary across ${list(
      cities,
    )} for ${travelerType.toLowerCase()} travelers.`,
    whoFor: `Best for ${travelerType.toLowerCase()} travelers who want ${
      style?.toLowerCase() ??
      list(config.travelStyles, "a balanced trip").toLowerCase()
    }.`,
    routeSummary: opts.route?.length
      ? routeSummaryText(opts.route)
      : cities.length
        ? cities.join(" -> ")
        : country,
    bestStayAreas: list(config.accommodation, "central, well-connected areas"),
    days,
    createdAt: now,
    updatedAt: now,
  });
}
