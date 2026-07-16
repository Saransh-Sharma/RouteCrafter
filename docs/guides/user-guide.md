# User guide

RouteCrafter turns a destination idea into a sellable itinerary product. This
walkthrough follows the creator loop end to end.

## The shelf (`/`)

Home is your product catalog: image-forward cards with country, status, and
progress. Group by **country** or by **series**, search, import a JSON
backup, or start a new product. "Continue where you left off" jumps back into
the most recently edited product.

## Creating a product (`/products/new`)

Three modes:

- **Start blank** — offer model, name, country, audience, positioning,
  styles, brand voice, and the starter output package.
- **From template** — the template gallery (traveler presets, country
  starters, and templates you saved from any product's actions menu).
- **Series (multi-country)** — one spec plus two or more countries; the
  engine generates every country version in one run. See
  [Multiplying across countries](#multiplying-across-countries).

## The product editor (`/products/[id]`)

A flat editor with four tabs. The header shows the cover band, status,
**Multiply**, **Readiness**, **Export**, and the actions menu (duplicate,
save as template, change cover, delete).

### Trip

The commercial definition: offer model (digital / service / hybrid), sales
channels, product fields, and the output package. Below it, **editions** —
each a committed duration × traveler-type combination with an ordered
nights-per-city route you can adjust on the map. Route concepts suggest
angles; "Apply to itinerary" keeps a linked itinerary in sync after route
changes. The collapsible deep trip brief holds pace, budget, logistics,
interests, and constraints.

### Itinerary

The day-by-day product for one edition at a time (switch with the chips).
"Create this itinerary" scaffolds the right number of days from the route;
AI actions fill or improve sections with a cost estimate up front and a
field-level review before anything is applied. "Local details" adds
web-grounded recommendations per day.

### PDF

A live paged A4 preview with themes (try **Editorial** — it matches the
app), text controls, block editing, and cover/day images. Export produces a
native PDF server-side; native browser print also works.

### Listing

Marketplace copy (titles, tags, descriptions, packages, FAQs, buyer
requirements), portfolio visual briefs, and the **prompt studio** — copy any
production prompt into an external AI and paste the result back, no API key
needed.

## Readiness and export

**Readiness** is a checklist, never a gate: blockers and improvements
deep-link to the tab that owns them, deterministic fixes (like moving live
price/hour claims into verification notes) apply with one click, and the
final confirmations plus "Mark ready to sell" live at the bottom.
**Export** always works: PDF, spreadsheet CSV per edition, listing copy,
Markdown bundle, and a portable JSON backup.

## Multiplying across countries

From any product, **Multiply** opens the country picker. Add countries, keep
**Prompts only** (recommended) or opt into billable API images, review the
itemized cost estimate, and generate. The **series board**
(`/series/[id]`) shows one card per country with a live step checklist —
route, itinerary, listing — plus retry for failures and a link into each
generated product. Every country version is an independent product on the
shelf, grouped under its series.

## Images without the API bill

Every image slot offers, in order: **upload** (or pick from the media
library), **copy prompt** (a self-contained, country-adapted prompt for any
external image tool), and **generate via API** — explicit opt-in behind a
cost confirmation.
