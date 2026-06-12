# Architecture Overview

RouteCrafter is a **client-heavy Next.js 16 (App Router) application** with a thin
server-side AI proxy. There is no application database: domain data lives in the
browser via Zustand + `localStorage`. The codebase is organized around a clear
separation between the **data model** (Zod schemas), a **pure generation engine**,
an **optional AI layer**, and the **React UI**.

## System map

```mermaid
flowchart TB
  subgraph Browser
    UI["React UI (App Router pages + workspace tabs)"]
    Stores["Zustand stores\nprojects-store / ai-settings-store"]
    Gen["Generation engine (pure)\nsrc/lib/generation"]
    AiClient["AI client\nsrc/lib/ai/client.ts"]
    LS["localStorage\nroutecrafter:v1 / :ai-settings:v1"]
    UI --> Stores
    UI --> Gen
    UI --> AiClient
    Stores --> LS
  end

  subgraph Server["Next.js server (route handlers)"]
    TextRoute["/api/ai/text"]
    ImageRoute["/api/ai/image"]
    Adapters["provider-adapters.ts (server-only)"]
    TextRoute --> Adapters
    ImageRoute --> Adapters
  end

  subgraph Providers["External LLM providers"]
    OpenAI
    Anthropic
    Gemini
  end

  AiClient --> TextRoute
  AiClient --> ImageRoute
  Adapters --> OpenAI
  Adapters --> Anthropic
  Adapters --> Gemini
```

The only server-side code paths are the two AI route handlers and the server-only
provider adapters. Everything else runs in the browser.

## Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| **Data model** | [`src/lib/schemas`](../../src/lib/schemas) | Zod schemas + inferred types; the single source of truth. See [Data model](data-model.md). |
| **Normalization & IO** | [`src/lib/project-normalization.ts`](../../src/lib/project-normalization.ts), [`src/lib/io/project-io.ts`](../../src/lib/io/project-io.ts) | Apply schema defaults / migrate; JSON import/export. |
| **Generation engine** | [`src/lib/generation`](../../src/lib/generation) | Pure, UI-free prompt templates + structured scaffold builders + realism rules. See [Generation engine](generation-engine.md). |
| **AI layer** | [`src/lib/ai`](../../src/lib/ai), [`src/app/api/ai`](../../src/app/api/ai) | BYOK provider registry, prompt builders, server adapters, client, parsing. See [AI integration](ai-integration.md). |
| **State** | [`src/lib/store`](../../src/lib/store) | Zustand stores with `localStorage` persistence. See [State & persistence](state-and-persistence.md). |
| **UI** | [`src/app`](../../src/app), [`src/components`](../../src/components) | App Router pages, AppShell, design-system primitives, workspace panels. See [UI & design system](ui-and-design-system.md). |

## Directory structure

```
src/
  app/
    layout.tsx                # Root layout: fonts + AppShell
    globals.css               # Design tokens + document/print styles
    page.tsx                  # Dashboard
    projects/                 # list, new, [id] workspace
    templates/page.tsx        # roadmap placeholder
    settings/page.tsx         # AI settings
    api/ai/text/route.ts      # server AI text proxy
    api/ai/image/route.ts     # server AI image proxy
  components/
    layout/                   # AppShell, Sidebar, MobileNav, nav, notices
    ui/                        # design-system primitives + field controls
    workspace/                # WorkspaceTabs + the 9 panels (+ PromptHelper)
    ai/                        # AiRunSheet, AiCostButton
    dashboard/                # ImportProjectButton, etc.
  lib/
    schemas/                  # Zod schemas (project, trip-config, itinerary, ...)
    generation/               # context, registry, templates/, scaffolds, realism
    ai/                        # providers, adapters, tasks, client, parse, schemas
    store/                    # projects-store, ai-settings-store
    io/                        # project-io (import/export)
    project-normalization.ts  # normalize/migrate persisted + imported data
    seed-projects.ts          # first-run demo data
    mock-data.ts              # workspace module registry
    hooks.ts                  # useMounted (SSR-safe hydration)
    utils.ts                  # cn() class merger
```

## Request / data flow

### Local generation (no key)

`Project` -> `buildContext(project)` -> either `renderTemplate(id, ctx)` (copy-paste
prompt string) or a scaffold builder (`buildItinerary`, `buildMatrix`,
`buildListing`, `buildImagePrompts`) producing Zod-validated structured data ->
written into the project via the store.

### Direct AI (with key)

UI assembles a request (provider, key, model, prompt from `tasks.ts`) -> `client.ts`
`fetch` to `/api/ai/text` or `/api/ai/image` -> route validates with Zod ->
`provider-adapters.ts` calls the provider -> result returned -> client parses JSON
and validates against a domain schema -> previewed -> applied to the project.

### Persistence

Every project mutation flows through the projects store's `commitProjects`, which
normalizes each project, enforces a size cap, and persists to `localStorage`. On
load, persisted data is re-validated and migrated through the schema.

## Key design principles

1. **Zod schemas are the single source of truth.** Domain TypeScript types are
   inferred (`z.infer`), never hand-written, so validation, defaults, forms, and
   prompts cannot drift apart.
2. **Generation is pure and UI-free.** Templates are `(ctx) => string`; nothing in
   `src/lib/generation` imports React. The UI consumes the engine, never the reverse.
3. **No hardcoded single-country logic.** Country/regions/style flow through
   `GenerationContext` into every template and scaffold.
4. **Usable without an API key.** Prompt-output mode and local scaffolds are the
   default; AI is strictly additive and opt-in.
5. **Never fabricate live data.** Realism rules are injected into itinerary/guide
   prompts and disclaimers, and surfaced as "verify before delivery" reminders.
6. **Preview-before-apply for AI.** No AI output mutates a project until the user
   reviews and confirms it.
7. **Local-first persistence.** All user data is in the browser; portability is via
   JSON import/export.

## Where to go next

- [Data model](data-model.md) — what a `Project` contains.
- [Generation engine](generation-engine.md) — how content is produced.
- [AI integration](ai-integration.md) — how the optional AI layer works.
- [State & persistence](state-and-persistence.md) — how data is stored.
- [UI & design system](ui-and-design-system.md) — how the app is rendered.
