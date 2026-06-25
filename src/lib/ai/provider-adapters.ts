import "server-only";

import {
  AI_ERROR,
  isRetryableHttpStatus,
  isRetryableThrownError,
  normalizeThrownError,
  providerErrorFromStatus,
} from "./errors";
import type {
  AiCitation,
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

export interface ProviderFetchMeta {
  attempts: number;
  lastStatus?: number;
}

interface ProviderFetchResult {
  response: Response;
  meta: ProviderFetchMeta;
}

type StreamTextEvent =
  | { type: "delta"; text: string }
  | { type: "result"; result: AiResult };

type SafeJsonResult =
  | { ok: true; value: unknown }
  | { ok: false; error: Error };

const DEFAULT_PROVIDER_TIMEOUT_MS = 90_000;
const PROVIDER_MAX_ATTEMPTS = 3;
const PROVIDER_RETRY_BASE_DELAY_MS = 1_000;

function resolveProviderTimeoutMs(kind: "text" | "image"): number {
  const imageOverride = Number(process.env.AI_IMAGE_PROVIDER_TIMEOUT_MS);
  const sharedOverride = Number(process.env.AI_PROVIDER_TIMEOUT_MS);
  if (kind === "image" && imageOverride > 0) return imageOverride;
  if (sharedOverride > 0) return sharedOverride;
  return DEFAULT_PROVIDER_TIMEOUT_MS;
}

function retryDelayMs(attempt: number): number {
  const exponential = PROVIDER_RETRY_BASE_DELAY_MS * 2 ** attempt;
  const jitter = Math.floor(Math.random() * 250);
  return exponential + jitter;
}

function attachProviderAttempts(error: unknown, attempts: number): never {
  if (error instanceof Error) {
    (error as Error & { providerAttempts?: number }).providerAttempts = attempts;
    throw error;
  }
  const wrapped = new Error(AI_ERROR.DID_NOT_COMPLETE);
  (wrapped as Error & { providerAttempts?: number }).providerAttempts = attempts;
  throw wrapped;
}

function withProviderAttempts(error: Error, attempts: number): Error {
  (error as Error & { providerAttempts?: number }).providerAttempts = attempts;
  return error;
}

function redactProviderUrl(input: string): string {
  return input.replace(/key=[^&]+/i, "key=redacted");
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function providerFetch(
  input: string,
  init: RequestInit,
  signal?: AbortSignal,
  timeoutMs = resolveProviderTimeoutMs("text"),
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromRequest = () => controller.abort(signal?.reason);
  if (signal?.aborted) abortFromRequest();
  else signal?.addEventListener("abort", abortFromRequest, { once: true });
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    if (controller.signal.aborted) {
      throw new Error(AI_ERROR.PROVIDER_TIMEOUT);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromRequest);
  }
}

async function providerFetchWithRetry(
  input: string,
  init: RequestInit,
  signal?: AbortSignal,
  kind: "text" | "image" = "text",
): Promise<ProviderFetchResult> {
  let lastError: unknown;
  let lastStatus: number | undefined;
  const timeoutMs = resolveProviderTimeoutMs(kind);

  for (let attempt = 0; attempt < PROVIDER_MAX_ATTEMPTS; attempt += 1) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      const response = await providerFetch(input, init, signal, timeoutMs);
      if (response.ok || !isRetryableHttpStatus(response.status)) {
        return {
          response,
          meta: { attempts: attempt + 1, lastStatus: response.status },
        };
      }
      lastStatus = response.status;
      lastError = new Error(await readError(response));
      console.warn("[ai-provider-retry]", {
        url: redactProviderUrl(input),
        attempt: attempt + 1,
        status: response.status,
        error: lastError instanceof Error ? lastError.message : "unknown",
      });
    } catch (error) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      if (!isRetryableThrownError(error) || attempt === PROVIDER_MAX_ATTEMPTS - 1) {
        attachProviderAttempts(error, attempt + 1);
      }
      lastError = error;
      console.warn("[ai-provider-retry]", {
        url: redactProviderUrl(input),
        attempt: attempt + 1,
        status: lastStatus,
        error: error instanceof Error ? error.message : "unknown",
      });
    }

    if (attempt < PROVIDER_MAX_ATTEMPTS - 1) {
      await sleep(retryDelayMs(attempt), signal);
    }
  }

  if (lastError instanceof Error) {
    attachProviderAttempts(lastError, PROVIDER_MAX_ATTEMPTS);
  }
  attachProviderAttempts(
    new Error(AI_ERROR.DID_NOT_COMPLETE),
    PROVIDER_MAX_ATTEMPTS,
  );
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
  return providerErrorFromStatus(response.status, raw);
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

