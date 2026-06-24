import type { PromptTemplate } from "../types";
import { configBlock, durationLabel } from "../context";
import { REALISM_RULES, TRAVELER_ADAPTATION } from "../realism";
import { NATURAL_LANGUAGE_RULES } from "../language";

export const expandedItineraryTemplate: PromptTemplate = {
  id: "expanded-itinerary",
  label: "Expanded itinerary",
  group: "Itinerary",
  description: "Full day-by-day itinerary to the RouteCrafter standard.",
  build: (ctx) => `You are a senior travel planner. Write a complete, premium, sellable ${durationLabel(ctx)} itinerary for ${ctx.project.country || "this country"}.

PROJECT CONFIGURATION:
${configBlock(ctx)}

Produce ALL of the following sections:
1. Trip overview (duration, traveler type, style, season fit, pace, route logic)
2. Who this itinerary is for (traveler fit, energy level, budget, interests)
3. Day-by-day plan. For EACH day: theme, morning, lunch/cafe, afternoon, evening, dinner area, transport notes, booking notes, pacing, optional upgrade, low-energy alternative, rainy-day alternative, and why this day works.
4. Route logic (why this order, reduced backtracking, heavy/light days, best stay areas)
5. Accommodation guidance (best neighborhoods, who each suits, pros/cons, budget/mid/premium - do not invent specific hotel availability)
6. Food & cafe guide (must-try dishes, food areas, cafes, dietary notes, dining etiquette)
7. Transport guide (airport arrival, city-to-city, local transit, passes/cards, taxi/rideshare, walking intensity)
8. Packing list (weather, clothing norms, walking comfort, electronics/adapters, medicines, family add-ons)
9. Etiquette & safety (cultural norms, common tourist mistakes, scams, emergency basics, useful phrases)
10. Booking checklist (what to book ahead vs keep flexible, reservations, ticket warnings, peak-season notes)
11. Personalization questions
12. Deliverable packaging (PDF, spreadsheet, printable packing list, optional map pins)

${TRAVELER_ADAPTATION}

${NATURAL_LANGUAGE_RULES}

${REALISM_RULES}`,
};
