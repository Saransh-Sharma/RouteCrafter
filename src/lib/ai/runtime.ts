import type {
  AiCredentialSource,
  AiImageDefaults,
  AiProviderId,
  AiServerConfig,
  AiTextDefaults,
} from "./types";

export interface AiRunSelection {
  provider: AiProviderId;
  model: string;
  credentialSource: AiCredentialSource | null;
  payer: string;
  available: boolean;
}

export function resolveClientAiRun({
  mode,
  defaults,
  personalKey,
  serverConfig,
}: {
  mode: "text" | "image";
  defaults: AiTextDefaults | AiImageDefaults;
  personalKey: string;
  serverConfig: AiServerConfig | null;
}): AiRunSelection {
  if (personalKey.trim()) {
    return {
      provider: defaults.provider,
      model: defaults.model,
      credentialSource: "personal",
      payer: "Your provider account",
      available: true,
    };
  }

  if (serverConfig?.serverOpenAiAvailable) {
    return {
      provider: "openai",
      model:
        mode === "text"
          ? serverConfig.serverTextModel
          : serverConfig.serverImageModel,
      credentialSource: "server",
      payer: "RouteCrafter",
      available: true,
    };
  }

  return {
    provider: defaults.provider,
    model: defaults.model,
    credentialSource: null,
    payer: "Unavailable",
    available: false,
  };
}
