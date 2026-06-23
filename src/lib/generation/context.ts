import {
  createEmptyTripConfig,
  type Duration,
  type Project,
  type TravelerType,
} from "../schemas";
import type { GenerationContext } from "./types";

/** Build a generation context from a project, filling sensible fallbacks.
 *
 * `extraCities` are additive cities for a specific itinerary edition. They are
 * merged on top of the brief's base set (config cities, falling back to project
 * regions) and de-duplicated, so every downstream consumer — `configBlock`,
 * `buildItinerary`, `buildMatrix` — picks them up uniformly.
 *
 * `duration`/`customDays`/`travelerType` override the brief's base values so a
 * prompt run for a specific edition reflects that edition's length and traveler
 * type rather than the project's first trip config. */
export function buildContext(
  project: Project,
  options?: {
    extraCities?: string[];
    duration?: Duration;
    customDays?: number;
    travelerType?: TravelerType;
  },
): GenerationContext {
  const base =
    project.tripConfigs[0] ??
    createEmptyTripConfig({ cities: project.regions });
  const baseCities = base.cities.length ? base.cities : project.regions;
  const extra = options?.extraCities ?? [];
  const cities = extra.length
    ? [...new Set([...baseCities, ...extra])]
    : base.cities;
  const overridesDuration =
    options?.duration !== undefined || options?.customDays !== undefined;
  const config = {
    ...base,
    cities,
    duration: options?.duration ?? base.duration,
    customDays: overridesDuration ? options?.customDays : base.customDays,
    travelerType: options?.travelerType ?? base.travelerType,
  };
  return {
    project,
    config,
    brand: project.brandStyle,
  };
}

/** Human-readable duration, honoring a custom day count. */
export function durationLabel(ctx: GenerationContext): string {
  const { duration, customDays } = ctx.config;
  return customDays ? `${customDays} days` : duration;
}

/** Join a list for prompts, with a fallback when empty. */
export function list(items: string[], fallback = "not specified"): string {
  return items.length ? items.join(", ") : fallback;
}

const VOICE_DESCRIPTIONS: Record<string, string> = {
  editorial: "warm, editorial, and personable",
  premium: "premium, understated, and confident",
  friendly: "friendly, practical, and reassuring",
  adventurous: "energetic, vivid, and adventurous",
};

export function voiceDescription(ctx: GenerationContext): string {
  return VOICE_DESCRIPTIONS[ctx.brand.voice] ?? VOICE_DESCRIPTIONS.editorial;
}

/** A compact configuration block shared across templates. */
export function configBlock(ctx: GenerationContext): string {
  const { project, config } = ctx;
  const cities = list(config.cities.length ? config.cities : project.regions);
  return [
    `Country: ${project.country || "(set the country)"}`,
    `Cities/regions: ${cities}`,
    `Duration: ${durationLabel(ctx)}`,
    `Traveler type: ${config.travelerType}`,
    `Travel styles: ${list(config.travelStyles)}`,
    `Pace: ${config.pace}`,
    `Budget: ${config.budget}`,
    `Accommodation: ${list(config.accommodation)}`,
    `Food preferences: ${list(config.food)}`,
    `Transport preferences: ${list(config.transport)}`,
    `Interests: ${list(config.interests)}`,
    `Constraints: ${list(config.constraints)}`,
    `Season/month: ${config.seasonMonth || "not specified"}`,
    `Arrival: ${config.arrivalCity || "not specified"}${
      config.arrivalTime ? ` (${config.arrivalTime})` : ""
    }`,
    `Departure: ${config.departureCity || "not specified"}${
      config.departureTime ? ` (${config.departureTime})` : ""
    }`,
    `Must-see: ${list(config.mustSee)}`,
    `Avoid: ${list(config.avoid)}`,
    `Special occasion: ${config.specialOccasion || "none"}`,
    `Deliverables: ${list(config.deliverables)}`,
    `Brand voice: ${voiceDescription(ctx)}`,
  ].join("\n");
}
