import { z } from "zod";
import {
  budgetEnum,
  durationEnum,
  paceEnum,
  pdfThemeEnum,
  travelStyleEnum,
  travelerTypeEnum,
} from "./enums";

/**
 * Itinerary structures. Defined now so the data model is stable; they are
 * populated by the Phase 6 (matrix) and Phase 7 (expanded itinerary) builders.
 */

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

/**
 * Compact duration x traveler-type variation grid (Phase 6). Each cell holds a
 * short list of itinerary "spines" the buyer can pick from before expanding.
 */
export const matrixVariationSchema = z.object({
  label: z.string(),
  spine: z.string().default(""),
});

export const matrixCellSchema = z.object({
  duration: durationEnum,
  travelerType: travelerTypeEnum,
  variations: z.array(matrixVariationSchema).default([]),
});

export const itineraryMatrixSchema = z.object({
  id: z.string(),
  cells: z.array(matrixCellSchema).default([]),
  updatedAt: z.string(),
});

export type MatrixVariation = z.infer<typeof matrixVariationSchema>;
export type MatrixCell = z.infer<typeof matrixCellSchema>;
export type ItineraryMatrix = z.infer<typeof itineraryMatrixSchema>;
