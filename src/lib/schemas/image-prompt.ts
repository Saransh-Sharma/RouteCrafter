import { z } from "zod";

/** The fixed set of five portfolio image prompts every project generates. */
export const imagePromptKindEnum = z.enum([
  "hero",
  "what-youll-get",
  "sample-itinerary",
  "beyond-the-brochure",
  "built-around-style",
]);

export type ImagePromptKind = z.infer<typeof imagePromptKindEnum>;

export const portfolioImagePromptSchema = z.object({
  id: z.string(),
  kind: imagePromptKindEnum,
  title: z.string(),
  goal: z.string(),
  canvas: z.string(),
  layout: z.string(),
  visualElements: z.string(),
  textOverlay: z.string(),
  style: z.string(),
  negativePrompt: z.string(),
  countryAccuracyNotes: z.string(),
  readabilityNotes: z.string(),
  isFinal: z.boolean().default(false),
});

export type PortfolioImagePrompt = z.infer<typeof portfolioImagePromptSchema>;
