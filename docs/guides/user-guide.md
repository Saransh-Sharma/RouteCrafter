# User Guide

RouteCrafter turns a destination idea into a reviewed itinerary offer. Every
generation feature works without an API key; optional AI results are previewed
before application.

## Start a project

From **New project**, enter the product name, destination, buyer, positioning, and
initial travel styles. Choose the offer model:

- **Digital download** for a prebuilt Etsy, Gumroad, or direct-sale product.
- **Custom service** for Fiverr or direct personalized planning after the buyer
  sends a brief.
- **Hybrid** for a downloadable base itinerary with paid personalization on top.

Choose only the output files and sales assets you intend to finish. Marketplace
listing is required for every offer.

## Follow the production route

The workspace has five clickable stages. They are not locked, but RouteCrafter
explains when an action is missing useful prerequisites. The route line and project
header show derived progress and the recommended next action. Progress is based on
real project content and review confirmations, not manual completion toggles.

Navigation is shareable and restorable through query parameters, for example:

```text
/projects/<id>?stage=build&edition=<edition-id>&tool=days
```

The `stage` parameter opens one of `define`, `plan`, `build`, `package`, or
`publish`. Build-stage links can include an `edition` id and editor `tool`.
Package-stage links can include a package `tool` such as `listing`, `visuals`,
`pdf`, `exports`, or `prompts`.

RouteCrafter separates two kinds of issues:

- **Blockers** prevent a project from being marked Ready to sell.
- **Recommended improvements** improve quality but do not universally block
  launch.

### 1. Define the Product

Define turns the travel idea into a commercial product brief. Confirm the offer
model and sales channels first because they affect later listing, package, and
intake requirements. Complete the destination, target buyer, product promise,
brand voice, and primary trip configuration.

What to do:

- Choose **Digital download**, **Custom service**, or **Hybrid offer**.
- Select sales channels: Fiverr, Etsy, Gumroad, and/or direct sales.
- Fill the product name, destination country, target buyer, brand voice, and
  product promise.
- Open the deep trip brief for pace, budget, logistics, interests, constraints,
  and advanced brand details.
- Select only the output package you intend to finish.

The output package is grouped into:

- **Core files:** PDF and spreadsheet.
- **Included guides:** food, packing, and booking checklist.
- **Sales assets:** marketplace listing and portfolio visuals.

How readiness is decided:

- The project needs a destination country.
- The project needs a primary trip configuration.
- Define progress also counts regions or cities, positioning, target audience,
  sales channels, and the required marketplace listing output.
- Marketplace listing is always required and cannot be deselected.

Common pitfalls:

- Selecting extra outputs creates more publish work. If you select portfolio
  visuals, all five visual briefs must be finalized later.
- Service and hybrid offers need buyer-facing intake and package details in the
  Package stage.
- The trip form auto-saves, so review each field after pasting generated content.

Legacy Map Pins selections remain visible after import but are not offered for new
projects because RouteCrafter does not yet generate a map-pin artifact.

### 2. Plan the Editions

Project durations and traveler types describe possible coverage. Planned editions
are the exact combinations you commit to shipping.

What to do:

- Add the duration and traveler type combination most likely to sell.
- Use custom days only when the standard duration label is not precise enough.
- Review the route concepts for inspiration. They are not required selections.
- Add more editions only when you intend to complete each one.

How readiness is decided:

- Plan is complete when at least one planned edition exists.
- RouteCrafter prevents duplicate duration/traveler combinations.
- Each planned edition becomes a Build-stage obligation.

Additional editions become publish blockers until their itineraries are completed
or the editions are removed.

Common pitfalls:

- Durations and traveler types in the project brief are broad ideas. Planned
  editions are the actual products that must ship.
- Removing an edition does not delete an already-created itinerary; it removes the
  edition from the production plan.

### 3. Build the Itineraries

Use the persistent edition switcher to create or continue one itinerary per planned
edition. Itineraries are linked by edition id, not inferred from text labels.

The editor is organized into:

- **Overview:** title, audience, overview, and route summary.
- **Days:** the exact number of day plans, each with title, base, and meaningful
  activity content.
- **Included guides:** guide fields selected in the output package.
- **Quality notes:** verification notes and optional depth.

What to do:

- Start the selected edition to create the correct number of editable days.
- Complete the overview: title, audience, overview, and route summary.
- Fill every day with a title, base, and at least one meaningful activity field.
- Complete food, packing, and booking checklist fields when those outputs were
  selected in Define.
- Add personalization questions when the offer is a service or hybrid.
- Add verification notes so buyers understand what needs live checking.

How readiness is decided:

- Every planned edition needs a linked itinerary.
- The itinerary day count must exactly match the edition duration or custom day
  count.
- Title, overview, audience, route summary, each day title, each day base, and
  day activity content are required.
- Selected included guides become blockers if their matching itinerary fields are
  empty.
- Verification notes are required for every itinerary.

Common pitfalls:

- Adding an edition in Plan without completing it in Build blocks Publish.
- Rainy-day alternatives and booking notes are recommended improvements when they
  are thin, but they are not universal launch blockers.
- Images and upgrades can improve the PDF and sales presentation, but the core
  readiness checks focus on usable itinerary content.

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

What to do:

- Finish marketplace title options, tags, short description, long description,
  and delivery notes.
- For service and hybrid offers, add at least one priced package and buyer
  requirements.
- For service and hybrid offers, make sure the itinerary includes
  personalization questions.
- If portfolio visuals are selected, create five briefs and mark all five final.
- If PDF or spreadsheet outputs are selected, review the generated delivery files
  after the Build-stage content is ready.
- Use Production tools for copy-paste prompt templates and optional AI drafting.

How readiness is decided:

- Listing copy requires at least one title, at least one tag, a short
  description, a full description, and delivery notes.
- Service and hybrid offers require at least one package with both name and price,
  plus at least one buyer requirement.
- Selected portfolio visuals require exactly five image prompts and all five must
  be marked final. Adding actual generated images is recommended, not required.
- Selected PDF and spreadsheet outputs depend on at least one completed itinerary.

Common pitfalls:

- Package requirements adapt to the offer model. A digital download can be simpler
  than a service, but it still needs clear delivery notes.
- The Package stage does not create more itinerary content; fix itinerary blockers
  in Build.
- Optional tools shown as unselected can be enabled from Define by adding that
  output to the package.

### 5. Review and Publish

Review is divided into **Blockers**, **Recommended improvements**, and completed
checks. Every issue links back to its exact stage, edition, or package tool.

Before marking a project **Ready to sell**, confirm:

1. Live prices, hours, tickets, and availability are not represented as guaranteed.
2. Final files and listing presentation were reviewed.
3. The project is browser-local and a JSON backup was created.

How readiness is decided:

- All Define, Plan, Build, and Package blockers must be resolved.
- All three final confirmations must be checked.
- Clicking **Mark ready to sell** sets the project status to **Ready to sell** and
  records the confirmation time.

Readiness-sensitive edits clear these confirmations and return a ready project to
In progress. AI settings, activity history, and export preferences do not invalidate
readiness. Duplicated projects always start with fresh confirmations.

Common pitfalls:

- Publish cannot verify live travel data. It only asks you to confirm that prices,
  hours, tickets, and availability are framed as details to verify.
- A JSON backup is part of the final checklist because projects are stored in the
  browser.
- If a blocker appears in Publish, use its link instead of hunting through the
  workspace manually.

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
