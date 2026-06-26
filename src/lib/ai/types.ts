export type AiProviderId = "openai" | "anthropic" | "gemini";
export type AiCredentialSource = "server" | "personal";

export type AiTaskType =
  | "brief"
  | "prompt"
  | "itinerary"
  | "matrix"
  | "listing"
  | "imagePrompt"
  | "imageGeneration"
  | "guide"
  | "rewrite"
  | "dayDetails";

export type AiStreamEvent =
  | { type: "phase"; phase: "preparing" | "calling-provider" | "validating" }
  | { type: "delta"; text: string }
  | { type: "result"; result: AiResult }
  | { type: "error"; error: string };

export type AiFieldReviewChoice = "keep" | "use-ai" | "merge";

/** User-tunable levers applied to a structured itinerary draft/regeneration. */
export interface ItineraryDraftOverrides {
  style?: string;
  budget?: string;
  pace?: string;
}

/**
 * Progress emitted while a structured itinerary is drafted across a series of
 * AI calls (one overview call plus one call per chunk of days). The runner upserts
 * these by `id` to drive a live checklist.
 */
export interface DraftProgress {
  id: string;
  kind: "overview" | "days";
  label: string;
  /** Inclusive [first, last] day numbers for day chunks. */
  dayRange?: [number, number];
  status: "start" | "done";
  usage?: AiUsage;
}

/** Optional steering + progress context threaded through a custom requestText. */
export interface AiRequestContext {
  instructions?: string;
  overrides?: ItineraryDraftOverrides;
  onProgress?: (progress: DraftProgress) => void;
}

export interface BatchRunStep {
  id: string;
  label: string;
  taskType: AiTaskType;
  status: "pending" | "running" | "completed" | "error" | "cancelled";
  costLabel?: string;
  error?: string;
}

export interface BatchRunPlan {
  id: string;
  label: string;
  steps: BatchRunStep[];
  estimatedCostLabel?: string;
}

export interface AiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  images?: number;
}

export interface AiTextRequest {
  provider: AiProviderId;
  apiKey?: string;
  model: string;
  prompt: string;
  system?: string;
  taskType: AiTaskType;
  projectId?: string;
  source?: string;
  label?: string;
  entityId?: string;
  temperature?: number;
  topP?: number;
  maxOutputTokens?: number;
  responseFormat?: "text" | "json";
  /** Ground the response in live web search (OpenAI Responses `web_search`). */
  enableWebSearch?: boolean;
}

export interface AiImageRequest {
  provider: AiProviderId;
  apiKey?: string;
  model: string;
  prompt: string;
  taskType: AiTaskType;
  projectId?: string;
  source?: string;
  label?: string;
  entityId?: string;
  size?: string;
  quality?: string;
  aspectRatio?: string;
}

export interface AiCitation {
  url?: string;
  title?: string;
}

export interface AiResult {
  text?: string;
  image?: string;
  mimeType?: string;
  usage?: AiUsage;
  provider: AiProviderId;
  model: string;
  credentialSource: AiCredentialSource;
  aiRunId?: string;
  aiRunIds?: string[];
  providerAttempts?: number;
  /** Sources the model grounded its answer in, when web search was enabled. */
  citations?: AiCitation[];
  /**
   * True when a web-search-enabled run actually performed a search (detected
   * from a `web_search_call` in the provider output). Undefined when web search
   * was not requested.
   */
  grounded?: boolean;
}

export interface ResolvedAiTextRequest extends AiTextRequest {
  apiKey: string;
  credentialSource: AiCredentialSource;
}

export interface ResolvedAiImageRequest extends AiImageRequest {
  apiKey: string;
  credentialSource: AiCredentialSource;
}

export interface AiServerConfig {
  serverOpenAiAvailable: boolean;
  serverTextModel: string;
  serverImageModel: string;
}

export interface AiCostEstimate {
  currency: "USD";
  lowUsd: number;
  highUsd: number;
  basis: string;
  inputTokensLow?: number;
  inputTokensHigh?: number;
  outputTokensLow?: number;
  outputTokensHigh?: number;
}

export interface AiProviderCapability {
  text: boolean;
  image: boolean;
  structuredJson: boolean;
}

export interface AiProviderInfo {
  id: AiProviderId;
  label: string;
  keyPlaceholder: string;
  docsUrl: string;
  capabilities: AiProviderCapability;
  textModels: string[];
  imageModels: string[];
  defaultTextModel: string;
  defaultImageModel: string;
}

export interface AiProviderSettings {
  apiKey: string;
  customTextModel: string;
  customImageModel: string;
  lastTestedAt?: string;
  lastTestStatus?: "ok" | "error";
  lastTestMessage?: string;
}

export interface AiTextDefaults {
  provider: AiProviderId;
  model: string;
  temperature: number;
  topP: number;
  maxOutputTokens: number;
}

export interface AiImageDefaults {
  provider: AiProviderId;
  model: string;
  size: string;
  quality: string;
  aspectRatio: string;
}

export interface AiAcceptedRun {
  id: string;
  aiRunId?: string;
  provider: AiProviderId;
  model: string;
  taskType: AiTaskType;
  label: string;
  createdAt: string;
  appliedAt: string;
  usage?: AiUsage;
  source?: string;
  credentialSource?: AiCredentialSource;
}
