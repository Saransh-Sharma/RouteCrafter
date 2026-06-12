"use client";

import type { AiImageRequest, AiResult, AiTextRequest } from "./types";

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
  const response = await fetch("/api/ai/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  return parseAiResponse(response);
}

export async function requestAiImage(
  request: AiImageRequest,
  signal?: AbortSignal,
): Promise<AiResult> {
  const response = await fetch("/api/ai/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  return parseAiResponse(response);
}