/**
 * Collect deduped web-search citations from an OpenAI Responses payload. Each
 * message content block may carry `annotations` of type `url_citation` with a
 * `url`/`title` the model grounded a claim in.
 */
function extractOpenAiCitations(data: unknown): AiCitation[] {
  const seen = new Set<string>();
  const citations: AiCitation[] = [];
  for (const item of asArray(asRecord(data).output)) {
    for (const content of asArray(asRecord(item).content)) {
      for (const annotation of asArray(asRecord(content).annotations)) {
        const record = asRecord(annotation);
        if (record.type !== "url_citation") continue;
        const url = stringValue(record.url);
        const title = stringValue(record.title);
        const key = url ?? title;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        citations.push({ url, title });
      }
    }
  }
  return citations;
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

function truncationError(): Error {
  return new Error(
    "The model stopped before finishing the JSON response. Try again with a shorter itinerary or a higher output-token limit.",
  );
}

function incompleteStreamError(): Error {
  return new Error("Provider stream ended before completion.");
}

function throwIfOpenAiTruncated(data: JsonRecord): void {
  const incomplete = asRecord(data.incomplete_details);
  if (
    data.status === "incomplete" ||
    incomplete.reason === "max_output_tokens" ||
    incomplete.reason === "max_tokens"
  ) {
    throw truncationError();
  }
}

function throwIfAnthropicTruncated(data: JsonRecord): void {
  if (data.stop_reason === "max_tokens") throw truncationError();
}

function throwIfGeminiTruncated(data: JsonRecord): void {
  const candidate = asRecord(asArray(data.candidates)[0]);
  if (candidate.finishReason === "MAX_TOKENS") throw truncationError();
}

function throwIfJsonLooksTruncated(text: string, request: ResolvedAiTextRequest): void {
  if (request.responseFormat !== "json") return;
  const last = text.trim().at(-1);
  if (last && last !== "}" && last !== "]") throw truncationError();
}

export function normalizeProviderError(error: unknown): string {
  return normalizeThrownError(error);
}

export function readProviderAttempts(error: unknown): number | undefined {
  if (error && typeof error === "object" && "providerAttempts" in error) {
    const attempts = (error as { providerAttempts?: unknown }).providerAttempts;
    return typeof attempts === "number" ? attempts : undefined;
  }
  return undefined;
}

export function safeParseSseJson(data: string): SafeJsonResult {
  try {
    return { ok: true, value: JSON.parse(data) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error("Invalid SSE JSON."),
    };
  }
}

function parseProviderSseJson(
  provider: string,
  data: string,
  attempts: number,
): JsonRecord {
  const parsed = safeParseSseJson(data);
  if (parsed.ok) return asRecord(parsed.value);
  throw withProviderAttempts(
    new Error(`${provider} returned a malformed streaming event.`),
    attempts,
  );
}

export async function generateText(
  request: ResolvedAiTextRequest,
  signal?: AbortSignal,
): Promise<AiResult> {
  if (!providerSupports(request.provider, "text")) {
    throw new Error("This provider does not support text generation here.");
  }
  switch (request.provider) {
    case "openai":
      return generateOpenAiText(request, signal);
    case "anthropic":
      return generateAnthropicText(request, signal);
    case "gemini":
      return generateGeminiText(request, signal);
  }
}

export async function* streamGenerateText(
  request: ResolvedAiTextRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamTextEvent> {
  if (!providerSupports(request.provider, "text")) {
    throw new Error("This provider does not support text generation here.");
  }
  switch (request.provider) {
    case "openai":
      yield* streamOpenAiText(request, signal);
      return;
    case "anthropic":
      yield* streamAnthropicText(request, signal);
      return;
    case "gemini":
      yield* streamGeminiText(request, signal);
      return;
  }
}

async function* readSse(
  response: Response,
): AsyncGenerator<{ event?: string; data: string }> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const lines = raw.split(/\r?\n/);
      const event = lines
        .find((line) => line.startsWith("event:"))
        ?.slice("event:".length)
        .trim();
      const data = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice("data:".length).trim())
        .join("\n");
      if (data && data !== "[DONE]") yield { event, data };
      boundary = buffer.indexOf("\n\n");
    }
  }
}

