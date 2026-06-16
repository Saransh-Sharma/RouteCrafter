import "server-only";

import type {
  AiResult,
  AiUsage,
  ResolvedAiImageRequest,
  ResolvedAiTextRequest,
} from "./types";
import { providerSupports } from "./providers";

type JsonRecord = Record<string, unknown>;

interface ProviderErrorBody {
  error?: { message?: string; type?: string; code?: string } | string;
  message?: string;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function usageFromOpenAI(usage: unknown): AiUsage | undefined {
  const data = asRecord(usage);
  if (!Object.keys(data).length) return undefined;
  return {
    inputTokens:
      numberValue(data.input_tokens) ?? numberValue(data.prompt_tokens),
    outputTokens:
      numberValue(data.output_tokens) ?? numberValue(data.completion_tokens),
    totalTokens: numberValue(data.total_tokens),
  };
}

function usageFromAnthropic(usage: unknown): AiUsage | undefined {
  const data = asRecord(usage);
  if (!Object.keys(data).length) return undefined;
  const inputTokens = numberValue(data.input_tokens);
  const outputTokens = numberValue(data.output_tokens);
  return {
    inputTokens,
    outputTokens,
    totalTokens:
      typeof inputTokens === "number" && typeof outputTokens === "number"
        ? inputTokens + outputTokens
        : undefined,
  };
}

function usageFromGemini(usage: unknown): AiUsage | undefined {
  const data = asRecord(usage);
  if (!Object.keys(data).length) return undefined;
  return {
    inputTokens: numberValue(data.promptTokenCount),
    outputTokens: numberValue(data.candidatesTokenCount),
    totalTokens: numberValue(data.totalTokenCount),
  };
}

async function readError(response: Response): Promise<string> {
  const body = (await response.json().catch(() => null)) as ProviderErrorBody | null;
  const raw =
    typeof body?.error === "string"
      ? body.error
      : body?.error?.message ?? body?.message ?? response.statusText;
  if (response.status === 401 || response.status === 403) {
    return "Provider authentication failed.";
  }
  if (response.status === 429) {
    return "Provider rate limit reached. Wait or switch models.";
  }
  if (response.status >= 500) {
    return "The provider is temporarily unavailable. No project content was changed.";
  }
  return raw || "The provider rejected this request.";
}

function extractOpenAiText(data: unknown): string {
  const record = asRecord(data);
  const outputText = stringValue(record.output_text);
  if (outputText) return outputText;
  const chunks = asArray(record.output)
    .flatMap((item) => asArray(asRecord(item).content))
    .map((content) => stringValue(asRecord(content).text))
    .filter((text): text is string => Boolean(text));
  return chunks.join("\n").trim();
}

function extractAnthropicText(data: unknown): string {
  return asArray(asRecord(data).content)
    .map((block) => {
      const record = asRecord(block);
      return record.type === "text" ? stringValue(record.text) ?? "" : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function geminiParts(data: unknown): unknown[] {
  const firstCandidate = asArray(asRecord(data).candidates)[0];
  return asArray(asRecord(asRecord(firstCandidate).content).parts);
}

function extractGeminiText(data: unknown): string {
  return geminiParts(data)
    .map((part) => stringValue(asRecord(part).text) ?? "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function cleanJsonText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export function normalizeProviderError(error: unknown): string {
  if (error instanceof Error && error.name === "AbortError") {
    return "The request was cancelled. No project content was changed.";
  }
  if (error instanceof Error) return error.message;
  return "The AI request did not complete. No project content was changed.";
}

export async function generateText(
  request: ResolvedAiTextRequest,
): Promise<AiResult> {
  if (!providerSupports(request.provider, "text")) {
    throw new Error("This provider does not support text generation here.");
  }
  switch (request.provider) {
    case "openai":
      return generateOpenAiText(request);
    case "anthropic":
      return generateAnthropicText(request);
    case "gemini":
      return generateGeminiText(request);
  }
}

export async function generateImage(
  request: ResolvedAiImageRequest,
): Promise<AiResult> {
  if (!providerSupports(request.provider, "image")) {
    throw new Error("This provider does not support image generation here.");
  }
  switch (request.provider) {
    case "openai":
      return generateOpenAiImage(request);
    case "gemini":
      return generateGeminiImage(request);
    case "anthropic":
      throw new Error("This provider does not support image generation here.");
  }
}

async function generateOpenAiText(
  request: ResolvedAiTextRequest,
): Promise<AiResult> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      input: [
        request.system
          ? { role: "system", content: request.system }
          : undefined,
        { role: "user", content: request.prompt },
      ].filter(Boolean),
      temperature: request.temperature,
      top_p: request.topP,
      max_output_tokens: request.maxOutputTokens,
      text:
        request.responseFormat === "json"
          ? { format: { type: "json_object" } }
          : undefined,
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const data: unknown = await response.json();
  const record = asRecord(data);
  return {
    provider: "openai",
    model: request.model,
    credentialSource: request.credentialSource,
    text: cleanJsonText(extractOpenAiText(data)),
    usage: usageFromOpenAI(record.usage),
  };
}

async function generateAnthropicText(
  request: ResolvedAiTextRequest,
): Promise<AiResult> {
  const isLateOpus = /^claude-opus-4-[78]/.test(request.model);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": request.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: request.maxOutputTokens ?? 4000,
      system:
        request.responseFormat === "json"
          ? `${request.system ?? ""}\nReturn only valid JSON. Do not wrap it in Markdown.`
          : request.system,
      messages: [{ role: "user", content: request.prompt }],
      temperature: isLateOpus ? undefined : request.temperature,
      top_p: isLateOpus ? undefined : request.topP,
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const data: unknown = await response.json();
  const record = asRecord(data);
  return {
    provider: "anthropic",
    model: request.model,
    credentialSource: request.credentialSource,
    text: cleanJsonText(extractAnthropicText(data)),
    usage: usageFromAnthropic(record.usage),
  };
}

async function generateGeminiText(
  request: ResolvedAiTextRequest,
): Promise<AiResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      request.model,
    )}:generateContent?key=${encodeURIComponent(request.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: request.system
          ? { parts: [{ text: request.system }] }
          : undefined,
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: {
          temperature: request.temperature,
          topP: request.topP,
          maxOutputTokens: request.maxOutputTokens,
          responseMimeType:
            request.responseFormat === "json" ? "application/json" : undefined,
        },
      }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  const data: unknown = await response.json();
  const record = asRecord(data);
  return {
    provider: "gemini",
    model: request.model,
    credentialSource: request.credentialSource,
    text: cleanJsonText(extractGeminiText(data)),
    usage: usageFromGemini(record.usageMetadata),
  };
}

async function generateOpenAiImage(
  request: ResolvedAiImageRequest,
): Promise<AiResult> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${request.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      prompt: request.prompt,
      size: request.size || "1024x1024",
      quality: request.quality || "medium",
      n: 1,
    }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const data: unknown = await response.json();
  const item = asRecord(asArray(asRecord(data).data)[0]);
  const base64 = stringValue(item.b64_json);
  const url = stringValue(item.url);
  const image = base64 ? `data:image/png;base64,${base64}` : url;
  if (!image) throw new Error("The provider returned no image.");
  return {
    provider: "openai",
    model: request.model,
    credentialSource: request.credentialSource,
    image,
    mimeType: base64 ? "image/png" : undefined,
    usage: { images: 1 },
  };
}

async function generateGeminiImage(
  request: ResolvedAiImageRequest,
): Promise<AiResult> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      request.model,
    )}:generateContent?key=${encodeURIComponent(request.apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        generationConfig: {
          responseModalities: ["IMAGE", "TEXT"],
        },
      }),
    },
  );
  if (!response.ok) throw new Error(await readError(response));
  const data: unknown = await response.json();
  const record = asRecord(data);
  const part = geminiParts(data).find(
    (candidate) => Boolean(asRecord(asRecord(candidate).inlineData).data),
  );
  const inlineData = asRecord(asRecord(part).inlineData);
  const base64 = stringValue(inlineData.data);
  if (!base64) throw new Error("The provider returned no image.");
  const mimeType = stringValue(inlineData.mimeType) ?? "image/png";
  return {
    provider: "gemini",
    model: request.model,
    credentialSource: request.credentialSource,
    image: `data:${mimeType};base64,${base64}`,
    mimeType,
    usage: { ...usageFromGemini(record.usageMetadata), images: 1 },
  };
}
