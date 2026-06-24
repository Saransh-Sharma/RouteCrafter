import type { PromptTemplate } from "../types";
import { NATURAL_LANGUAGE_RULES } from "../language";

export const buyerRequirementsTemplate: PromptTemplate = {
  id: "buyer-requirements",
  label: "Buyer requirements",
  group: "Listing",
  description: "The intake questions to collect from buyers before planning.",
  build: (ctx) => `Write a clear, friendly buyer-requirements form for a custom ${ctx.project.country || "country"} itinerary service. Brand voice: ${ctx.brand.voice}.

Ask for everything needed to plan a great trip, grouped sensibly:
- Destination / cities and whether they're flexible
- Travel dates (or season) and trip length
- Number of travelers and traveler type (solo/couple/family/group)
- Budget level
- Interests and the kind of trip they want
- Food preferences and dietary restrictions
- Accommodation style
- Mobility limitations or accessibility needs
- Must-see places and places to avoid
- Preferred pace
- Special occasions
- Arrival/departure details (airports, times)

Phrase each as a short prompt the buyer can answer quickly. End by reassuring them the itinerary is fully custom.

${NATURAL_LANGUAGE_RULES}`,
};
