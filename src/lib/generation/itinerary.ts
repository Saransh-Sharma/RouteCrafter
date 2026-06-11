import {
  dayPlanSchema,
  itineraryOutputSchema,
  type Budget,
  type Duration,
  type ItineraryOutput,
  type TravelStyle,
  type TravelerType,
} from "../schemas";
import type { GenerationContext } from "./types";
import { durationLabel, list } from "./context";

export interface BuildItineraryOptions {
  duration?: Duration;
  travelerType?: TravelerType;
  style?: TravelStyle;
  budget?: Budget;
}

/** Parse a day count from a duration label ("7 days" -> 7). */
export function parseDays(duration: string, customDays?: number): number {
  if (customDays && customDays > 0) return customDays;
  const match = duration.match(/\d+/);
  const n = match ? parseInt(match[0], 10) : 0;
  return n > 0 ? n : 5;
}

/** Build a structured, editable itinerary scaffold from the project config. */
export function buildItinerary(
  ctx: GenerationContext,
  opts: BuildItineraryOptions = {},
): ItineraryOutput {
  const { project, config } = ctx;
  const duration = opts.duration ?? config.duration;
  const travelerType = opts.travelerType ?? config.travelerType;
  const style = opts.style ?? config.travelStyles[0];
  const budget = opts.budget ?? config.budget;

  // customDays only applies to the config's own duration; an explicit
  // duration override (e.g. from the matrix or creator) wins.
  const customDays = opts.duration ? undefined : config.customDays;
  const dayCount = parseDays(duration, customDays);
  const cities = config.cities.length ? config.cities : project.regions;
  const country = project.country || "the country";

  const days = Array.from({ length: dayCount }, (_, i) => {
    const dayNumber = i + 1;
    const base = cities.length ? cities[i % cities.length] : country;
    const isArrival = dayNumber === 1;
    const isDeparture = dayNumber === dayCount;
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
      whyThisWorks: isArrival
        ? "Light first day to account for travel and jet lag."
        : "Grouped nearby sights to reduce backtracking.",
    });
  });

  const now = new Date().toISOString();

  return itineraryOutputSchema.parse({
    id: crypto.randomUUID(),
    title: `${durationLabel(ctx)} ${country} itinerary`,
    subtitle: `${travelerType} - ${style ?? "Custom"} - ${budget}`,
    country: project.country,
    duration,
    travelerType,
    style,
    budget,
    overview: `A ${durationLabel(ctx)} ${config.pace.toLowerCase()}-paced itinerary across ${list(
      cities,
    )} for ${travelerType.toLowerCase()} travelers.`,
    whoFor: `Best for ${travelerType.toLowerCase()} travelers who want ${list(
      config.travelStyles,
      "a balanced trip",
    )}.`,
    routeSummary: cities.length ? cities.join(" -> ") : country,
    bestStayAreas: list(config.accommodation, "central, well-connected areas"),
    days,
    createdAt: now,
    updatedAt: now,
  });
}
