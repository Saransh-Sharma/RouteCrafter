import type { PromptTemplate } from "../types";
import { configBlock } from "../context";
import { NATURAL_LANGUAGE_RULES } from "../language";

export const countryPositioningTemplate: PromptTemplate = {
  id: "country-positioning",
  label: "Country positioning",
  group: "Positioning",
  description:
    "Defines how this country product is positioned and who it's for.",
  build: (ctx) => `You are a premium travel-product strategist.

Write the positioning for a custom ${ctx.project.country || "country"} travel-itinerary product sold on marketplaces like Fiverr and Etsy. The tone should be ${ctx.brand.voice}.

PROJECT CONFIGURATION:
${configBlock(ctx)}

Produce:
1. A one-line positioning statement.
2. "Who this is for" (3-4 traveler profiles this product serves best).
3. 5 differentiators that make this offering feel premium, personalized, and local-first (not generic).
4. 3 angles or sub-niches this country product could expand into.

Keep it concrete and specific to ${ctx.project.country || "the country"}. Avoid clichés like "explore the city".

${NATURAL_LANGUAGE_RULES}`,
};
