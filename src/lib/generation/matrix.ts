import type { GenerationContext } from "./types";
import type {
  Duration,
  ItineraryMatrix,
  MatrixCell,
  MatrixVariation,
  TravelerType,
} from "../schemas";

const DEFAULT_DURATIONS: Duration[] = ["3 days", "5 days", "7 days", "14 days"];
const DEFAULT_TRAVELERS: TravelerType[] = [
  "Solo",
  "Couple",
  "Family",
  "Group",
];

/** Build the variation labels for a cell, conditioned on the project's styles. */
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
  duration: Duration,
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

/** Build the full duration x traveler-type matrix scaffold. */
export function buildMatrix(ctx: GenerationContext): ItineraryMatrix {
  const durations = ctx.project.durations.length
    ? ctx.project.durations
    : DEFAULT_DURATIONS;
  const travelers = ctx.project.travelerTypes.length
    ? ctx.project.travelerTypes
    : DEFAULT_TRAVELERS;
  const labels = variationLabels(ctx);

  const cells: MatrixCell[] = [];
  for (const duration of durations) {
    for (const travelerType of travelers) {
      const variations: MatrixVariation[] = labels.map((label) => ({
        label,
        spine: spineFor(ctx, duration, travelerType, label),
      }));
      cells.push({ duration, travelerType, variations });
    }
  }

  return {
    id: crypto.randomUUID(),
    cells,
    updatedAt: new Date().toISOString(),
  };
}
