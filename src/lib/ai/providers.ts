import type { AiProviderId, AiProviderInfo } from "./types";

export const AI_PROVIDERS: Record<AiProviderId, AiProviderInfo> = {
  openai: {
    id: "openai",
    label: "OpenAI",
    keyPlaceholder: "sk-...",
    docsUrl: "https://platform.openai.com/docs",
    capabilities: { text: true, image: true, structuredJson: true },
    textModels: ["gpt-5.4", "gpt-5.2", "gpt-5.1", "gpt-4.1"],
    imageModels: ["gpt-image-2", "gpt-image-1"],
    defaultTextModel: "gpt-5.4",
    defaultImageModel: "gpt-image-2",
  },
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    keyPlaceholder: "sk-ant-...",
    docsUrl: "https://docs.anthropic.com/en/api/messages",
    capabilities: { text: true, image: false, structuredJson: true },
    textModels: ["claude-sonnet-4-6", "claude-opus-4-8", "claude-haiku-4-5"],
    imageModels: [],
    defaultTextModel: "claude-sonnet-4-6",
    defaultImageModel: "",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    keyPlaceholder: "AIza...",
    docsUrl: "https://ai.google.dev/gemini-api/docs",
    capabilities: { text: true, image: true, structuredJson: true },
    textModels: ["gemini-3.5-flash", "gemini-3.1-pro", "gemini-3-flash"],
    imageModels: ["gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"],
    defaultTextModel: "gemini-3.5-flash",
    defaultImageModel: "gemini-3.1-flash-image",
  },
};

export const AI_PROVIDER_IDS = Object.keys(AI_PROVIDERS) as AiProviderId[];

export function providerLabel(provider: AiProviderId): string {
  return AI_PROVIDERS[provider].label;
}

export function providerSupports(
  provider: AiProviderId,
  capability: keyof AiProviderInfo["capabilities"],
): boolean {
  return AI_PROVIDERS[provider].capabilities[capability];
}

export function resolveTextModel(provider: AiProviderId, selected: string): string {
  return selected || AI_PROVIDERS[provider].defaultTextModel;
}

export function resolveImageModel(provider: AiProviderId, selected: string): string {
  return selected || AI_PROVIDERS[provider].defaultImageModel;
}
