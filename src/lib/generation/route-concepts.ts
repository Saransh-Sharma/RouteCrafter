import type { GenerationContext } from "./types";
import type { Duration, TravelerType } from "../schemas";

/** A short, sellable route idea used as inspiration when planning editions. */
export interface RouteConcept {
  label: string;
  spine: string;
}

/** Build the variation labels, conditioned on the project's styles. */
function variationLabels(ctx: GenerationContext): string[] {
  const styles = ctx.config.travelStyles;
  const labels = ["Classic First-Timer", "Local-First Slow Travel"];
  if (
    styles.includes("Nature/adventure") ||
    ctx.config.interests.includes("Nature") ||
    ctx.config.interests.includes("Mountains")
  ) {
    labels.push("Nature / Adventure / Scenic");
  }
  if (styles.includes("Premium comfort") || ctx.config.budget === "Luxury") {
    labels.push("Premium Comfort");
  }
  return labels;
}

/** A short one-line route spine for a given duration + variation. */
function spineFor(
  ctx: GenerationContext,
  duration: string,
  travelerType: TravelerType,
  label: string,
): string {
  const cities = (ctx.config.cities.length
    ? ctx.config.cities
    : ctx.project.regions
  ).slice(0, 4);
  const route = cities.length ? cities.join(" -> ") : ctx.project.country;
  const vibe =
    label === "Local-First Slow Travel"
      ? "neighborhoods, markets, food, lower rush"
      : label === "Nature / Adventure / Scenic"
        ? "scenery, nature, active days"
        : label === "Premium Comfort"
          ? "premium stays, easy pace, upgrades"
          : "iconic highlights, efficient routing";
  return `${route} - ${vibe} (${ctx.config.pace.toLowerCase()} pace, ${duration} for ${travelerType.toLowerCase()})`;
}

/** Route concept inspiration for one planned edition (ephemeral, never persisted). */
export function routeConcepts(
  ctx: GenerationContext,
  duration: Duration,
  travelerType: TravelerType,
): RouteConcept[] {
  return variationLabels(ctx).map((label) => ({
    label,
    spine: spineFor(ctx, duration, travelerType, label),
  }));
}
