# Getting Started

This guide gets RouteCrafter running locally and explains where your data lives.

## Prerequisites

- **Node.js 20** (the CI pipeline runs on Node 20; see
  [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)).
- **npm** (the repo uses `package-lock.json`).
- A modern browser. The app stores data in `localStorage`, so use a normal (non
  private) browser profile if you want your projects to persist.

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

RouteCrafter uses server-side authentication, while project and AI settings stay
in the browser:

| Data | Storage key | Notes |
| --- | --- | --- |
| Projects (all your work) | `routecrafter:v1` | Managed by the Zustand projects store. |
| AI provider keys + defaults | `routecrafter:ai-settings:v1` | Managed by the AI settings store; keys are stored in plaintext locally — see the [AI setup guide](ai-setup.md#security). |

Implications:

- The three configured accounts share the same browser-local projects, activity,
  and AI settings when they use the same browser profile. Accounts provide access
  control and activity attribution, not private per-user workspaces.
- The displayed `admin` and `editor` roles are descriptive labels only; they do
  not currently grant different permissions.
- Clearing site data, using a different browser, or a private window will lose or
  hide your projects.
- To back up or transfer work, use **JSON export/import** in the workspace
  (see the [user guide](user-guide.md#export)).
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

1. From the **Dashboard**, click **New project** (or open one of the seeded demo
   projects).
2. Fill in the create-project form (name, country, regions, positioning, audience).
3. You land in the **project workspace**. Work through the tabs left to right — the
   [user guide](user-guide.md) walks through each one.
4. (Optional) Add an AI provider key in **Settings** to enable direct AI drafting —
   see the [AI setup guide](ai-setup.md). This is never required; every panel works
   with copy-paste prompts.

## Next.js 16 note

This repository pins **Next.js 16**, which differs from earlier versions. Before
changing routing, layouts, server/client boundaries, or API routes, read the bundled
guides in `node_modules/next/dist/docs/` as instructed in
[`AGENTS.md`](../../AGENTS.md). See also
[Contributing](../development/contributing.md).
