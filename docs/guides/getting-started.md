# Getting Started

This guide gets RouteCrafter running locally and explains where your data lives.

## Prerequisites

- **Node.js 24** (the CI pipeline runs on Node 24; see
  [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).
- **npm** (the repo uses `package-lock.json`).
- A modern browser. The app keeps a `localStorage` cache, so use a normal (non
  private) browser profile for the smoothest local editing experience.

## Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

On first run, the app **seeds demo projects** (see
[`src/lib/seed-projects.ts`](../../src/lib/seed-projects.ts)) so you have example
content to explore immediately.

## Available scripts

All scripts are defined in [`package.json`](../../package.json):

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `next dev` | Start the dev server with hot reload. |
| `build` | `next build` | Production build. |
| `start` | `next start` | Serve the production build. |
| `lint` | `eslint` | Lint the codebase. |
| `test` | `vitest run` | Run the unit test suite once. |

To run tests in watch mode during development:

```bash
npx vitest
```

## Where your data lives

RouteCrafter is a single shared workspace backed by the cloud. Projects, their
draft/final state, and uploaded assets live in cloud storage (Postgres + Vercel
Blob) and are shared across every account. The browser keeps a local cache and
your personal AI settings:

| Data | Storage | Notes |
| --- | --- | --- |
| Projects + assets (shared by everyone) | Cloud (Postgres + Vercel Blob) | Authoritative source of truth; mirrored to the `routecrafter:v1` local cache. |
| Local project cache | `routecrafter:v1` | Zustand projects store; reconciled against the cloud on focus and a short poll. |
| Personal AI keys + defaults | `routecrafter:ai-settings:v1` | Private per user. Personal keys are stored in plaintext locally; the server `OPEN_AI_KEY` is never stored here. See the [AI setup guide](ai-setup.md#security). |

Implications:

- Every account sees and can edit the same projects and assets. There are no
  private per-user workspaces; `user_id` is creator/actor attribution only.
- When two people edit the same project, the later save is rejected if it is based
  on a stale revision. A conflict prompt lets you reload the latest version or
  overwrite it with your changes (last-write-wins).
- Personal AI keys, AI provider settings, and UI preferences remain private per
  user and are not shared.
- The displayed `admin` and `editor` roles are descriptive labels only; they do
  not currently grant different permissions.
- Clearing site data only clears the local cache; your shared projects reload from
  the cloud on next sign-in.
- To back up or transfer work, use **JSON export/import** in the workspace
  (see [Local data and backup](user-guide.md#local-data-and-backup)).
- There is a size guard: persisted state is capped (around 4M characters) to avoid
  exceeding browser quotas. Large embedded images (PDF cover/day images) are
  compressed before saving. See
  [State & persistence](../architecture/state-and-persistence.md).

## Authentication configuration

Copy `.env.example` to `.env.local` and configure the JWT secret and account
passwords. Production deployments must also configure:

- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` for durable OTP
  challenges and sliding-window rate limits across Vercel instances.
- `RESEND_API_KEY` and `AUTH_EMAIL_FROM` for OTP delivery.

Development without Upstash uses process-local storage and logs OTP codes to the
server console. Production fails closed when Redis or email delivery is missing.

## First steps

1. From the **shelf** (`/`), click **New product** (or open one of the seeded
   demo products).
2. Fill in the create form (offer model, name, country, regions, positioning,
   audience) — or pick a template, or start a multi-country series.
3. You land in the **product editor**: four flat tabs — **Trip**,
   **Itinerary**, **PDF**, and **Listing** — with **Readiness** and
   **Export** in the header.
4. Confirm that RouteCrafter OpenAI is ready, or optionally add a personal
   provider key override in **Settings** — see the [AI setup guide](ai-setup.md).
   Every panel also works with copy-paste prompts, no key needed.

## Build your first itinerary product

| Tab | What to do |
| --- | --- |
| **Trip** | Choose the offer model and channels, write the product promise, select the output package, and commit at least one **edition** (duration × traveler type) with its route. |
| **Itinerary** | Create the itinerary for each edition, then fill and refine days, guides, and verification notes (AI or copy-paste prompts). |
| **PDF** | Pick a theme, set the cover, adjust text and blocks in the live preview, and export a native PDF. |
| **Listing** | Finish marketplace copy, packages/intake for service offers, and portfolio visual briefs. |

The **Readiness** popover in the header lists remaining blockers and
improvements with deep links, plus the final confirmations and "Mark ready to
sell". It never blocks exporting. When the product is done, use **Multiply**
to recreate it for other countries — see the
[user guide](user-guide.md#multiplying-across-countries).

## Next.js 16 note

This repository pins **Next.js 16**, which differs from earlier versions. Before
changing routing, layouts, server/client boundaries, or API routes, read the bundled
guides in `node_modules/next/dist/docs/` as instructed in
[`AGENTS.md`](../../AGENTS.md). See also
[Contributing](../development/contributing.md).