async function* streamOpenAiText(
  request: ResolvedAiTextRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamTextEvent> {
  const { response, meta } = await providerFetchWithRetry("https://api.openai.com/v1/responses", {
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
      stream: true,
    }),
  }, signal);
  if (!response.ok) throw new Error(await readError(response));
  let text = "";
  let usage: AiUsage | undefined;
  let completed = false;
  for await (const event of readSse(response)) {
    const data = parseProviderSseJson("OpenAI", event.data, meta.attempts);
    if (data.type === "response.output_text.delta") {
      const delta = stringValue(data.delta) ?? "";
      text += delta;
      if (delta) yield { type: "delta" as const, text: delta };
    }
    if (data.type === "response.completed") {
      completed = true;
      usage = usageFromOpenAI(asRecord(asRecord(data.response).usage));
    }
  }
  if (!completed) throw withProviderAttempts(incompleteStreamError(), meta.attempts);
  yield {
    type: "result" as const,
    result: {
      provider: "openai",
      model: request.model,
      credentialSource: request.credentialSource,
      text,
      usage,
      providerAttempts: meta.attempts,
    },
  };
}

async function* streamAnthropicText(
  request: ResolvedAiTextRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamTextEvent> {
  const isLateOpus = /^claude-opus-4-[78]/.test(request.model);
  const { response, meta } = await providerFetchWithRetry("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": request.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: request.maxOutputTokens ?? 4000,
      system: request.system,
      messages: [{ role: "user", content: request.prompt }],
      temperature: isLateOpus ? undefined : request.temperature,
      top_p: isLateOpus ? undefined : request.topP,
      stream: true,
    }),
  }, signal);
  if (!response.ok) throw new Error(await readError(response));
  let text = "";
  let usage: AiUsage | undefined;
  let completed = false;
  for await (const event of readSse(response)) {
    const data = parseProviderSseJson("Anthropic", event.data, meta.attempts);
    if (event.event === "content_block_delta") {
      const delta = stringValue(asRecord(data.delta).text) ?? "";
      text += delta;
      if (delta) yield { type: "delta" as const, text: delta };
    }
    if (event.event === "message_delta") {
      usage = usageFromAnthropic(asRecord(data.usage));
    }
    if (event.event === "message_stop") {
      completed = true;
    }
  }
  if (!completed) throw withProviderAttempts(incompleteStreamError(), meta.attempts);
  yield {
    type: "result" as const,
    result: {
      provider: "anthropic",
      model: request.model,
      credentialSource: request.credentialSource,
      text,
      usage,
      providerAttempts: meta.attempts,
    },
  };
}

