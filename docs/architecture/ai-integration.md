# AI Integration

RouteCrafter's AI layer is a **bring-your-own-key (BYOK) proxy**. The browser stores
provider keys locally, sends them per-request through Next.js route handlers to
server-only adapters, and never persists keys on the server. It coexists with the
copy-paste [generation engine](generation-engine.md), which needs no key.

For the user-facing setup, see the [AI setup guide](../guides/ai-setup.md).

## Architecture

```mermaid
flowchart LR
  subgraph client [Browser]
    UI["Workspace panels / AiRunSheet"]
    Store["ai-settings-store (localStorage)"]
    Client["client.ts (fetch)"]
    UI --> Store
    UI --> Client
  end

  subgraph server [Next.js server]
    TextRoute["/api/ai/text"]
    ImageRoute["/api/ai/image"]
    Adapters["provider-adapters.ts (server-only)"]
    TextRoute --> Adapters
    ImageRoute --> Adapters
  end

  subgraph providers [External APIs]
    OpenAI
    Anthropic
    Gemini
  end

  Client --> TextRoute
  Client --> ImageRoute
  Adapters --> OpenAI
  Adapters --> Anthropic
  Adapters --> Gemini
```

| Concern | File |
| --- | --- |
| Types | [`src/lib/ai/types.ts`](../../src/lib/ai/types.ts) |
| Provider registry | [`src/lib/ai/providers.ts`](../../src/lib/ai/providers.ts) |
| Server adapters | [`src/lib/ai/provider-adapters.ts`](../../src/lib/ai/provider-adapters.ts) |
| Prompt builders | [`src/lib/ai/tasks.ts`](../../src/lib/ai/tasks.ts) |
| Transport schemas | [`src/lib/ai/schemas.ts`](../../src/lib/ai/schemas.ts) |
| Output parsing | [`src/lib/ai/parse.ts`](../../src/lib/ai/parse.ts) |
| Run metadata | [`src/lib/ai/metadata.ts`](../../src/lib/ai/metadata.ts) |
| Browser client | [`src/lib/ai/client.ts`](../../src/lib/ai/client.ts) |
| API routes | [`src/app/api/ai/text/route.ts`](../../src/app/api/ai/text/route.ts), [`src/app/api/ai/image/route.ts`](../../src/app/api/ai/image/route.ts) |
| Settings store | [`src/lib/store/ai-settings-store.ts`](../../src/lib/store/ai-settings-store.ts) |
| UI | [`src/components/ai/AiRunSheet.tsx`](../../src/components/ai/AiRunSheet.tsx), [`src/components/ai/AiCostButton.tsx`](../../src/components/ai/AiCostButton.tsx) |

## Providers

```1:1:src/lib/ai/types.ts
export type AiProviderId = "openai" | "anthropic" | "gemini";
```

The registry in `providers.ts` describes each provider's capabilities and models:

| Provider | Text | Image | Structured JSON | Default text model | Default image model |
| --- | --- | --- | --- | --- | --- |
| OpenAI | yes | yes | yes | `gpt-5.2` | `gpt-image-1` |
| Anthropic | yes | no | yes | `claude-sonnet-4-6` | — |
| Gemini | yes | yes | yes | `gemini-3.5-flash` | `gemini-3.1-flash-image` |

Helpers: `providerLabel`, `providerSupports`, `resolveTextModel`,
`resolveImageModel` (fall back to defaults when the model string is empty).

### Adapters

`provider-adapters.ts` is marked `"server-only"` and is the only code that talks to
external APIs. The entry points dispatch by provider:

```143:169:src/lib/ai/provider-adapters.ts
export async function generateText(request: AiTextRequest): Promise<AiResult> {
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

export async function generateImage(request: AiImageRequest): Promise<AiResult> {
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
```

Per-provider specifics:

| Provider | Text endpoint | Image endpoint | Auth | JSON mode |
| --- | --- | --- | --- | --- |
| OpenAI | `POST /v1/responses` | `POST /v1/images/generations` | `Authorization: Bearer` | `text.format.type: json_object` |
| Anthropic | `POST /v1/messages` | n/a | `x-api-key` | Appends a "return only valid JSON" instruction |
| Gemini | `:generateContent?key=` | same endpoint | API key in query string | `responseMimeType: application/json` |

