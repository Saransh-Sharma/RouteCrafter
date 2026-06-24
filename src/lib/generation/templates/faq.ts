import type { PromptTemplate } from "../types";
import { NATURAL_LANGUAGE_RULES } from "../language";

export const faqTemplate: PromptTemplate = {
  id: "faq",
  label: "FAQ",
  group: "Listing",
  description: "Buyer-facing FAQ that sets expectations clearly.",
  build: (ctx) => `Write a buyer-facing FAQ for a custom ${ctx.project.country || "country"} itinerary service. Brand voice: ${ctx.brand.voice}.

Answer at least these questions clearly and honestly:
- Do you book hotels or flights for me?
- Can you plan for families (and other traveler types)?
- Can you make a slow-paced itinerary?
- Can you include food recommendations?
- Can you include a packing list?
- Can you create multi-city itineraries?
- Can you revise the itinerary?
- Do you verify opening hours and prices?

For the verification question, be honest: explain that live opening hours, prices, tickets, and availability should be confirmed close to travel and are not guaranteed. Keep answers concise and reassuring.

${NATURAL_LANGUAGE_RULES}`,
};
