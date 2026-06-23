"use client";

import type {
  AiImageRequest,
  AiResult,
  AiServerConfig,
  AiStreamEvent,
  AiTextRequest,
} from "./types";
import { AI_ERROR, normalizeThrownError } from "./errors";

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

function normalizeClientFetchError(
  error: unknown,
  timedOut: () => boolean,
): Error {
  if (timedOut()) {
    return new Error(AI_ERROR.PROVIDER_TIMEOUT);
  }
  return new Error(normalizeThrownError(error));
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
    throw normalizeClientFetchError(error, timeoutSignal.timedOut);
  } finally {
    timeoutSignal.cleanup();
  }
}

export async function streamAiText(
  request: AiTextRequest,
  {
    signal,
    onEvent,
    onToken,
  }: {
    signal?: AbortSignal;
    onEvent?: (event: AiStreamEvent) => void;
    onToken?: (token: string) => void;
  } = {},
): Promise<AiResult> {
  const timeoutSignal = requestSignalWithTimeout(signal);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    const response = await fetch("/api/ai/text/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal: timeoutSignal.signal,
    });
    if (!response.ok && !response.body) return parseAiResponse(response);
    if (!response.body) {
      throw new Error("The AI stream did not return a readable response.");
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResult: AiResult | null = null;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const eventName = raw
          .split(/\r?\n/)
          .find((line) => line.startsWith("event:"))
          ?.slice("event:".length)
          .trim();
        const dataText = raw
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice("data:".length).trim())
          .join("\n");
        const data = dataText ? JSON.parse(dataText) : {};
        if (eventName === "phase") {
          onEvent?.({ type: "phase", phase: data.phase });
        } else if (eventName === "delta") {
          const text = String(data.text ?? "");
          onToken?.(text);
          onEvent?.({ type: "delta", text });
        } else if (eventName === "result") {
          finalResult = data as AiResult;
          onEvent?.({ type: "result", result: finalResult });
        } else if (eventName === "error") {
          const message =
            typeof data.error === "string"
              ? data.error
              : "The AI stream did not complete.";
          onEvent?.({ type: "error", error: message });
          throw new Error(message);
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
    if (!finalResult) {
      throw new Error("The AI stream ended without a final result.");
    }
    return finalResult;
  } catch (error) {
    throw normalizeClientFetchError(error, timeoutSignal.timedOut);
  } finally {
    await reader?.cancel().catch(() => undefined);
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
    throw normalizeClientFetchError(error, timeoutSignal.timedOut);
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