Notable behaviors: OpenAI text uses the Responses API (not Chat Completions);
Anthropic Opus models omit temperature/top-p; Gemini image responses extract
`inlineData` as a base64 data URL. Errors are normalized (401/403 -> auth failed,
429 -> rate limit, 5xx -> provider unavailable, `AbortError` -> cancelled), and
provider-specific token counts are mapped into a unified `AiUsage`.

## Task types

```3:12:src/lib/ai/types.ts
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
```

`taskType` is **metadata only** — it is passed through the API and recorded in
`aiRuns`, but does not change server routing. Each task has a prompt builder in
`tasks.ts`:

| Task | Builder | Wired in | Output |
| --- | --- | --- | --- |
| `brief` | `buildBriefExtractionPrompt` | Trip Config form | Trip configuration JSON |
| `prompt` | `buildPromptRunPrompt` | Prompt Studio | Plain text |
| `matrix` | `buildMatrixPrompt` | Matrix panel | Matrix JSON |
| `itinerary` | `buildItineraryPrompt` | Expanded Itinerary | Itinerary JSON |
| `rewrite` | `buildDayPrompt` | Expanded Itinerary (day) | Day JSON |
| `listing` | `buildListingPrompt` | Listing panel | Listing JSON |
| `imagePrompt` | `buildImagePromptImprovementPrompt` | Image Prompts | Image brief JSON |
| `imageGeneration` | `buildImageGenerationPrompt` | Image Prompts, PDF theme controls | Image |
| `guide` | `buildGuidePrompt` | (defined, not wired) | Itinerary JSON |

Every builder injects project context via `configBlock(ctx)` and
`voiceDescription(ctx)` from the generation engine, includes the shorter realism
guardrail (no invented live data), and — for JSON tasks — appends a `jsonOnly(...)`
instruction to return raw JSON with no markdown fences.

## API routes

Both routes follow the same pattern: validate with a Zod schema, call the adapter,
return the result or a normalized error, and disable caching.

```7:27:src/app/api/ai/text/route.ts
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = aiTextRequestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Missing or invalid AI text request." },
        { status: 400 },
      );
    }
    const result = await generateText(parsed.data);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: normalizeProviderError(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
```

### Request / response contract

**Text request** (`aiTextRequestSchema`):

```24:35:src/lib/ai/schemas.ts
export const aiTextRequestSchema = z.object({
  provider: aiProviderIdSchema,
  apiKey: z.string().min(1),
  model: z.string().min(1),
  prompt: z.string().min(1),
  system: z.string().optional(),
  taskType: aiTaskTypeSchema,
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxOutputTokens: z.number().int().min(1).max(32000).optional(),
  responseFormat: z.enum(["text", "json"]).optional(),
});
```

**Image request** adds `size`, `quality`, `aspectRatio` (optional). Note only the
OpenAI image adapter uses `size`/`quality`; `aspectRatio` is currently unused by
adapters.

**Success response** (`AiResult`):

```45:52:src/lib/ai/types.ts
export interface AiResult {
  text?: string;
  image?: string;
  mimeType?: string;
  usage?: AiUsage;
  provider: AiProviderId;
  model: string;
}
```

**Error response:** `{ error: string }` — HTTP 400 (validation) or 500
(provider/runtime).

### Client / server split

| Concern | Client | Server |
| --- | --- | --- |
| Key storage | `localStorage` via Zustand | Never stored |
| Key transit | Sent in POST body to `/api/ai/*` | Forwarded to provider, discarded after request |
| Provider HTTP | — | `provider-adapters.ts` only |
| Prompt construction | `tasks.ts` (client) | — |
| Result parsing | `parseJsonObject` + domain Zod schemas | Raw text/image from provider |

The browser client posts to the route and parses the response:

```17:28:src/lib/ai/client.ts
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
```

## Parsing & validation

Provider text is fence-stripped before parsing:

```1:8:src/lib/ai/parse.ts
export function parseJsonObject<T = unknown>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned) as T;
}
```

