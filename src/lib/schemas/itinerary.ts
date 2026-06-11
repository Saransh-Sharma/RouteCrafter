import { z } from "zod";
import { budgetEnum, paceEnum, travelStyleEnum, travelerTypeEnum } from "./enums";

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
});

export type DayPlan = z.infer<typeof dayPlanSchema>;

export const itineraryOutputSchema = z.object({
  id: z.string(),
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
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ItineraryOutput = z.infer<typeof itineraryOutputSchema>;
