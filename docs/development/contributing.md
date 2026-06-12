# Contributing

This guide covers conventions, testing, CI, and how to extend the two most common
areas: the [generation engine](../architecture/generation-engine.md) and the
[AI layer](../architecture/ai-integration.md). Read the
[architecture overview](../architecture/overview.md) first.

## Next.js 16 caveat (read this first)

This repository pins **Next.js 16**, which has breaking changes versus earlier
versions. Per [`AGENTS.md`](../../AGENTS.md):

> This version has breaking changes — APIs, conventions, and file structure may all
> differ. Read the relevant guide in `node_modules/next/dist/docs/` before writing
> any code. Heed deprecation notices.

Before changing routing, layouts, server/client boundaries, or route handlers,
consult the bundled docs in `node_modules/next/dist/docs/`.

## Conventions

- **Zod is the source of truth.** Add or change domain types by editing the schema
  in [`src/lib/schemas`](../../src/lib/schemas) and inferring the TypeScript type —
  never hand-write a parallel `interface`. Re-export from `index.ts` /
  [`types.ts`](../../src/lib/types.ts) as appropriate.
- **Keep generation pure.** Anything in [`src/lib/generation`](../../src/lib/generation)
  must be UI-free (no React imports). Templates are pure `(ctx) => string`.
- **Never fabricate live data.** Itinerary/guide/PDF content must not invent real
  prices, opening hours, or availability. Reuse the realism constants in
  [`realism.ts`](../../src/lib/generation/realism.ts) (prompts) and the realism
  string in [`tasks.ts`](../../src/lib/ai/tasks.ts) (AI), and keep the
  "verify before delivery" disclaimers.
- **Everything generated stays editable.** Generation produces drafts; never lock
  output.
- **No single-country hardcoding.** Drive everything from `GenerationContext`.
- **Route all project writes through the store.** Use the projects-store actions
  (which funnel through `commitProjects` for normalization + the size guard) rather
  than mutating projects directly. See
  [State & persistence](../architecture/state-and-persistence.md).
- **AI must preview before applying.** Use `AiRunSheet`; don't write AI output to a
  project without user confirmation.
- **Styling** uses Tailwind v4 + the `cn()` helper and the design tokens in
  [`globals.css`](../../src/app/globals.css). Prefer the existing
  [`components/ui`](../../src/components/ui) primitives.

## Testing

Tests use **Vitest** with Testing Library in a jsdom environment.

Config ([`vitest.config.mts`](../../vitest.config.mts)):

```1:14:vitest.config.mts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    restoreMocks: true,
  },
});
```

Run them:

```bash
npm run test     # one-shot (used in CI)
npx vitest       # watch mode
```

Existing tests cover the highest-risk logic — schemas, normalization, the store,
generation, and key components. Examples in the repo include:

- `src/lib/schemas/trip-config.test.ts`, `src/lib/schemas/ai-integration.test.ts`
- `src/lib/project-normalization.test.ts`
- `src/lib/store/projects-store.test.ts`,
  `src/lib/store/projects-store-hydration.test.ts`,
  `src/lib/store/ai-settings-store.test.ts`
- `src/lib/generation/itinerary.test.ts`
- `src/components/workspace/trip-config/TripConfigForm.test.tsx`,
  `src/components/workspace/pdf/ItineraryDocument.test.tsx`,
  `src/components/workspace/pdf/PdfThemeControls.test.tsx`

When adding logic to schemas, the store, normalization, or the generation engine,
add or extend a colocated `*.test.ts(x)` file.

## Continuous integration

CI runs on pull requests and pushes to `main`
([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)) on **Node 20**:

```8:20:.github/workflows/ci.yml
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npm run build
```

Before opening a PR, run the same sequence locally:

```bash
npm run lint && npm run test && npm run build
```

## How to add a prompt template

1. Create a file in
   [`src/lib/generation/templates/`](../../src/lib/generation/templates) exporting a
   `PromptTemplate` constant: `id`, `label`, `group` (one of Positioning / Visuals /
   Itinerary / Listing / Guides), `description`, and a pure
   `build: (ctx) => string`. Use `configBlock(ctx)` / `voiceDescription(ctx)` from
   [`context.ts`](../../src/lib/generation/context.ts), and inject realism constants
   if the output is an itinerary or guide.
2. Register it in [`registry.ts`](../../src/lib/generation/registry.ts): import it and
   append it to `templates[]` (its position controls display order within the group).
3. It now appears automatically in Prompt Studio (`templatesByGroup`). To surface it
   in a specific panel's `PromptHelper`, reference its id there.

No UI changes are required for the template to appear in Prompt Studio.

## How to add an AI task

1. Add the task name to `AiTaskType` in
   [`src/lib/ai/types.ts`](../../src/lib/ai/types.ts).
2. Add a prompt builder in [`tasks.ts`](../../src/lib/ai/tasks.ts) that builds the
   prompt from a `Project` (via `buildContext`), includes the realism guardrail, and
   for structured output appends `jsonOnly("<SchemaName>")`.
3. In the relevant panel, open an `AiRunSheet` with the new `taskType` and prompt.
   For JSON output, pass a `validateText` callback that parses with `parseJsonObject`
   and validates with the matching domain schema, and define `apply` with the merge
   modes you support (replace / fill-empty / append).
4. On apply, record metadata with `createAiRunMetadata` so the run shows up in the
   AI-usage export.

Because `taskType` is metadata (not server routing), no API-route change is needed
for a new text/image task. A genuinely new provider, however, requires adding an
entry to [`providers.ts`](../../src/lib/ai/providers.ts) and an adapter branch in
[`provider-adapters.ts`](../../src/lib/ai/provider-adapters.ts).

## Schema changes and migrations

Migration is **default-driven**: bump `CURRENT_SCHEMA_VERSION` in
[`project.ts`](../../src/lib/schemas/project.ts) only when needed, give new fields
Zod defaults, and the normalization path fills them in for older data automatically.
Add a normalization test for any non-trivial migration. See
[Data model -> Normalization](../architecture/data-model.md#normalization).

## Documentation

When you change behavior, update the relevant doc under [`docs/`](../README.md) so
the documentation stays accurate (this set was written against the current code).
Follow the repo's Mermaid conventions (no spaces in node ids, quote labels with
special characters, no custom colors).
