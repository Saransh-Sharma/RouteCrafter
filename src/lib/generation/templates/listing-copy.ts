import type { PromptTemplate } from "../types";
import { configBlock } from "../context";
import { NATURAL_LANGUAGE_RULES } from "../language";

export const listingCopyTemplate: PromptTemplate = {
  id: "listing-copy",
  label: "Marketplace listing copy",
  group: "Listing",
  description: "Gig titles, tags, descriptions, packages, and delivery notes.",
  build: (ctx) => `You are a marketplace copywriter for premium travel services. Brand voice: ${ctx.brand.voice}.

Write Fiverr/Etsy listing copy for a custom ${ctx.project.country || "country"} travel-itinerary service.

PROJECT CONFIGURATION:
${configBlock(ctx)}

Produce:
1. 5 gig title options (buyer-focused, include "${ctx.project.country || "country"}"). Examples to adapt:
   - I will create a custom ${ctx.project.country || "country"} travel itinerary and packing list
   - I will design a personalized ${ctx.project.country || "country"} itinerary for solo, couple, family or group travel
2. 8-12 search tags (include: travel itinerary, travel planner, trip planner, custom itinerary, vacation planner, ${ctx.project.country || "country"} travel, travel guide, travel plan).
3. A short description (2-3 sentences, premium and concise).
4. A long description (buyer-focused, scannable, with light formatting).
5. Packages:
   - Basic: 3-day itinerary, 1 destination, PDF
   - Standard: 5-7 day itinerary, PDF + spreadsheet + packing list
   - Premium: 10-14 day itinerary, multi-city, PDF + spreadsheet + packing list + map pins + revision
6. Delivery notes and 2-3 upsell ideas.

Be specific to ${ctx.project.country || "the country"}. Avoid generic filler.

${NATURAL_LANGUAGE_RULES}`,
};
