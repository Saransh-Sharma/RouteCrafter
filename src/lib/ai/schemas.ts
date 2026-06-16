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
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxOutputTokens: z.number().int().min(1).max(32000).optional(),
  responseFormat: z.enum(["text", "json"]).optional(),
});

export const aiImageRequestSchema = z.object({
  provider: aiProviderIdSchema,
  apiKey: z.string().min(1).optional(),
  model: z.string().min(1),
  prompt: z.string().min(1),
  taskType: aiTaskTypeSchema,
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
});
