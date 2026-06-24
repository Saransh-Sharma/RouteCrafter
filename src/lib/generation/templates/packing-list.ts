import type { PromptTemplate } from "../types";
import { configBlock } from "../context";
import { NATURAL_LANGUAGE_RULES } from "../language";

export const packingListTemplate: PromptTemplate = {
  id: "packing-list",
  label: "Packing list",
  group: "Guides",
  description: "Season- and traveler-aware packing checklist.",
  build: (ctx) => `Create a practical packing list for a ${ctx.project.country || "country"} trip.

PROJECT CONFIGURATION:
${configBlock(ctx)}

Tailor to the season/month, walking intensity, traveler type, and any constraints above.
Organize into clear categories (Clothing, Footwear, Weather, Electronics/Adapters, Health/Medicines, Documents, Day bag, Family add-ons where relevant).
Use a checklist format. Note local clothing norms and any culturally appropriate dress. Do not assume specific weather as fact - frame it as typical for the season and tell the buyer to confirm the forecast.

${NATURAL_LANGUAGE_RULES}`,
};
