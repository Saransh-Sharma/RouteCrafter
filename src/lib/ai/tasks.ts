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
  const ctx = buildContext(project);
  return `Draft or improve a structured RouteCrafter itinerary.

Project configuration:
${configBlock(ctx)}

Requested focus:
${focus || "Build a complete premium day-by-day itinerary."}

Current itinerary, if any:
${current ? JSON.stringify(current, null, 2) : "None"}

Rules:
- Preserve manually edited fields unless the focus requires improvement.
- Every day needs practical morning, lunch, afternoon, evening, dinner, transport, booking, backup, and rationale fields.
- Keep the itinerary sellable, editable, and client-ready.
- ${REALISM}

${jsonOnly("ItineraryOutput")}`;
}

export function buildDayPrompt(
  project: Project,
  itinerary: ItineraryOutput,
  day: DayPlan,
  focus: string,
): string {
  const ctx = buildContext(project);
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

Rules:
- Return the whole DayPlan object with the same day number.
- Preserve strong existing details while filling weak or empty fields.
- ${REALISM}

${jsonOnly("DayPlan")}`;
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
): string {
  const ctx = buildContext(project);
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
- Avoid fake stock-photo faces, watermarks, visual clutter, neon, and distorted text.

${jsonOnly("PortfolioImagePrompt")}`;
}

export function buildImageGenerationPrompt(
  project: Project,
  source: string,
  purpose: string,
): string {
  const ctx = buildContext(project);
  return `Create one premium RouteCrafter visual asset.

Purpose: ${purpose}
Country/project: ${project.country || project.name}
Brand voice: ${voiceDescription(ctx)}
Trip context:
${configBlock(ctx)}

Visual brief:
${source}

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
  const ctx = buildContext(project);
  return `Improve selected guide fields for a RouteCrafter itinerary.

Project configuration:
${configBlock(ctx)}

Current itinerary:
${JSON.stringify(itinerary, null, 2)}

Focus:
${focus}

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
