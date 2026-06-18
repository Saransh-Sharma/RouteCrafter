import { z } from "zod";
import { durationEnum, travelerTypeEnum } from "./enums";

export const offerModelEnum = z.enum(["digital", "service", "hybrid"]);

export const salesChannelEnum = z.enum([
  "fiverr",
  "etsy",
  "gumroad",
  "direct",
]);

export const outputRequirementEnum = z.enum([
  "marketplace-listing",
  "pdf",
  "spreadsheet",
  "packing-list",
  "food-guide",
  "booking-checklist",
  "portfolio-visuals",
  "map-pins-legacy",
]);

/** How a traveler reaches a stop from the previous one. Extensible. */
export const transportModeEnum = z.enum([
  "flight",
  "train",
  "bus",
  "cab",
  "boat",
  "walk",
]);

/** One stop on an edition's route: a city and the nights spent there. */
export const routeStopSchema = z.object({
  id: z.string(),
  city: z.string().trim().min(1),
  nights: z.number().int().min(0).max(60).default(1),
  /** Transport used to ARRIVE here from the previous stop. Omit on the first stop. */
  arriveBy: transportModeEnum.optional(),
});

export const plannedEditionSchema = z.object({
  id: z.string(),
  duration: durationEnum,
  customDays: z.number().int().positive().max(60).optional(),
  travelerType: travelerTypeEnum,
  cities: z.array(z.string()).default([]),
  /** Ordered, time-aware route. Empty for legacy editions (lazily seeded). */
  route: z.array(routeStopSchema).default([]),
  itineraryId: z.string().optional(),
  createdAt: z.string(),
});

export const publishReviewSchema = z.object({
  liveDataVerified: z.boolean().default(false),
  presentationReviewed: z.boolean().default(false),
  backupConfirmed: z.boolean().default(false),
  confirmedAt: z.string().optional(),
});

export const productionPlanSchema = z.object({
  offerModel: offerModelEnum.default("digital"),
  channels: z.array(salesChannelEnum).default(["etsy"]),
  outputs: z
    .array(outputRequirementEnum)
    .default(["marketplace-listing", "pdf"]),
  editions: z.array(plannedEditionSchema).default([]),
  review: publishReviewSchema.default(publishReviewSchema.parse({})),
});

export type OfferModel = z.infer<typeof offerModelEnum>;
export type SalesChannel = z.infer<typeof salesChannelEnum>;
export type OutputRequirement = z.infer<typeof outputRequirementEnum>;
export type TransportMode = z.infer<typeof transportModeEnum>;
export type RouteStop = z.infer<typeof routeStopSchema>;
export type PlannedEdition = z.infer<typeof plannedEditionSchema>;

/**
 * Display + prose metadata per transport mode. No React here (used by the
 * generation engine for route summaries); icon mapping lives in the UI layer.
 */
export const TRANSPORT_META: Record<
  TransportMode,
  { label: string; verb: string; line: "dashed" | "solid" }
> = {
  flight: { label: "Flight", verb: "fly", line: "dashed" },
  train: { label: "Train", verb: "take the train", line: "solid" },
  bus: { label: "Bus", verb: "take the bus", line: "solid" },
  cab: { label: "Cab", verb: "drive", line: "solid" },
  boat: { label: "Boat", verb: "sail", line: "solid" },
  walk: { label: "Walk", verb: "walk", line: "solid" },
};
export type PublishReview = z.infer<typeof publishReviewSchema>;
export type ProductionPlan = z.infer<typeof productionPlanSchema>;

export const productionPlanValues = {
  offerModel: offerModelEnum.options,
  salesChannel: salesChannelEnum.options,
  outputRequirement: outputRequirementEnum.options,
} as const;
