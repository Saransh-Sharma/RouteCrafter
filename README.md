# RouteCrafter

A premium itinerary-generation studio for creating country-specific travel
itinerary products and marketplace (Fiverr / Etsy / Gumroad) listing assets.

RouteCrafter is a **travel itinerary product factory** for creators who sell
custom travel-planning services. It helps you repeatedly produce premium,
editorial, configurable itinerary products for any country, traveler type, trip
length, budget, and deliverable format — without hardcoding any single country.

Project content remains local-first in the browser: every artifact can be
produced through copy-paste prompts without an AI API key. Access to the app is
protected by password or email-OTP authentication. Optional AI assist lets you
use server-funded OpenAI by default or bring your own provider key (OpenAI,
Anthropic, or Gemini) to draft content directly inside the app.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19
- TypeScript
- Tailwind CSS v4
- [Zod](https://zod.dev) schemas as the single source of truth for the data model
- [Zustand](https://zustand.docs.pmnd.rs) + `localStorage` for persistence
- Signed HttpOnly JWT sessions, Resend email OTP, and Upstash Redis rate limits
- Hand-built UI component system (`src/components/ui`)
- `lucide-react` icons, `clsx` + `tailwind-merge` for class composition
- `html2pdf.js` for client-side PDF export
- `vitest` + Testing Library for unit tests

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Demo projects are seeded on
first run.

```bash
npm run lint     # ESLint
npm run test     # Vitest (unit tests)
npm run test:e2e # Playwright authentication flows
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
    page.tsx                 # Dashboard
    projects/page.tsx        # All projects
    projects/new/page.tsx    # Create project
    projects/[id]/page.tsx   # Project workspace shell
    templates/page.tsx       # Template library (roadmap placeholder)
    settings/page.tsx        # AI provider keys + defaults
    api/ai/text/route.ts     # Server-side AI text proxy
    api/ai/image/route.ts    # Server-side AI image proxy
    layout.tsx, globals.css  # Shell + design system
  components/
    layout/                  # AppShell, Sidebar, MobileNav, nav
    ui/                       # Button, Card, Badge, fields, OutputBlock, etc.
    workspace/               # Workspace tabs + panels (9 modules)
    ai/                       # AiRunSheet, AiCostButton
    dashboard/               # Dashboard-specific widgets
  lib/
    schemas/                 # Zod schemas + data model (source of truth)
    generation/              # Pure prompt-template + scaffold engine
    ai/                       # Server OpenAI + personal-key provider layer
    store/                   # Zustand stores (projects, ai-settings)
    io/                       # Project JSON import/export
    project-normalization.ts # Schema migration/normalization
    seed-projects.ts         # First-run demo data
```

## Documentation

Full documentation lives in [`docs/`](docs/README.md):

- **Product**
  - [Product overview](docs/product/overview.md) — what it is, who it's for, features, principles
- **Guides**
  - [Getting started](docs/guides/getting-started.md) — install, scripts, local data, and the five-stage production route
  - [User guide](docs/guides/user-guide.md) — five-stage workflow from Define through Publish
  - [AI setup](docs/guides/ai-setup.md) — server OpenAI, personal overrides, models, estimates, safety
- **Architecture**
  - [Architecture overview](docs/architecture/overview.md) — system map and principles
  - [Data model](docs/architecture/data-model.md) — entities, enums, normalization, import/export
  - [Generation engine](docs/architecture/generation-engine.md) — templates, scaffolds, realism rules
  - [AI integration](docs/architecture/ai-integration.md) — providers, tasks, API routes, security
  - [State & persistence](docs/architecture/state-and-persistence.md) — Zustand stores, hydration
  - [UI & design system](docs/architecture/ui-and-design-system.md) — components, tokens, PDF builder
- **Development**
  - [Contributing](docs/development/contributing.md) — conventions, testing, CI, extension guides

## Design direction

Warm ivory paper, sage + forest green, terracotta, warm brown, dusty teal, and
muted gold accents. Editorial serif headings (Fraunces) with a clean sans body
(Inter). Rounded cards, soft shadows, calm whitespace — a boutique itinerary
studio, not a generic SaaS dashboard.

## Principles

- Generation templates stay separate from UI.
- Everything generated is editable and copyable.
- No hardcoded single-country logic.
- Never fabricate real-time prices, hours, or hotel availability — always remind
  the user to verify before delivery.
- The app is fully usable without an AI API key.
