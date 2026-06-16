import { z } from "zod";

export const aiAcceptedRunSchema = z.object({
  id: z.string(),
  provider: z.enum(["openai", "anthropic", "gemini"]),
  model: z.string(),
  taskType: z.enum([
    "brief",
    "prompt",
    "itinerary",
    "matrix",
    "listing",
    "imagePrompt",
    "imageGeneration",
    "guide",
    "rewrite",
  ]),
  label: z.string(),
  createdAt: z.string(),
  appliedAt: z.string(),
  usage: z
    .object({
      inputTokens: z.number().optional(),
      outputTokens: z.number().optional(),
      totalTokens: z.number().optional(),
      images: z.number().optional(),
    })
    .optional(),
  source: z.string().optional(),
  credentialSource: z.enum(["server", "personal"]).optional(),
});

export type AiAcceptedRun = z.infer<typeof aiAcceptedRunSchema>;
