import { z } from "zod";
import {
  accentEnum,
  durationEnum,
  pdfThemeEnum,
  travelerTypeEnum,
  travelStyleEnum,
} from "./enums";
import { brandStyleSchema } from "./project";
import { tripConfigurationSchema } from "./trip-config";
import { productionPlanSchema } from "./production-plan";

export const templateCategorySchema = z.enum([
  "traveler-preset",
  "country-starter",
  "my-template",
]);

export const templateProjectSkeletonSchema = z.object({
  country: z.string().default(""),
  regions: z.array(z.string()).default([]),
  positioning: z.string().default(""),
  targetAudience: z.string().default(""),
  travelStyles: z.array(travelStyleEnum).default([]),
  travelerTypes: z.array(travelerTypeEnum).default([]),
  durations: z.array(durationEnum).default([]),
  brandStyle: brandStyleSchema.default(brandStyleSchema.parse({})),
  productionPlan: productionPlanSchema.default(productionPlanSchema.parse({})),
  tripConfigs: z.array(tripConfigurationSchema).default([]),
  pdfTheme: pdfThemeEnum.default("beige"),
  promptTweaks: z.record(z.string(), z.string()).default({}),
});

export const templateSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1),
  description: z.string().default(""),
  category: templateCategorySchema.default("my-template"),
  accent: accentEnum.default("sage"),
  project: templateProjectSkeletonSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TemplateCategory = z.infer<typeof templateCategorySchema>;
export type TemplateProjectSkeleton = z.infer<
  typeof templateProjectSkeletonSchema
>;
export type Template = z.infer<typeof templateSchema>;
