/**
 * Shared realism + verification rules injected into itinerary-producing
 * templates so generated output stays believable and never fabricates
 * real-time data.
 */
export const REALISM_RULES = `REALISM RULES (must follow):
- No impossible days. Never pack 8-10 attractions into one day.
- Do not group far-apart places in the same half-day unless transport is realistic.
- Group nearby places; reduce backtracking; add travel buffers and rest windows.
- Balance heavy and light days. Account for jet lag on arrival.
- Add rest windows for families, seniors, and very young children.
- Always include low-energy and rainy-day alternatives.
- Be specific: say what, where, and why. Avoid vague lines like "explore the city".
- Recommend food by type and neighborhood, not generic "try local food".
- Explain why each day works (routing logic).

DO NOT FABRICATE:
- Never invent real-time prices, opening hours, ticket availability, or hotel availability.
- Never claim personal travel experience unless explicitly provided.
- Remind the buyer to verify live opening hours, prices, tickets, restaurant and hotel availability before final delivery.`;

export const TRAVELER_ADAPTATION = `TRAVELER ADAPTATION:
- Solo: safety, flexibility, easy transport, confidence-building.
- Couple: scenic, romantic, relaxed, memorable moments.
- Family: kid-friendly, meal/rest breaks, practical transport, low-stress routing.
- Group: easy sharing, split options, consensus-friendly activities, coordination clarity.`;

/** A short verification reminder suitable as a footer line. */
export const VERIFICATION_FOOTER =
  "Note: Verify live opening hours, prices, tickets, and hotel/restaurant availability before final delivery. Do not present any real-time data as guaranteed.";
