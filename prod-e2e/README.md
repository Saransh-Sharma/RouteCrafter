# Production AI audit (manual only)

This suite signs into the **live** RouteCrafter deployment, upserts persistent
audit projects, and runs real server-funded OpenAI text and image requests.

**Do not run this in CI.** It is excluded from `.github/workflows/ci.yml` and
requires an explicit opt-in.

## Prerequisites

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `ROUTECRAFTER_PROD_AUDIT` | **Yes** | — | Must be `1` or the suite refuses to start |
| `ROUTECRAFTER_PROD_PASSWORD` | **Yes** | — | Production account password |
| `ROUTECRAFTER_PROD_USERNAME` | No | `saransh` | Login username |
| `ROUTECRAFTER_PROD_BASE_URL` | No | `https://route-crafter.vercel.app` | Target deployment |

## Run

```bash
ROUTECRAFTER_PROD_AUDIT=1 \
ROUTECRAFTER_PROD_PASSWORD='your-password' \
npm run test:e2e:prod
```

Optional overrides:

```bash
ROUTECRAFTER_PROD_USERNAME=admin \
ROUTECRAFTER_PROD_BASE_URL=https://your-preview.vercel.app \
npm run test:e2e:prod
```

## What it does

1. Signs in through the production login UI once per run.
2. Verifies `/api/ai/config` exposes `gpt-5.4` and `gpt-image-2` (no `mini`).
3. Creates or updates **15 kept projects** named `Prod E2E Keep - {country} - {variation} - {date}` with ids `prod-e2e-keep-*`.
4. For each scenario, exercises text AI (Prompt Studio, listing, itinerary) and image AI (hero, secondary portfolio, PDF cover).
5. Attaches JSON diagnostics (network, console errors, issue ledger) to the Playwright report.

Expect **~90+ billed AI calls** per full pass (15 scenarios × 3 text + 3 image actions). Budget roughly **$5–$25+** depending on token/image usage and provider pricing — treat this as a paid smoke audit, not a free test.

Runtime can exceed **1 hour**; Playwright timeout is 4 hours. Traces are always captured (`trace: "on"`).

## Cleanup

Kept projects are intentional fixtures for repeat audits. Delete stale rows from the production dashboard when they are no longer needed:

- Filter projects whose names start with **`Prod E2E Keep -`**
- Or delete by id prefix **`prod-e2e-keep-`**

Re-running on the same calendar day updates the same dated project ids instead of creating duplicates.

## Safety

- Never commit production passwords or store them in CI secrets for default pipelines.
- Prefer a dedicated audit account if billing isolation matters.
- Review Playwright attachments before sharing reports — request bodies redact `apiKey`, but responses may contain generated content.
