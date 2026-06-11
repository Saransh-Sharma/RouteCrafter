import type { PromptTemplate } from "../types";
import { configBlock } from "../context";
import { REALISM_RULES } from "../realism";

export const itineraryMatrixTemplate: PromptTemplate = {
  id: "itinerary-matrix",
  label: "Itinerary matrix",
  group: "Itinerary",
  description:
    "Compact duration × traveler-type matrix with A/B(/C/D) variations.",
  build: (ctx) => `You are a senior travel planner specializing in ${ctx.project.country || "this country"}.

Create a COMPACT itinerary matrix before expanding any full itinerary.

PROJECT CONFIGURATION:
${configBlock(ctx)}

Build a matrix across:
- Durations: 3, 5, 7, and 14 days
- Traveler types: Solo, Couple, Family, Group

For each duration + traveler type, propose:
- Variation A: Classic First-Timer (iconic highlights, efficient routing, balanced pace)
- Variation B: Local-First Slow Travel (neighborhoods, markets, food, culture, lower rush)
Add when relevant:
- Variation C: Nature / Adventure / Scenic
- Variation D: Premium Comfort

Keep each cell to 1-2 lines (route spine + vibe). Output as a clean, compact table or list that is easy to scan and expand later.

${REALISM_RULES}`,
};
