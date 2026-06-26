import type {
  DayPlan,
  ItineraryMatrix,
  ItineraryOutput,
  MarketplaceListing,
  PortfolioImagePrompt,
  Project,
  TripConfiguration,
} from "@/lib/types";
import {
  configBlock,
  voiceDescription,
} from "@/lib/generation/context";
import { buildContext, imagePromptToText } from "@/lib/generation";
import { NATURAL_LANGUAGE_RULES } from "@/lib/generation/language";
import { editionContextOptions } from "@/lib/workflow";
import { enumValues } from "@/lib/schemas";

const REALISM =
  "Do not invent live hours, prices, ticket availability, hotel availability, or real-time route conditions. Include verification notes where relevant.";

export function jsonOnly(schemaName: string): string {
  return `Return only valid JSON matching the ${schemaName} shape. Do not wrap the JSON in Markdown.`;
}

export function buildBriefExtractionPrompt(
  project: Project,
  brief: string,
): string {
  const ctx = buildContext(project);
  return `Extract a RouteCrafter trip configuration from this buyer/client brief.

Existing project context:
${configBlock(ctx)}

Buyer/client brief:
${brief}

Rules:
- Preserve the user's stated preferences.
- Use only values that fit RouteCrafter's existing option sets where arrays are expected.
- If a field is unknown, use an empty string, empty array, or omit optional customDays.
- ${REALISM}

${jsonOnly("TripConfiguration")}`;
}

export function buildPromptRunPrompt(project: Project, prompt: string): string {
  const ctx = buildContext(project);
  return `Run this RouteCrafter production prompt for ${project.country || "the project"}.

Brand voice: ${voiceDescription(ctx)}

${NATURAL_LANGUAGE_RULES}

Prompt to run:
${prompt}

${REALISM}`;
}

export function buildMatrixPrompt(project: Project, current?: ItineraryMatrix): string {
  const ctx = buildContext(project);
  return `Create a premium itinerary matrix for RouteCrafter.

Project configuration:
${configBlock(ctx)}

Current matrix, if any:
${current ? JSON.stringify(current, null, 2) : "None"}

${NATURAL_LANGUAGE_RULES}

Rules:
- Cover the project's supported durations and traveler types.
- Each cell should have three distinct, sellable variation spines.
- Keep spines concise but specific.
- ${REALISM}

${jsonOnly("ItineraryMatrix")}`;
}

export function buildItineraryPrompt(
  project: Project,
  current?: ItineraryOutput | null,
  focus?: string,
): string {
  const ctx = buildContext(project, editionContextOptions(project, current));
  return `Draft or improve a structured RouteCrafter itinerary.

Project configuration:
${configBlock(ctx)}

Requested focus:
${focus || "Build a complete premium day-by-day itinerary."}

Current itinerary, if any:
${current ? JSON.stringify(current, null, 2) : "None"}

${NATURAL_LANGUAGE_RULES}

Rules:
- Preserve manually edited fields unless the focus requires improvement.
- Preserve itinerary identity fields exactly: id, plannedEditionId, country, duration, travelerType, createdAt, pdfTheme, and coverImage.
- Use exactly one enum value for style, budget, travelerType, and day pace. Do not return comma-separated enum lists.
- Allowed style values: ${enumValues.travelStyle.join(", ")}.
- Allowed budget values: ${enumValues.budget.join(", ")}.
- Allowed travelerType values: ${enumValues.travelerType.join(", ")}.
- Allowed day pace values: ${enumValues.pace.join(", ")}.
- Keep JSON values compact: top-level guide fields should be 2-4 concise sentences, and each day activity field should be 1 concise sentence.
- Return complete JSON only. If detail must be reduced to fit, shorten field values rather than omitting closing braces or returning partial JSON.
- Every day needs practical morning, lunch, afternoon, evening, dinner, transport, booking, backup, and rationale fields.
- Keep the itinerary sellable, editable, and client-ready.
- ${REALISM}

${jsonOnly("ItineraryOutput")}`;
}

