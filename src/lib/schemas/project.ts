import { z } from "zod";
import {
  accentEnum,
  brandVoiceEnum,
  deliverableEnum,
  durationEnum,
  projectStatusEnum,
  travelStyleEnum,
  travelerTypeEnum,
} from "./enums";
import { tripConfigurationSchema } from "./trip-config";
import { portfolioImagePromptSchema } from "./image-prompt";
import { itineraryOutputSchema, itineraryMatrixSchema } from "./itinerary";
import { marketplaceListingSchema } from "./listing";
import { aiAcceptedRunSchema } from "./ai";
import { productionPlanSchema } from "./production-plan";

export const CURRENT_SCHEMA_VERSION = 3;

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

export const projectSchema = z.object({
  id: z.string(),
  schemaVersion: z.number().int().default(CURRENT_SCHEMA_VERSION),

  name: z.string().min(1),
  country: z.string().default(""),
  regions: z.array(z.string()).default([]),
  positioning: z.string().default(""),
  targetAudience: z.string().default(""),

  travelStyles: z.array(travelStyleEnum).default([]),
  travelerTypes: z.array(travelerTypeEnum).default([]),
  durations: z.array(durationEnum).default([]),
  deliverables: z.array(deliverableEnum).default([]),

  brandStyle: brandStyleSchema.default(brandStyleSchema.parse({})),
  productionPlan: productionPlanSchema.default(productionPlanSchema.parse({})),

  // Generated artifacts (filled in by later phases)
  tripConfigs: z.array(tripConfigurationSchema).default([]),
  imagePrompts: z.array(portfolioImagePromptSchema).default([]),
  matrix: itineraryMatrixSchema.optional(),
  itineraries: z.array(itineraryOutputSchema).default([]),
  listing: marketplaceListingSchema.optional(),
  /** Raw generated prompt text keyed by template id. */
  generated: z.record(z.string(), z.string()).default({}),
  /** Accepted billable AI outputs, without API keys or prompt payloads. */
  aiRuns: z.array(aiAcceptedRunSchema).default([]),

  status: projectStatusEnum.default("Draft"),
  accent: accentEnum.default("sage"),

  createdAt: z.string(),
  updatedAt: z.string(),
});

export type Project = z.infer<typeof projectSchema>;
