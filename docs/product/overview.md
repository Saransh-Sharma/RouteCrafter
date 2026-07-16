# Product overview

RouteCrafter is the admin panel for a travel-itinerary product business: a
private studio where a creator turns trip ideas into sellable products —
premium day-by-day itineraries, print-ready PDFs, and marketplace listing
assets for Fiverr, Etsy, Gumroad, and direct sales.

## Who it is for

- Itinerary sellers and travel-planning freelancers building a catalog
- Small travel brands producing country-specific digital products
- A small, named team sharing one cloud workspace (password / email OTP)

## The creator loop

The whole app is organized around one loop:

**Create → Generate → Design → List → Export → Multiply**

1. **Create** a product on `/products/new` — blank, from a template, or an
   entire multi-country series from a single spec.
2. **Generate** in the product editor (`/products/[id]`):
   - **Trip** tab — offer model (digital / service / hybrid), sales
     channels, product promise, output package, and the committed
     **editions**: duration × traveler type combinations, each with an
     ordered nights-per-city route on a map.
   - **Itinerary** tab — the day-by-day product, scaffolded locally and
     filled by AI (or by copy-paste prompts, no key needed), with grounded
     "local details" research per day.
3. **Design** the deliverable in the **PDF** tab — live paged preview,
   themes (including the app-matching *Editorial* theme), text and block
   editing, cover image.
4. **List** it in the **Listing** tab — marketplace copy, packages and
   intake for service offers, portfolio visual briefs, and the prompt studio
   for producing any artifact with an external AI.
5. **Export** from the header — PDF, spreadsheet CSV, listing copy, Markdown
   bundle, JSON backup. **Readiness** is a checklist beside it: blockers and
   improvements deep-link to the owning tab, with final manual
   confirmations and "Mark ready to sell". It never blocks exporting.
6. **Multiply** — the headline feature. From any product, pick target
   countries and the series engine recreates the product for each one: same
   structure, editions, and voice; new, real destinations. Each country
   version is its own product on the shelf, grouped under the series. See
   [series-engine.md](../architecture/series-engine.md).

## Two operating modes

- **Prompt-output mode** (always available, no API key): every panel can
  produce copy-paste prompts and locally scaffolded structure.
- **Direct AI mode**: server-funded OpenAI by default, or a personal
  OpenAI / Anthropic / Gemini key. Every run shows a cost estimate first and
  previews output before anything is applied.

## Images cost policy

API image generation is expensive, so it is **never** a default:

1. **Upload** — your own file or anything in the media library.
2. **Copy prompt** — every image slot and every series run produces
   country-adapted, self-contained prompts to paste into ChatGPT, Gemini,
   Midjourney, etc., then upload the result. Free.
3. **Generate via API** — explicit opt-in, always behind a cost
   confirmation.

## Principles

- One product = one country; a series multiplies structure across countries.
- Readiness is a checklist, never a gate.
- Everything generated is editable; nothing applies without review.
- Never fabricate live prices, hours, tickets, or availability —
  verification notes ship with every itinerary.
- No hardcoded single-country logic anywhere in the engine.