export function buildItineraryOverviewPrompt(
  project: Project,
  current: ItineraryOutput,
  focus?: string,
): string {
  const ctx = buildContext(project, editionContextOptions(project, current));
  return `Draft or improve only the non-day fields for a RouteCrafter itinerary.

Project configuration:
${configBlock(ctx)}

Requested focus:
${focus || "Build a complete premium itinerary overview and guide sections."}

Current itinerary shell:
${JSON.stringify(
  {
    title: current.title,
    subtitle: current.subtitle,
    country: current.country,
    duration: current.duration,
    travelerType: current.travelerType,
    style: current.style,
    budget: current.budget,
    overview: current.overview,
    whoFor: current.whoFor,
    routeSummary: current.routeSummary,
    bestStayAreas: current.bestStayAreas,
    foodGuide: current.foodGuide,
    transportGuide: current.transportGuide,
    packingList: current.packingList,
    etiquetteSafety: current.etiquetteSafety,
    bookingChecklist: current.bookingChecklist,
    personalizationQuestions: current.personalizationQuestions,
    verificationNotes: current.verificationNotes,
  },
  null,
  2,
)}

${NATURAL_LANGUAGE_RULES}

Rules:
- Return only the fields shown above. Do not include days.
- Preserve country, duration, and travelerType exactly.
- Use exactly one enum value for style and budget. Do not return comma-separated enum lists.
- Allowed style values: ${enumValues.travelStyle.join(", ")}.
- Allowed budget values: ${enumValues.budget.join(", ")}.
- Keep each guide field compact: 2-4 concise sentences or a short practical checklist.
- ${REALISM}

${jsonOnly("ItineraryOverviewChunk")}`;
}

export function buildItineraryDaysPrompt({
  project,
  itinerary,
  days,
  focus,
}: {
  project: Project;
  itinerary: ItineraryOutput;
  days: DayPlan[];
  focus?: string;
}): string {
  const ctx = buildContext(project, editionContextOptions(project, itinerary));
  const dayNumbers = days.map((day) => day.day);
  return `Draft or improve only days ${dayNumbers.join(", ")} for a RouteCrafter itinerary.

Project configuration:
${configBlock(ctx)}

Itinerary context:
${JSON.stringify(
  {
    title: itinerary.title,
    duration: itinerary.duration,
    travelerType: itinerary.travelerType,
    style: itinerary.style,
    budget: itinerary.budget,
    routeSummary: itinerary.routeSummary,
  },
  null,
  2,
)}

Requested focus:
${focus || "Build complete premium day plans."}

Current days:
${JSON.stringify(days, null, 2)}

${NATURAL_LANGUAGE_RULES}

Rules:
- Return an object with a "days" array only.
- Return exactly ${days.length} day objects, in this order: ${dayNumbers.join(", ")}.
- Preserve each day number exactly.
- Every day needs concise morning, lunch, afternoon, evening, dinner, transportNotes, bookingNotes, lowEnergyAlternative, rainyDayAlternative, and whyThisWorks fields.
- Use exactly one allowed pace value when pace is included: ${enumValues.pace.join(", ")}.
- Keep each activity field to 1 concise sentence so the JSON always finishes.
- ${REALISM}

${jsonOnly("{ days: DayPlan[] }")}`;
}

export function buildDayPrompt(
  project: Project,
  itinerary: ItineraryOutput,
  day: DayPlan,
  focus: string,
): string {
  const ctx = buildContext(project, editionContextOptions(project, itinerary));
  return `Improve one day inside a RouteCrafter itinerary.

Project configuration:
${configBlock(ctx)}

Itinerary:
${JSON.stringify(
  {
    title: itinerary.title,
    duration: itinerary.duration,
    travelerType: itinerary.travelerType,
    style: itinerary.style,
    routeSummary: itinerary.routeSummary,
  },
  null,
  2,
)}

Current day:
${JSON.stringify(day, null, 2)}

Requested focus:
${focus}

${NATURAL_LANGUAGE_RULES}

Rules:
- Return the whole DayPlan object with the same day number.
- Preserve strong existing details while filling weak or empty fields.
- ${REALISM}

${jsonOnly("DayPlan")}`;
}

