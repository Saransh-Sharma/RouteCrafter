# Product Overview

## What RouteCrafter is

RouteCrafter is a **travel itinerary product factory**. It is a studio for creators
who sell custom travel-planning services and digital itinerary products on
marketplaces like **Fiverr, Etsy, and Gumroad**.

Instead of writing each itinerary from a blank page, RouteCrafter turns a small set
of structured inputs — country, regions, traveler type, trip length, budget, pace,
interests, and brand voice — into a full suite of sellable, editorial,
country-specific deliverables: itineraries, marketplace listing copy, portfolio
image briefs, packing/food/transport guides, and print-ready PDFs.

It is deliberately **country-agnostic**: there is no hardcoded single-country logic.
The same workflow produces a Japan family itinerary, an Italy honeymoon product, or
a budget Thailand backpacking guide.

## Who it's for

- **Itinerary sellers / travel-planning freelancers** who need to ship premium
  products repeatedly and consistently.
- **Small travel brands and creators** building a catalog of itinerary products
  across multiple destinations and traveler types.
- **Anyone** who wants a structured, editorial workflow for turning trip ideas into
  polished, branded deliverables.

## The core problem it solves

Selling itinerary products at scale means producing the same set of assets over and
over: a route matrix, a detailed day-by-day plan, listing copy, FAQs, buyer intake
questions, image briefs, and a branded PDF. Doing this by hand is slow and
inconsistent. RouteCrafter:

1. Captures the trip as **structured configuration** (validated, reusable).
2. Generates every deliverable from that single configuration.
3. Keeps **everything editable and copyable** so you stay in control of the final
   product.
4. Exports to the formats marketplaces and buyers expect (PDF, Markdown, CSV, JSON).

## The two operating modes

RouteCrafter is usable with **zero external dependencies and no API key**, and it
layers optional AI on top.

### Mode 1 — Prompt-output mode (always available, no key)

The built-in generation engine produces:

- **Copy-paste prompts** for any external LLM (ChatGPT, Claude, Gemini, Midjourney,
  etc.). You copy the prompt, run it in your tool of choice, and paste the result
  back into editable fields.
- **Local structured scaffolds** — the app pre-fills itineraries, the route matrix,
  listing copy, and image briefs with sensible defaults so panels are never blank,
  even before you involve any AI.

This mode requires no account, no key, and no network calls to AI providers.

### Mode 2 — Direct AI mode

If you add an API key in **Settings**, RouteCrafter can call the model for you and
drop structured results straight into the workspace. This mode is governed by two
always-on safety rails:

- **Preview before apply** — nothing is written to your project until you review the
  proposed output and confirm.
- **Server OpenAI by default** — authenticated users can run `gpt-5.4` text and
  `gpt-image-2` image generation through the configured server account.
- **Personal-key overrides** — OpenAI, Anthropic, and Gemini keys can override the
  server credential for the selected provider.
- **Cost confirmation** — every AI action shows an estimated USD range and payer
  before the request runs.

Direct AI mode never replaces prompt-output mode; the two coexist on every panel
that supports generation.

See the [AI setup guide](../guides/ai-setup.md) for details.

## Guided production route

Every project is organized around five flexible stages. The route line shows
progress, launch blockers, and the most useful next action without preventing the
seller from exploring another stage.

| Stage | Outcome |
| --- | --- |
| **Define the Product** | Choose Digital download, Custom service, or Hybrid; select channels, product positioning, trip brief, and output package. |
| **Plan the Editions** | Commit to the exact duration and traveler combinations that will ship. Route concepts are inspiration, not required selections. |
| **Build the Itineraries** | Complete one linked itinerary per planned edition across overview, days, included guides, and quality notes. |
| **Package the Offer** | Create the adaptive marketplace listing, service packages/intake, portfolio visuals, PDF, spreadsheet, and production prompts. |
| **Review and Publish** | Resolve blockers, review recommendations, confirm live-data and backup checks, then mark the project Ready to sell. |

The workspace supports three offer models:

- **Digital download:** a prebuilt itinerary sold through Etsy, Gumroad, or direct.
- **Custom service:** personalized planning sold through Fiverr or direct.
- **Hybrid:** a downloadable base product with paid personalization.

The offer model changes listing and package requirements. Selected outputs are
commitments: optional assets do not become launch blockers until they are added to
the output package.

## Design philosophy

- **Editorial, not generic SaaS.** Warm ivory paper, sage/forest/terracotta/teal/gold
  accents, serif display headings (Fraunces) and a clean sans body (Inter).
- **Boutique editorial feel** — document-like sections, restrained cards, fine
  rules, and a route-map progression.
- See [UI & design system](../architecture/ui-and-design-system.md) for the tokens.

## Core principles

These principles are enforced throughout the product and codebase:

1. **Templates stay separate from UI.** All generation logic is pure and lives in
   `src/lib/generation`, with no React imports.
2. **Everything generated is editable and copyable.** Generation gives you a
   starting point, never a locked output.
3. **No hardcoded single-country logic.** Country, regions, and style flow through
   configuration into every template.
4. **Never fabricate live data.** The product never invents real-time prices,
   opening hours, ticket or hotel availability. Itinerary, PDF, food, and transport
   outputs carry explicit "verify before delivery" reminders. This is implemented as
   shared realism rules — see [Generation engine](../architecture/generation-engine.md).
5. **Fully usable without an API key.** AI is an accelerant, never a requirement.

## Where data lives

RouteCrafter is a client-side app. Your projects are stored in the browser's
`localStorage` (key `routecrafter:v1`), and AI settings under a separate key. There
is no server-side database and no account system. You can move work between browsers
or back it up using JSON from Project actions or Review and Publish. See
[State & persistence](../architecture/state-and-persistence.md).
