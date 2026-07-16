import { z } from "zod";
import { accentEnum, brandVoiceEnum, projectStatusEnum } from "./enums";
import { tripConfigurationSchema } from "./trip-config";
import { portfolioImagePromptSchema } from "./image-prompt";
import { itineraryOutputSchema } from "./itinerary";
import { marketplaceListingSchema } from "./listing";
import { aiAcceptedRunSchema } from "./ai";
import { productionPlanSchema } from "./production-plan";

export const CURRENT_SCHEMA_VERSION = 5;

export const brandStyleSchema = z.object({
  businessName: z.string().default(""),
  voice: brandVoiceEnum.default("editorial"),
  footerDisclaimer: z
    .string()
    .default(
      "Live opening hours, prices, tickets, and availability should be verified before travel.",
    ),
});

export type BrandStyle = z.infer<typeof brandStyleSchema>;

/**
 * Membership in a Series — a family of country versions of one product.
 * The original and its AI-transposed variants all share a seriesId; each
 * member remains an independently editable, sellable project.
 */
export const seriesLinkSchema = z.object({
  seriesId: z.string(),
  seriesName: z.string().default(""),
  role: z.enum(["original", "variant"]).default("variant"),
  /** The product this one was transposed from (variants only). */
  sourceProductId: z.string().optional(),
  addedAt: z.string(),
});

export type SeriesLink = z.infer<typeof seriesLinkSchema>;

export const projectSchema = z.object({
  id: z.string(),
  schemaVersion: z.number().int().default(CURRENT_SCHEMA_VERSION),

  name: z.string().min(1),
  country: z.string().default(""),
  regions: z.array(z.string()).default([]),
  positioning: z.string().default(""),
  targetAudience: z.string().default(""),

  brandStyle: brandStyleSchema.default(brandStyleSchema.parse({})),
  productionPlan: productionPlanSchema.default(productionPlanSchema.parse({})),

  /** Shelf/cover image; falls back to itineraries[0].coverImage in the UI. */
  coverImage: z.string().default(""),
  series: seriesLinkSchema.optional(),

  // Generated artifacts
  tripConfigs: z.array(tripConfigurationSchema).default([]),
  imagePrompts: z.array(portfolioImagePromptSchema).default([]),
  itineraries: z.array(itineraryOutputSchema).default([]),
  listing: marketplaceListingSchema.optional(),
  /** Accepted billable AI outputs, without API keys or prompt payloads. */
  aiRuns: z.array(aiAcceptedRunSchema).default([]),

  status: projectStatusEnum.default("Draft"),
  accent: accentEnum.default("sage"),
  sourceTemplateId: z.string().optional(),
  sourceTemplateName: z.string().optional(),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof projectSchema>;
