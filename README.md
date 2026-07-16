# RouteCrafter

The admin panel for creating and selling travel itinerary products — premium
day-by-day itineraries, print-ready PDFs, and marketplace listing assets for
Fiverr, Etsy, Gumroad, and direct sales.

RouteCrafter is a **travel itinerary product factory**. One product = one
country: a positioning, committed editions (duration × traveler type, each
with a real multi-city route), a polished day-by-day itinerary, a designed
PDF, and ready-to-paste listing copy. The headline feature is **Series** —
multiply a finished product across countries with AI: the engine clones the
product's structure, transposes the route to real destinations in each target
country, regenerates the itinerary and listing in the same voice, and each
country version becomes its own sellable product.

Projects and assets live in a shared cloud workspace (Postgres + Vercel Blob)
with a browser local cache for fast editing. Every artifact can still be
produced through copy-paste prompts without an AI API key, and **API image
generation is always opt-in** — every image slot offers upload and a
copy-ready external prompt first. Access is protected by password or
email-OTP authentication. AI assist uses server-funded OpenAI by default or a
personal provider key (OpenAI, Anthropic, or Gemini).

## Information architecture

Two nouns, four editor tabs:

| Surface | Purpose |
|---|---|
| `/` | **The Shelf** — image-forward product grid, groupable by country or series |
| `/products/new` | One creation surface: blank, from template, or a multi-country **series** |
| `/products/[id]` | **Product editor** — Trip · Itinerary · PDF · Listing tabs, plus Readiness (a checklist, never a gate) and Export in the header |
| `/series/[id]` | **Series board** — per-country generation status, cost tally, retry/resume |
| `/settings` | AI provider keys, defaults, and a short "How it works" |

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19
- TypeScript, Tailwind CSS v4
- [Zod](https://zod.dev) schemas as the single source of truth for the data model (`schemaVersion 5`)
- Postgres/Vercel Blob shared workspace plus Zustand `localStorage` cache
- Signed HttpOnly JWT sessions, Resend email OTP, Upstash Redis rate limits
- Hand-built UI component system (`src/components/ui`, native `<dialog>` overlays)
- Server-side PDF export: Playwright Chromium renders `/pdf/print` and calls `page.pdf()`
- `vitest` + Testing Library for unit tests, Playwright for e2e

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo projects are seeded
on first run.

```bash
npm run lint     # ESLint
npm run test     # Vitest (unit tests)
npm run test:e2e # Playwright e2e suite
npm run build    # Production build
```

> **Note for contributors and agents:** this repo pins Next.js 16, which has
> breaking changes from earlier versions. Read the bundled guides in
> `node_modules/next/dist/docs/` before changing routing, layouts, or APIs (see
> [`AGENTS.md`](AGENTS.md)).

## Project structure

```
src/
  app/
    (main)/page.tsx            # The Shelf (product grid)
    (main)/products/new/       # Creation: blank / template / series
    (main)/products/[id]/      # Product editor (4 tabs)
    (main)/series/[id]/        # Series board
    (main)/settings/           # AI settings + how-it-works
    pdf/print/                 # Headless print route for PDF export
    api/                       # projects, ai, assets, templates, pdf/export…
    layout.tsx, globals.css    # Shell + design tokens
    pdf.css                    # Printable document styles (single source)
  components/
    layout/                    # AppShell, TopBar, CommandPalette
    ui/                        # Primitives incl. overlay/{Dialog,Popover,Menu}
    editor/                    # Editor tabs, Readiness, Export, ImageSlot, MediaDrawer
    series/                    # MultiplyDialog, SeriesBatchForm, board pieces
    shelf/                     # ProductCard
    workspace/                 # Itinerary/listing/PDF/route panels
    ai/                        # AiRunSheet, AiCostButton
  lib/
    schemas/                   # Zod schemas + data model (source of truth)
    series/                    # Cross-country engine: clone, engine, estimate
    ai/                        # Clients, provider layer, transpose prompts
    generation/                # Pure prompt-template + scaffold engine
    editions.ts                # Edition & route helpers
    readiness.ts               # Launch-readiness linting
    project-normalization.ts   # Schema migration/normalization (lazy, on read)
```

## Documentation

Full documentation lives in [`docs/`](docs/README.md):

- [Product overview](docs/product/overview.md) — what it is, the creator loop, series
- [Series engine](docs/architecture/series-engine.md) — cross-country transposition pipeline
- [Data model](docs/architecture/data-model.md) — entities, enums, v5 migration
- [AI integration](docs/architecture/ai-integration.md) — providers, tasks, security
- [Generation engine](docs/architecture/generation-engine.md) — templates, scaffolds, realism rules
- [State & persistence](docs/architecture/state-and-persistence.md) — stores, sync, conflicts
- [Contributing](docs/development/contributing.md) — conventions, testing, CI

## Design direction

Modern travel editorial: warm paper surfaces, quiet ink, sage as the single
interactive accent, image-forward cards with a duotone scrim. Editorial serif
headings (Fraunces) on a strict six-step type scale with a clean sans body
(Inter). The tool stays calm; the itinerary PDFs carry the visual richness.

## Principles

- The creator loop is the IA: create → generate → design → list → export.
- Readiness is a checklist, never a gate — export is always available.
- Everything generated is editable and copyable; prompts work without a key.
- API image generation is opt-in, always behind an explicit cost confirmation.
- No hardcoded single-country logic; series multiply structure, not places.
- Never fabricate live prices, hours, or availability — verification notes
  exist so buyers know what to double-check.