async function* streamGeminiText(
  request: ResolvedAiTextRequest,
  signal?: AbortSignal,
): AsyncGenerator<StreamTextEvent> {
  const { response, meta } = await providerFetchWithRetry(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      request.model,
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(request.apiKey)}`,
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
        },
      }),
    },
    signal,
  );
  if (!response.ok) throw new Error(await readError(response));
  let text = "";
  let usage: AiUsage | undefined;
  let completed = false;
  for await (const event of readSse(response)) {
    const data = parseProviderSseJson("Gemini", event.data, meta.attempts);
    const delta = extractGeminiText(data);
    text += delta;
    if (delta) yield { type: "delta" as const, text: delta };
    usage = usageFromGemini(data.usageMetadata) ?? usage;
    const candidate = asRecord(asArray(data.candidates)[0]);
    const finishReason = stringValue(candidate.finishReason);
    if (finishReason && finishReason !== "FINISH_REASON_UNSPECIFIED") {
      completed = true;
    }
  }
  if (!completed) throw withProviderAttempts(incompleteStreamError(), meta.attempts);
  yield {
    type: "result" as const,
    result: {
      provider: "gemini",
      model: request.model,
      credentialSource: request.credentialSource,
      text,
      usage,
      providerAttempts: meta.attempts,
    },
  };
}

export async function generateImage(
  request: ResolvedAiImageRequest,
  signal?: AbortSignal,
): Promise<AiResult> {
  if (!providerSupports(request.provider, "image")) {
    throw new Error("This provider does not support image generation here.");
  }
  switch (request.provider) {
    case "openai":
      return generateOpenAiImage(request, signal);
    case "gemini":
      return generateGeminiImage(request, signal);
    case "anthropic":
      throw new Error("This provider does not support image generation here.");
  }
}

async function generateOpenAiText(
  request: ResolvedAiTextRequest,
  signal?: AbortSignal,
): Promise<AiResult> {
  const { response, meta } = await providerFetchWithRetry("https://api.openai.com/v1/responses", {
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
      // Live-web grounding for tasks that need real, cited venues. Never paired
      // with json_object output — the grounded pass is prose; a second plain
      // call formats it into JSON (see day-details-client).
      tools: request.enableWebSearch ? [{ type: "web_search" }] : undefined,
      text:
        request.responseFormat === "json"
          ? { format: { type: "json_object" } }
          : undefined,
    }),
  }, signal);
  if (!response.ok) throw new Error(await readError(response));
  const data: unknown = await response.json();
  const record = asRecord(data);
  throwIfOpenAiTruncated(record);
  const text = cleanJsonText(extractOpenAiText(data));
  throwIfJsonLooksTruncated(text, request);
  const citations = request.enableWebSearch
    ? extractOpenAiCitations(data)
    : undefined;
  return {
    provider: "openai",
    model: request.model,
    credentialSource: request.credentialSource,
    text,
    usage: usageFromOpenAI(record.usage),
    providerAttempts: meta.attempts,
    citations: citations?.length ? citations : undefined,
  };
}

async function generateAnthropicText(
  request: ResolvedAiTextRequest,
  signal?: AbortSignal,
): Promise<AiResult> {
  const isLateOpus = /^claude-opus-4-[78]/.test(request.model);
  const { response, meta } = await providerFetchWithRetry("https://api.anthropic.com/v1/messages", {
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
  }, signal);
  if (!response.ok) throw new Error(await readError(response));
  const data: unknown = await response.json();
  const record = asRecord(data);
  throwIfAnthropicTruncated(record);
  const text = cleanJsonText(extractAnthropicText(data));
  throwIfJsonLooksTruncated(text, request);
  return {
    provider: "anthropic",
    model: request.model,
    credentialSource: request.credentialSource,
    text,
    usage: usageFromAnthropic(record.usage),
    providerAttempts: meta.attempts,
  };
}

async function generateGeminiText(
  request: ResolvedAiTextRequest,
  signal?: AbortSignal,
): Promise<AiResult> {
  const { response, meta } = await providerFetchWithRetry(
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
    signal,
    "text",
  );
  if (!response.ok) throw new Error(await readError(response));
  const data: unknown = await response.json();
  const record = asRecord(data);
  throwIfGeminiTruncated(record);
  const text = cleanJsonText(extractGeminiText(data));
  throwIfJsonLooksTruncated(text, request);
  return {
    provider: "gemini",
    model: request.model,
    credentialSource: request.credentialSource,
    text,
    usage: usageFromGemini(record.usageMetadata),
    providerAttempts: meta.attempts,
  };
}

async function generateOpenAiImage(
  request: ResolvedAiImageRequest,
  signal?: AbortSignal,
): Promise<AiResult> {
  const { response, meta } = await providerFetchWithRetry(
    "https://api.openai.com/v1/images/generations",
    {
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
    },
    signal,
    "image",
  );
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
    providerAttempts: meta.attempts,
  };
}

async function generateGeminiImage(
  request: ResolvedAiImageRequest,
  signal?: AbortSignal,
): Promise<AiResult> {
  const { response, meta } = await providerFetchWithRetry(
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
    signal,
    "image",
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
    providerAttempts: meta.attempts,
  };
}
