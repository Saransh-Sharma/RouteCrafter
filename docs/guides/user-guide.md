# User Guide

RouteCrafter turns a destination idea into a reviewed itinerary offer. Every
generation feature works without an API key; optional AI results are previewed
before application.

## Start a project

From **New project**, enter the product name, destination, buyer, positioning, and
initial travel styles. Choose the offer model:

- **Digital download** for a prebuilt Etsy, Gumroad, or direct-sale product.
- **Custom service** for Fiverr or direct personalized planning.
- **Hybrid** for a downloadable base with paid personalization.

Choose only the output files and sales assets you intend to finish. Marketplace
listing is required for every offer.

## Follow the production route

The workspace has five clickable stages. They are not locked, but RouteCrafter
explains when an action is missing useful prerequisites. The route line and project
header show derived progress and the recommended next action.

Navigation is shareable and restorable through query parameters, for example:

```text
/projects/<id>?stage=build&edition=<edition-id>&tool=days
```

### 1. Define the Product

Confirm the offer model and sales channels first because they change later publish
requirements. Complete the destination, target buyer, product promise, brand voice,
and primary trip configuration.

The trip form auto-saves. Logistics, preferences, constraints, and advanced brand
details are available as deeper sections after the essentials.

The output package is grouped into:

- **Core files:** PDF and spreadsheet.
- **Included guides:** food, packing, and booking checklist.
- **Sales assets:** marketplace listing and portfolio visuals.

Legacy Map Pins selections remain visible after import but are not offered for new
projects because RouteCrafter does not yet generate a map-pin artifact.

### 2. Plan the Editions

Project durations and traveler types describe possible coverage. Planned editions
are the exact combinations you commit to shipping.

Add at least one edition. RouteCrafter prevents duplicate duration/traveler
combinations and shows the workload created by each addition. Each edition includes
two to four route concepts as inspiration. Selecting a concept is optional.

Additional editions become publish blockers until their itineraries are completed
or the editions are removed.

### 3. Build the Itineraries

Use the persistent edition switcher to create or continue one itinerary per planned
edition. Itineraries are linked by edition id, not inferred from text labels.

The editor is organized into:

- **Overview:** title, audience, overview, and route summary.
- **Days:** the exact number of day plans, each with title, base, and meaningful
  activity content.
- **Included guides:** guide fields selected in the output package.
- **Quality notes:** verification notes and optional depth.

The contextual checklist separates blockers from recommendations. Images, upgrades,
rainy-day alternatives, and richer booking notes improve quality but do not block
launch universally.

### 4. Package the Offer

Package uses internal tools instead of adding more global workspace stages:

- **Marketplace listing:** titles, tags, descriptions, and delivery notes.
- **Packages and intake:** service pricing, buyer requirements, and personalization
  questions for Custom service and Hybrid.
- **Portfolio visuals:** five image briefs; all five must be marked final when this
  output is selected. Generated images are optional.
- **PDF presentation:** themed, print-ready itinerary output when selected.
- **Files and spreadsheet:** JSON, Markdown, CSV, and available delivery artifacts.
- **Production tools:** copy-paste prompt templates and optional AI drafting.

Listing requirements adapt to the offer model. Digital products require delivery
and export information. Services require at least one priced package and buyer
intake. Hybrid offers require both.

### 5. Review and Publish

Review is divided into **Blockers**, **Recommended improvements**, and completed
checks. Every issue links back to its exact stage, edition, or package tool.

Before marking a project **Ready to sell**, confirm:

1. Live prices, hours, tickets, and availability are not represented as guaranteed.
2. Final files and listing presentation were reviewed.
3. The project is browser-local and a JSON backup was created.

Readiness-sensitive edits clear these confirmations and return a ready project to
In progress. AI settings, activity history, and export preferences do not invalidate
readiness. Duplicated projects always start with fresh confirmations.

## Project actions

Duplicate, JSON backup/export, delete, and activity history are grouped under
**Project actions** in the workspace header. Auto-save state is shown once in that
header rather than repeated as competing panel-level status.

## Local data and backup

Projects are stored in browser `localStorage` under `routecrafter:v1`. API keys use
a separate settings store and are never included in project exports. Download JSON
regularly from Project actions or Review and Publish, then use **Import project** on
the dashboard to restore or move a project.

## AI usage

Prompt-output mode is always available. Direct AI uses RouteCrafter server OpenAI
when configured, or a personal provider key override from Settings. It shows the
payer and estimated USD range and requires preview before apply.
See [AI setup](ai-setup.md) for provider configuration.
