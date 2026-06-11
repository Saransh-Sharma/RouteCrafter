/**
 * Zod schemas + data model (Phase 2).
 *
 * Single source of truth for Project, TripConfiguration, ItineraryOutput,
 * DayPlan, PortfolioImagePrompt, and MarketplaceListing. TypeScript types are
 * inferred from these schemas, and the JSON import/export contracts validate
 * against `projectSchema`.
 */

export * from "./enums";
export * from "./trip-config";
export * from "./image-prompt";
export * from "./itinerary";
export * from "./listing";
export * from "./project";
