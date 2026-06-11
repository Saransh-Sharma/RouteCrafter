import { z } from "zod";

/**
 * Canonical option sets for RouteCrafter, defined once as Zod enums and reused
 * across schemas, forms, and the generation engine. Keeping these here avoids
 * drift between validation, UI option lists, and prompt templates.
 */

export const durationEnum = z.enum([
  "3 days",
  "5 days",
  "7 days",
  "10 days",
  "14 days",
]);

export const travelerTypeEnum = z.enum([
  "Solo",
  "Couple",
  "Family",
  "Group",
  "Senior travelers",
  "Luxury travelers",
  "Budget travelers",
  "Business + leisure",
]);

export const travelStyleEnum = z.enum([
  "Classic first-timer",
  "Local-first slow travel",
  "Food/culture heavy",
  "Nature/adventure",
  "Romantic",
  "Family-friendly",
  "Premium comfort",
  "Budget-friendly",
  "Wellness",
  "Photography",
  "Shopping",
  "Nightlife",
  "Spiritual/cultural",
]);

export const paceEnum = z.enum(["Relaxed", "Balanced", "Active", "Very active"]);

export const budgetEnum = z.enum([
  "Budget",
  "Mid-range",
  "Premium",
  "Luxury",
]);

export const accommodationEnum = z.enum([
  "Central convenience",
  "Boutique",
  "Family-friendly",
  "Resort",
  "Apartment",
  "Luxury hotel",
  "Budget stay",
]);

export const foodPrefEnum = z.enum([
  "Local food",
  "Street food",
  "Fine dining",
  "Cafés",
  "Vegetarian",
  "Vegan",
  "Halal",
  "Jain",
  "Kid-friendly",
  "No alcohol",
]);

export const transportPrefEnum = z.enum([
  "Public transport",
  "Private car",
  "Self-drive",
  "Scenic rail",
  "Walking-heavy",
  "Low walking",
  "Domestic flights allowed",
]);

export const interestEnum = z.enum([
  "Landmarks",
  "Museums",
  "Food",
  "Markets",
  "Nature",
  "Beaches",
  "Mountains",
  "Temples/churches",
  "Architecture",
  "Local neighborhoods",
  "Shopping",
  "Theme parks",
  "Nightlife",
  "Photography",
  "Wellness",
]);

export const constraintEnum = z.enum([
  "Mobility limitations",
  "Kids",
  "Elderly travelers",
  "Pregnancy",
  "Dietary restrictions",
  "Avoid nightlife",
  "Avoid strenuous walking",
  "Avoid tourist traps",
  "Avoid expensive restaurants",
]);

export const deliverableEnum = z.enum([
  "PDF",
  "Spreadsheet",
  "Packing list",
  "Map pins",
  "Food guide",
  "Booking checklist",
  "Fiverr listing copy",
  "Portfolio image prompts",
]);

export const projectStatusEnum = z.enum([
  "Draft",
  "In progress",
  "Ready to sell",
]);

export const accentEnum = z.enum([
  "sage",
  "terracotta",
  "teal",
  "gold",
  "forest",
]);

export const brandVoiceEnum = z.enum([
  "editorial",
  "premium",
  "friendly",
  "adventurous",
]);

export const pdfThemeEnum = z.enum([
  "beige",
  "sage",
  "terracotta",
  "teal",
  "noir",
]);

/** Convenience: array of literal values for building UI option lists. */
export const enumValues = {
  duration: durationEnum.options,
  travelerType: travelerTypeEnum.options,
  travelStyle: travelStyleEnum.options,
  pace: paceEnum.options,
  budget: budgetEnum.options,
  accommodation: accommodationEnum.options,
  foodPref: foodPrefEnum.options,
  transportPref: transportPrefEnum.options,
  interest: interestEnum.options,
  constraint: constraintEnum.options,
  deliverable: deliverableEnum.options,
  projectStatus: projectStatusEnum.options,
  accent: accentEnum.options,
  brandVoice: brandVoiceEnum.options,
  pdfTheme: pdfThemeEnum.options,
} as const;

export type Duration = z.infer<typeof durationEnum>;
export type TravelerType = z.infer<typeof travelerTypeEnum>;
export type TravelStyle = z.infer<typeof travelStyleEnum>;
export type Pace = z.infer<typeof paceEnum>;
export type Budget = z.infer<typeof budgetEnum>;
export type Accommodation = z.infer<typeof accommodationEnum>;
export type FoodPref = z.infer<typeof foodPrefEnum>;
export type TransportPref = z.infer<typeof transportPrefEnum>;
export type Interest = z.infer<typeof interestEnum>;
export type Constraint = z.infer<typeof constraintEnum>;
export type Deliverable = z.infer<typeof deliverableEnum>;
export type ProjectStatus = z.infer<typeof projectStatusEnum>;
export type Accent = z.infer<typeof accentEnum>;
export type BrandVoice = z.infer<typeof brandVoiceEnum>;
export type PdfTheme = z.infer<typeof pdfThemeEnum>;
