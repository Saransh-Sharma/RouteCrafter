import { z } from "zod";
import {
  budgetEnum,
  paceEnum,
  pdfThemeEnum,
  travelStyleEnum,
  travelerTypeEnum,
} from "./enums";

/** Itinerary structures — the sellable day-by-day product and its guides. */

/**
 * One web-search-grounded recommendation on a day's "Local details" page
 * (a restaurant, stay, activity, or shop). Fields default to "" so a partial
 * AI payload still parses; `source` carries the citation the model grounded it
 * in, and `caveat` the per-item "verify live hours/prices" reminder.
 */
export const dayDetailRecommendationSchema = z.object({
  name: z.string().default(""),
  /** Neighborhood / district within the base city. */
  area: z.string().default(""),
  /** Short tag, e.g. "izakaya", "design hotel", "covered market". */
  category: z.string().default(""),
  /** One line tying the pick to this trip's traveler context. */
  whyItFits: z.string().default(""),
  /** Optional rough price band, e.g. "$$", "mid-range", "€€€". */
  priceBand: z.string().default(""),
  /** Citation URL or title returned by web search. */
  source: z.string().default(""),
  /** Per-item verification note (hours/prices/booking change). */
  caveat: z.string().default(""),
});

export type DayDetailRecommendation = z.infer<
  typeof dayDetailRecommendationSchema
>;

/** A short, sourced cultural/contextual fact for the day's location. */
export const dayTriviaSchema = z.object({
  text: z.string().default(""),
  source: z.string().default(""),
});

export type DayTrivia = z.infer<typeof dayTriviaSchema>;

/**
 * Extra "Local details" page appended after a day's plan: web-search-grounded
 * recommendations contextual to that day's base city. Every section defaults to
 * an empty array, so the page is rendered only for the sections that are filled.
 */
export const dayDetailsSchema = z.object({
  /** Base city these recommendations are anchored to (sanity check). */
  base: z.string().default(""),
  restaurants: z.array(dayDetailRecommendationSchema).default([]),
  stays: z.array(dayDetailRecommendationSchema).default([]),
  activities: z.array(dayDetailRecommendationSchema).default([]),
  shopping: z.array(dayDetailRecommendationSchema).default([]),
  trivia: z.array(dayTriviaSchema).default([]),
  /** ISO timestamp of the grounded generation, for freshness display. */
  generatedAt: z.string().default(""),
});

export type DayDetails = z.infer<typeof dayDetailsSchema>;

export const dayPlanSchema = z.object({
  day: z.number().int().positive(),
  title: z.string(),
  base: z.string().default(""),
  morning: z.string().default(""),
  lunch: z.string().default(""),
  afternoon: z.string().default(""),
  evening: z.string().default(""),
  dinner: z.string().default(""),
  transportNotes: z.string().default(""),
  bookingNotes: z.string().default(""),
  pace: paceEnum.optional(),
  walkingIntensity: z.string().default(""),
  optionalUpgrade: z.string().default(""),
  lowEnergyAlternative: z.string().default(""),
  rainyDayAlternative: z.string().default(""),
  whyThisWorks: z.string().default(""),
  /** Optional illustration for this day (data URL or remote URL). */
  image: z.string().default(""),
  /** Prompt used to generate or brief the day's optional illustration. */
  imagePrompt: z.string().default(""),
  /**
   * Optional web-search-grounded "Local details" page (restaurants, stays,
   * activities, shopping, trivia). Omitted until the buyer generates it.
   */
  details: dayDetailsSchema.optional(),
  /**
   * Set true when a route change re-based this day to a new city, so its prose
   * may still reference the old one. Cleared after an AI refresh or manual edit.
   */
  needsRefresh: z.boolean().default(false),
});

export type DayPlan = z.infer<typeof dayPlanSchema>;

/**
 * User-authored block added in the PDF editor. Rendered at an `anchor` section
 * (cover | overview | day:<n> | guides | closing), ordered by `order`.
 */
export const customBlockSchema = z.object({
  id: z.string(),
  anchor: z.string(),
  order: z.number().default(0),
  type: z.enum(["text", "image", "divider", "route-map"]).default("text"),
  /** text: heading|subheading|body|callout ; divider: line|space|rule */
  variant: z.string().default(""),
  text: z.string().default(""),
  image: z.string().default(""),
});

export type CustomBlock = z.infer<typeof customBlockSchema>;

export const itineraryOutputSchema = z.object({
  id: z.string(),
  plannedEditionId: z.string().optional(),
  title: z.string(),
  subtitle: z.string().default(""),
  country: z.string(),
  duration: z.string(),
  travelerType: travelerTypeEnum,
  style: travelStyleEnum.optional(),
  budget: budgetEnum.optional(),
  overview: z.string().default(""),
  whoFor: z.string().default(""),
  routeSummary: z.string().default(""),
  bestStayAreas: z.string().default(""),
  days: z.array(dayPlanSchema).default([]),
  foodGuide: z.string().default(""),
  transportGuide: z.string().default(""),
  packingList: z.string().default(""),
  etiquetteSafety: z.string().default(""),
  bookingChecklist: z.string().default(""),
  personalizationQuestions: z.string().default(""),
  verificationNotes: z.string().default(""),
  /** PDF presentation config. */
  pdfTheme: pdfThemeEnum.default("beige"),
  coverImage: z.string().default(""),
  /** PDF editor: keys of built-in elements the user hid (reversible). */
  hiddenElements: z.array(z.string()).default([]),
  /** PDF editor: user-authored blocks (text/image/divider). */
  customBlocks: z.array(customBlockSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ItineraryOutput = z.infer<typeof itineraryOutputSchema>;
