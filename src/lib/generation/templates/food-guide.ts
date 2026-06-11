import type { PromptTemplate } from "../types";
import { configBlock } from "../context";
import { VERIFICATION_FOOTER } from "../realism";

export const foodGuideTemplate: PromptTemplate = {
  id: "food-guide",
  label: "Food & cafe guide",
  group: "Guides",
  description: "Must-try dishes, food areas, cafes, and dining etiquette.",
  build: (ctx) => `Write a food & cafe guide for ${ctx.project.country || "this country"}, tailored to the trip below.

PROJECT CONFIGURATION:
${configBlock(ctx)}

Cover:
- Must-try dishes (by type), with what makes each special.
- Best food areas / neighborhoods to eat in (by city/region).
- Cafe culture notes.
- Dietary accommodations relevant to the food preferences above (e.g. vegetarian, vegan, halal, Jain, no alcohol, kid-friendly).
- Dining etiquette and tipping norms.

Recommend by type and neighborhood rather than naming specific restaurants whose availability you cannot verify. ${VERIFICATION_FOOTER}`,
};
