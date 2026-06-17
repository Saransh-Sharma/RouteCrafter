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

export const plannedEditionSchema = z.object({
  id: z.string(),
  duration: durationEnum,
  customDays: z.number().int().positive().max(60).optional(),
  travelerType: travelerTypeEnum,
  cities: z.array(z.string()).default([]),
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
export type PlannedEdition = z.infer<typeof plannedEditionSchema>;
export type PublishReview = z.infer<typeof publishReviewSchema>;
export type ProductionPlan = z.infer<typeof productionPlanSchema>;

export const productionPlanValues = {
  offerModel: offerModelEnum.options,
  salesChannel: salesChannelEnum.options,
  outputRequirement: outputRequirementEnum.options,
} as const;