There are two validation layers:

1. **Transport** (`schemas.ts`) — validates API request/response shapes.
2. **Domain** — consuming panels parse the JSON and validate it against the relevant
   project schema (`tripConfigurationSchema`, `itineraryMatrixSchema`,
   `marketplaceListingSchema`, `dayPlanSchema`, `portfolioImagePromptSchema`) before
   it can be applied.

`AiRunSheet` accepts an optional `validateText` callback so a panel can block "apply"
on bad JSON/schema before anything touches the project.

## The AI Run Sheet workflow

`AiRunSheet` enforces preview-before-apply. State machine:
`idle -> running -> result | error`.

1. Show the prompt preview, provider/model, and a **Billable** warning.
2. User confirms; the fetch is abortable.
3. For text: side-by-side current vs editable proposal. For image: a preview.
4. **Apply** via panel-defined merge modes: **replace**, **fill-empty**, or
   **append**.
5. Nothing is written to the project until the user applies.

The request is assembled with the key pulled from the settings store:

```131:159:src/components/ai/AiRunSheet.tsx
      const next =
        mode === "text"
          ? await requestAiText(
              {
                provider,
                apiKey,
                model: textDefaults.model,
                prompt,
                taskType,
                temperature: textDefaults.temperature,
                topP: textDefaults.topP,
                maxOutputTokens: textDefaults.maxOutputTokens,
                responseFormat,
              },
              controller.signal,
            )
          : await requestAiImage(
              {
                provider,
                apiKey,
                model: imageDefaults.model,
                prompt,
                taskType,
                size: imageDefaults.size,
                quality: imageDefaults.quality,
                aspectRatio: imageDefaults.aspectRatio,
              },
              controller.signal,
            );
```

## Cost and usage

There is **no dollar-cost estimation**. "Cost" is disclosure-only: `AiCostBadge`
renders a static "Billable" label and `AiCostButton` is a styled trigger with no
pricing logic.

```7:17:src/components/ai/AiCostButton.tsx
export function AiCostBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--rc-ai-border)] bg-[var(--rc-ai-gold-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--rc-ai-brown)]",
        className,
      )}
    >
      Billable
    </span>
  );
}
```

When a result is applied, `createAiRunMetadata` records a run on `project.aiRuns`
(provider, model, task type, token/image usage, timestamps) — never the key or the
prompt payload. This feeds the AI-usage export appendix.

## Settings store

The AI settings store persists to `localStorage` under
`routecrafter:ai-settings:v1`. It holds per-provider settings (key, custom models,
last-test status), text defaults (provider, model, temperature `0.7`, top-p `0.9`,
max tokens `4000`), and image defaults (provider, model, size `1024x1024`, quality
`medium`, aspect ratio `1:1`). The two safety flags are forced `true` on rehydrate:

```81:82:src/lib/store/ai-settings-store.ts
      requirePreviewBeforeApply: true,
      showBillableConfirmation: true,
```

See [State & persistence](state-and-persistence.md) for the persistence mechanics.

## Security considerations {#security-considerations}

| Topic | Behavior | Risk |
| --- | --- | --- |
| Key storage | Plaintext in `localStorage` | XSS / shared-device exposure |
| Key transit | Browser -> Next.js route -> provider, same request | Visible in DevTools network tab |
| Server persistence | None (proxy only) | No server key store (good) |
| Route auth | None — open proxy; needs a valid key to be useful | Abuse possible if a key leaks |
| Export | AI-usage appendix excludes keys and prompts | Safe to share exports |

The Settings page states explicitly that keys are only in the browser's local
storage and are not synced or encrypted, and advises against saving keys on shared
devices.

## Gaps / reserved code

- The `guide` task type and `buildGuidePrompt` are defined but not wired to the UI
  (itinerary "guide" actions use `buildItineraryPrompt` with focus strings).
- `resolveTextModel` / `resolveImageModel` exist but `AiRunSheet` uses the
  defaults directly (custom models are synced into defaults via Settings).
- `aspectRatio` is stored and sent but not consumed by adapters.
- There is no server-side rate limiting beyond provider 401/403/429 handling.
