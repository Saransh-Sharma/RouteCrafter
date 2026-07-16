# Series engine — cross-country product multiplication

The headline feature: take one itinerary product and recreate it for N other
countries, each becoming an independently editable, sellable product that
shares the original's structure, editions, brand voice, and listing format.

## Concepts

- **Series** — a family of country versions of one product. Membership is an
  embedded `series` object on the project blob (`seriesLinkSchema`:
  `seriesId`, `seriesName`, `role: "original" | "variant"`,
  `sourceProductId`, `addedAt`). No new tables — grouping is derived
  client-side and the shelf can group by series.
- Two entry flows share one pipeline:
  - **Multiply** (product editor header): clone a finished product to new
    countries.
  - **Series (multi-country)** mode on `/products/new`: one spec + N
    countries; the first country is generated in place as the series
    original (`generateSource: true`).

## Pipeline (per country, sequential)

Implemented in `src/lib/series/engine.ts` (client-side), reusing the existing
AI infrastructure end to end (`/api/ai/text`, credential resolution, run
ledger, pricing).

1. **Structural clone — no AI, instant.** `cloneProductSkeleton`
   (`src/lib/series/clone.ts`) copies offer model, channels, outputs,
   editions (routes emptied, `sourceEditionId` lineage), brand style, and the
   trip brief's style/pace/budget; blanks all country content. The clone is
   **persisted immediately** — the failure-isolation anchor. Any later step
   can fail; retry re-runs only steps whose output is missing.
2. **Route transposition — new `transpose` AI task.**
   `buildRouteTranspositionPrompt` (`src/lib/ai/transpose.ts`) sends the
   source route as a compact table (city / nights / arrive-by) with hard
   rules: same stop count (±1), exact night budget, real canonical
   destinations in the target country, transport modes matched to reality.
   The first edition's response also names the product and sets
   regions/positioning/audience. Validated by `routeTranspositionSchema`.
3. **Itinerary — existing chunked pipeline.**
   `requestStructuredItineraryDraft` (overview call + per-4-day chunks with
   truncation-splitting) runs against a locally scaffolded itinerary synced
   to the transposed route. `buildStyleReferenceDigest` passes a compact
   digest of the source itinerary (title/subtitle pattern, one sample day's
   density, guide tone) as the focus so voice matches without shipping the
   whole source JSON.
4. **Listing.** `buildListingPrompt` with `buildListingReferenceFocus` — the
   source listing's structure/voice as reference, selling the new country.
5. **Image prompts — local and free.** `buildImagePrompts` regenerates the
   five portfolio briefs from the new country context. No API call.
6. **Images — opt-in only.** When (and only when) the user picks "Generate
   via API" in the dialog, the engine generates the PDF cover + 5 portfolio
   visuals per country. The default is **Prompts only**: creators copy the
   country-adapted prompts into any external image tool and upload results
   through the Media drawer / ImageSlot.

## Cost & safety

- `estimateSeriesCost` (`src/lib/series/estimate.ts`) itemizes the run
  upfront: per edition (route + overview + day chunks) + listing, × N
  countries; image cost appears only when opted in. Shown in the dialog
  before anything is billed.
- Job state lives in a non-persisted Zustand slice
  (`src/lib/store/series-job-store.ts`). On reload, the board
  (`/series/[id]`) reconstructs progress from the persisted drafts
  (`reconstructJob`) and offers Retry; steps are idempotent.
- Failures isolate per country: one country failing marks its card failed
  and the loop continues.

## Testing

- Unit: `src/lib/series/clone.test.ts` (structure preserved / content
  blanked / lineage), `src/lib/ai/transpose.test.ts` (prompt constraints,
  schema), `src/lib/series/estimate.test.ts` (linear scaling, opt-in image
  itemization).
- E2E: `e2e/series-generation.spec.ts` with a fully mocked provider — happy
  path into the generated product, per-country failure + retry, and an
  assertion that **zero** image API calls happen unless opted in.
- Before relying on a new provider/model in production, run one real
  single-country Multiply on a cheap product and review route plausibility
  and voice match.