/**
 * Grounded counterpart to REALISM for the Local-details page: real named venues
 * ARE wanted (web search supplies them), but live data still must not be
 * fabricated and each pick carries a verify caveat.
 */
const GROUNDED_REALISM =
  "Recommend only REAL, currently-operating, specifically-named places that exist in or very near the stated base city — never invented or composite venues. Prefer well-reviewed, locally-loved spots over tourist traps. Do not state exact opening hours, prices, or live availability as fact; instead give a rough price band and a short caveat telling the buyer to verify hours, prices, bookings, and availability before travel. Cite a source (a URL or the title of a reputable guide/listing) for each recommendation.";

function dayPlanSummary(day: DayPlan): string {
  return (
    [
      day.morning && `Morning: ${day.morning}`,
      day.lunch && `Lunch: ${day.lunch}`,
      day.afternoon && `Afternoon: ${day.afternoon}`,
      day.evening && `Evening: ${day.evening}`,
      day.dinner && `Dinner: ${day.dinner}`,
    ]
      .filter(Boolean)
      .join("\n") || "No fixed plan yet."
  );
}

/**
 * Pass 1 of the two-pass "Local details" flow: a web-search-grounded research
 * brief (prose) for one day's base city. Intentionally omits REALISM's
 * "do not name places" stance and instructs live grounding instead.
 */
export function buildDayDetailsResearchPrompt({
  project,
  itinerary,
  day,
}: {
  project: Project;
  itinerary: ItineraryOutput;
  day: DayPlan;
}): string {
  const ctx = buildContext(project, editionContextOptions(project, itinerary));
  // Prefer a concrete city anchor; fall back to country, never the prose
  // routeSummary (a poor grounding target for a venue search).
  const base = day.base || itinerary.country || project.country;
  return `Use web search to research REAL local recommendations for Day ${day.day} of a trip, based in ${base}.

Traveler & trip context:
${configBlock(ctx)}

This day's existing plan (complement it — do not just repeat these):
${dayPlanSummary(day)}

Research and list, for ${base} (or immediately adjacent areas the traveler would realistically reach this day):
- Restaurants & cafes: a few specific, currently-open spots that fit the traveler's food preferences and budget.
- Stays: a few specific hotels/guesthouses in good neighborhoods for this day's base.
- Activities & experiences: specific things to do beyond the fixed plan.
- Shopping: specific markets, streets, or stores worth a stop.
- Local trivia: 2-4 short, genuinely interesting, factual notes about this place (history, culture, etiquette, food origin) — contextual to where the traveler is this day.

For every place, capture: name, neighborhood/area, a short tag (e.g. izakaya, design hotel), one line on why it fits THIS traveler, a rough price band where relevant, a source (URL or guide title), and a one-line verify caveat.

${NATURAL_LANGUAGE_RULES}

${GROUNDED_REALISM}

Write a concise, well-organized research brief in prose/bullets. Do not output JSON yet.`;
}

/**
 * Pass 2 of the two-pass flow: convert the grounded research brief into strict
 * DayDetails JSON. No web search here, so JSON reliability matches every other
 * structured task.
 */
export function buildDayDetailsFormatPrompt(researchText: string): string {
  return `Convert this researched local-recommendations brief into RouteCrafter DayDetails JSON.

Research brief:
${researchText}

Rules:
- Only include places that appear in the brief. Do not invent new venues or sources.
- Map each place to { name, area, category, whyItFits, priceBand, source, caveat }.
- restaurants, stays, activities, shopping are arrays of that shape; trivia is an array of { text, source }.
- Carry each place's cited source URL or guide title into "source". Keep "caveat" to one short verify line.
- Every recommendation MUST carry a "source" drawn from the brief. If a place has no citable source in the brief, omit it rather than guessing a source.
- Keep each field to one concise sentence or phrase so the JSON always finishes.
- Omit a section (use an empty array) rather than padding it with weak or generic entries.

${jsonOnly("DayDetails")}`;
}

