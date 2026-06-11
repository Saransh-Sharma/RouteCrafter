# RouteCrafter

A premium itinerary-generation studio for creating country-specific travel
itinerary products and marketplace (Fiverr / Etsy / Gumroad) listing assets.

RouteCrafter is a **travel itinerary product factory** for creators who sell
custom travel-planning services. It helps you repeatedly produce premium,
editorial, configurable itinerary products for any country, traveler type, trip
length, budget, and deliverable format.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + React 19
- TypeScript
- Tailwind CSS v4
- Hand-built UI component system (`src/components/ui`)
- `lucide-react` icons, `clsx` + `tailwind-merge` for class composition

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run lint     # ESLint
npm run build    # Production build
```

## Project structure

```
src/
  app/
    page.tsx                 # Dashboard
    projects/page.tsx        # All projects
    projects/new/page.tsx    # Create project
    projects/[id]/page.tsx   # Project workspace shell
    templates/page.tsx       # Template library (roadmap)
    settings/page.tsx        # Settings (roadmap)
    layout.tsx, globals.css  # Shell + design system
  components/
    layout/                  # AppShell, Sidebar, MobileNav, nav
    ui/                       # Button, Card, Badge, fields, etc.
    workspace/               # Workspace tabs + panels
    dashboard/               # Dashboard-specific widgets
  lib/
    types.ts                 # Lightweight types (full models in Phase 2)
    mock-data.ts             # Sample projects for the shell
    generation/              # Prompt-template engine (Phase 4+)
    schemas/                 # Zod schemas + data model (Phase 2)
```

## Design direction

Warm ivory paper, sage + forest green, terracotta, warm brown, dusty teal, and
muted gold accents. Editorial serif headings (Fraunces) with a clean sans body
(Inter). Rounded cards, soft shadows, calm whitespace — a boutique itinerary
studio, not a generic SaaS dashboard.

## Build phases

This app is built iteratively. **Phase 0 (scaffold)** and **Phase 1 (app shell
+ design system)** are complete. Upcoming phases:

- Phase 2 — Data models, Zod schemas, localStorage persistence, JSON import/export, seeds
- Phase 3 — Full trip configuration form
- Phase 4 — Prompt template engine (copy-paste, no API key required)
- Phase 5 — Five portfolio image prompts
- Phase 6 — Itinerary matrix
- Phase 7 — Expanded itinerary builder
- Phase 8 — Marketplace listing generator
- Phase 9 — PDF preview & export
- Phase 10 — CSV / spreadsheet export
- Phase 11 — Template library & presets
- Phase 12 — Optional AI integration (prompt-output mode remains the fallback)

## Principles

- Generation templates stay separate from UI.
- Everything generated is editable and copyable.
- No hardcoded single-country logic.
- Never fabricate real-time prices, hours, or hotel availability — always remind
  the user to verify before delivery.
- The app is fully usable without an AI API key.
```
