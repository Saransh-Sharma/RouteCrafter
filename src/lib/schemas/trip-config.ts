import { z } from "zod";
import {
  accommodationEnum,
  budgetEnum,
  constraintEnum,
  deliverableEnum,
  durationEnum,
  foodPrefEnum,
  interestEnum,
  paceEnum,
  transportPrefEnum,
  travelStyleEnum,
  travelerTypeEnum,
} from "./enums";

/**
 * The deeply-configurable trip parameters that drive every generated output.
 * Arrays default to empty so the Phase 3 form can start blank and build up.
 */
export const tripConfigurationSchema = z.object({
  id: z.string(),
  label: z.string().default("Primary configuration"),

  // Basics
  cities: z.array(z.string()).default([]),
  duration: durationEnum.default("7 days"),
  customDays: z.number().int().positive().optional(),

  // Travelers & style
  travelerType: travelerTypeEnum.default("Couple"),
  travelStyles: z.array(travelStyleEnum).default([]),

  // Pace & budget
  pace: paceEnum.default("Balanced"),
  budget: budgetEnum.default("Mid-range"),

  // Preferences
  accommodation: z.array(accommodationEnum).default([]),
  food: z.array(foodPrefEnum).default([]),
  transport: z.array(transportPrefEnum).default([]),

  // Interests & constraints
  interests: z.array(interestEnum).default([]),
  constraints: z.array(constraintEnum).default([]),

  // Logistics
  seasonMonth: z.string().default(""),
  arrivalCity: z.string().default(""),
  departureCity: z.string().default(""),
  arrivalTime: z.string().default(""),
  departureTime: z.string().default(""),

  // Personalization
  mustSee: z.array(z.string()).default([]),
  avoid: z.array(z.string()).default([]),
  specialOccasion: z.string().default(""),

  // Output
  deliverables: z.array(deliverableEnum).default([]),

  updatedAt: z.string(),
});

export type TripConfiguration = z.infer<typeof tripConfigurationSchema>;

/** Build an empty configuration with sensible defaults. */
export function createEmptyTripConfig(
  overrides: Partial<TripConfiguration> = {},
): TripConfiguration {
  const now = new Date().toISOString();
  return tripConfigurationSchema.parse({
    id: crypto.randomUUID(),
    updatedAt: now,
    ...overrides,
  });
}
