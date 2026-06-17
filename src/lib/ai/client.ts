"use client";

import type {
  AiImageRequest,
  AiResult,
  AiServerConfig,
  AiTextRequest,
} from "./types";
import { AI_ERROR } from "./errors";

const AI_CLIENT_TIMEOUT_MS = 330_000;

function requestSignalWithTimeout(signal?: AbortSignal): {
  signal: AbortSignal;
  timedOut: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_CLIENT_TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return {
    signal: controller.signal,
    timedOut: () => controller.signal.aborted && !signal?.aborted,
    cleanup: () => clearTimeout(timeout),
  };
}

async function parseAiResponse(response: Response): Promise<AiResult> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body?.error === "string"
        ? body.error
        : "The AI request did not complete. No project content was changed.";
    throw new Error(message);
  }
  return body as AiResult;
}

export async function requestAiText(
  request: AiTextRequest,
  signal?: AbortSignal,
): Promise<AiResult> {
  const timeoutSignal = requestSignalWithTimeout(signal);
  try {
    const response = await fetch("/api/ai/text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: timeoutSignal.signal,
    });
    return parseAiResponse(response);
  } catch (error) {
    if (timeoutSignal.timedOut()) {
      throw new Error(AI_ERROR.PROVIDER_TIMEOUT);
    }
    throw error;
  } finally {
    timeoutSignal.cleanup();
  }
}

export async function requestAiImage(
  request: AiImageRequest,
  signal?: AbortSignal,
): Promise<AiResult> {
  const timeoutSignal = requestSignalWithTimeout(signal);
  try {
    const response = await fetch("/api/ai/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: timeoutSignal.signal,
    });
    return parseAiResponse(response);
  } catch (error) {
    if (timeoutSignal.timedOut()) {
      throw new Error(AI_ERROR.PROVIDER_TIMEOUT);
    }
    throw error;
  } finally {
    timeoutSignal.cleanup();
  }
}

export async function requestAiConfig(): Promise<AiServerConfig> {
  const response = await fetch("/api/ai/config", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error("AI server configuration is unavailable.");
  }
  return (await response.json()) as AiServerConfig;
}
