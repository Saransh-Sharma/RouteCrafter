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
  | "rewrite";

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
