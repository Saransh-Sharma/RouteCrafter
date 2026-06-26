import { z } from "zod";

export const aiProviderIdSchema = z.enum(["openai", "anthropic", "gemini"]);

export const aiTaskTypeSchema = z.enum([
  "brief",
  "prompt",
  "itinerary",
  "matrix",
  "listing",
  "imagePrompt",
  "imageGeneration",
  "guide",
  "rewrite",
  "dayDetails",
]);

export const aiUsageSchema = z.object({
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  images: z.number().optional(),
});

export const aiTextRequestSchema = z.object({
  provider: aiProviderIdSchema,
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1),
  prompt: z.string().min(1),
  system: z.string().optional(),
  taskType: aiTaskTypeSchema,
  projectId: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxOutputTokens: z.number().int().min(1).max(32000).optional(),
  responseFormat: z.enum(["text", "json"]).optional(),
  enableWebSearch: z.boolean().optional(),
});

export const aiImageRequestSchema = z.object({
  provider: aiProviderIdSchema,
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1),
  prompt: z.string().min(1),
  taskType: aiTaskTypeSchema,
  projectId: z.string().min(1).optional(),
  source: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  entityId: z.string().min(1).optional(),
  size: z.string().optional(),
  quality: z.string().optional(),
  aspectRatio: z.string().optional(),
});

export const aiResultSchema = z.object({
  text: z.string().optional(),
  image: z.string().optional(),
  mimeType: z.string().optional(),
  usage: aiUsageSchema.optional(),
  provider: aiProviderIdSchema,
  model: z.string(),
  credentialSource: z.enum(["server", "personal"]),
  citations: z
    .array(z.object({ url: z.string().optional(), title: z.string().optional() }))
    .optional(),
  grounded: z.boolean().optional(),
});
