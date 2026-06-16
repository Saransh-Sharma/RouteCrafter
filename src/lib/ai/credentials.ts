import "server-only";

import type {
  AiCredentialSource,
  AiImageRequest,
  AiProviderId,
  AiServerConfig,
  AiTextRequest,
} from "./types";

export const SERVER_TEXT_MODEL = "gpt-5.4";
export const SERVER_IMAGE_MODEL = "gpt-image-2";

interface CredentialInput {
  provider: AiProviderId;
  apiKey?: string;
  model: string;
}

interface ResolvedCredential {
  provider: AiProviderId;
  apiKey: string;
  model: string;
  credentialSource: AiCredentialSource;
}

export class AiConfigurationError extends Error {
  readonly status = 503;

  constructor(message = "No AI credential is available. Add a personal key or configure OPEN_AI_KEY on the server.") {
    super(message);
    this.name = "AiConfigurationError";
  }
}

function resolveCredential(
  input: CredentialInput,
  serverModel: string,
): ResolvedCredential {
  const personalKey = input.apiKey?.trim();
  if (personalKey) {
    return {
      provider: input.provider,
      apiKey: personalKey,
      model: input.model,
      credentialSource: "personal",
    };
  }

  const serverKey = process.env.OPEN_AI_KEY?.trim();
  if (!serverKey) throw new AiConfigurationError();

  return {
    provider: "openai",
    apiKey: serverKey,
    model: serverModel,
    credentialSource: "server",
  };
}

export function resolveTextCredential(
  input: Pick<AiTextRequest, "provider" | "apiKey" | "model">,
): ResolvedCredential {
  return resolveCredential(input, SERVER_TEXT_MODEL);
}

export function resolveImageCredential(
  input: Pick<AiImageRequest, "provider" | "apiKey" | "model">,
): ResolvedCredential {
  return resolveCredential(input, SERVER_IMAGE_MODEL);
}

export function getPublicAiConfig(): AiServerConfig {
  return {
    serverOpenAiAvailable: Boolean(process.env.OPEN_AI_KEY?.trim()),
    serverTextModel: SERVER_TEXT_MODEL,
    serverImageModel: SERVER_IMAGE_MODEL,
  };
}