export function buildListingPrompt(
  project: Project,
  current?: MarketplaceListing | null,
  focus?: string,
  tone?: string,
): string {
  const ctx = buildContext(project);
  return `Create or improve marketplace listing copy for RouteCrafter.

Project configuration:
${configBlock(ctx)}

Marketplace tone:
${tone || "Premium concierge"}

Requested focus:
${focus || "Improve the complete listing."}

Current listing, if any:
${current ? JSON.stringify(current, null, 2) : "None"}

${NATURAL_LANGUAGE_RULES}

Rules:
- Keep titles marketplace-ready and specific to ${project.country || "the destination"}.
- Keep buyer requirements practical and complete.
- Avoid fake guarantees, live availability, or unverifiable claims.
- ${REALISM}

${jsonOnly("MarketplaceListing")}`;
}

export function buildImagePromptImprovementPrompt(
  project: Project,
  prompt: PortfolioImagePrompt,
  extraCities: string[] = [],
): string {
  const ctx = buildContext(project, { extraCities });
  return `Improve this RouteCrafter portfolio image prompt.

Project configuration:
${configBlock(ctx)}

Current image prompt:
${JSON.stringify(prompt, null, 2)}

Current copy-paste prompt:
${imagePromptToText(prompt)}

Rules:
- Keep the same prompt kind.
- Make the visual direction more specific and country-accurate.
- Keep overlay text short and legible.
- Keep textOverlay wording plain and concrete; avoid AI-style marketing phrasing.
- Avoid fake stock-photo faces, watermarks, visual clutter, neon, and distorted text.

${jsonOnly("PortfolioImagePrompt")}`;
}

export type ImageOrientation = "portrait" | "landscape" | "square";

const IMAGE_FORMAT_GUIDANCE: Record<ImageOrientation, string> = {
  portrait:
    "Vertical portrait, 2:3 ratio (1024x1536), full-bleed to all edges. Compose like a premium magazine/book cover: place the hero subject in the upper two-thirds and keep the LOWER THIRD calm and uncluttered (open sky, water, wall, or soft gradient) as negative space reserved for an overlaid title. Do not render any text, logos, or busy detail in the bottom third.",
  landscape:
    "Horizontal landscape, 3:2 ratio (1536x1024), full-bleed edge-to-edge. A single cinematic editorial travel photograph that fills the entire frame. No borders, frames, captions, collage panels, or text.",
  square:
    "Square, 1:1 ratio (1024x1024), full-bleed. Clean centered editorial composition.",
};

export function buildImageGenerationPrompt(
  project: Project,
  source: string,
  purpose: string,
  extraCities: string[] = [],
  orientation: ImageOrientation = "square",
): string {
  const ctx = buildContext(project, { extraCities });
  const brief =
    source.length > 4000
      ? `${source.slice(0, 4000)}\n...[truncated]`
      : source;
  return `Create one premium RouteCrafter visual asset.

Purpose: ${purpose}
Country/project: ${project.country || project.name}
Brand voice: ${voiceDescription(ctx)}
Trip context:
${configBlock(ctx)}

Visual brief:
${brief}

Format & composition:
${IMAGE_FORMAT_GUIDANCE[orientation]}

Style:
Warm ivory editorial travel-studio aesthetic, sage and forest green, terracotta, muted gold, premium PDF mockup energy, clean composition, crisp readable short text only if needed.

Negative guidance:
No neon, no purple AI glow, no watermark, no fake stock-photo faces, no distorted text, no incorrect country landmarks, no busy collage.`;
}

export function buildGuidePrompt(
  project: Project,
  itinerary: ItineraryOutput,
  focus: string,
): string {
  const ctx = buildContext(project, editionContextOptions(project, itinerary));
  return `Improve selected guide fields for a RouteCrafter itinerary.

Project configuration:
${configBlock(ctx)}

Current itinerary:
${JSON.stringify(itinerary, null, 2)}

Focus:
${focus}

${NATURAL_LANGUAGE_RULES}

Rules:
- Return the whole ItineraryOutput object.
- Preserve existing high-quality content.
- Fill relevant guide fields with practical, buyer-ready copy.
- ${REALISM}

${jsonOnly("ItineraryOutput")}`;
}

export function tripConfigCurrentValue(config: TripConfiguration): string {
  return JSON.stringify(config, null, 2);
}
