import { z } from "zod";
import type {
  ItineraryOutput,
  PlannedEdition,
  Project,
  RouteStop,
} from "@/lib/types";
import { transportModeEnum } from "@/lib/schemas";
import { editionDayCount, editionRoute } from "@/lib/editions";
import { jsonOnly } from "./tasks";

const REALISM =
  "Do not invent live hours, prices, ticket availability, hotel availability, or real-time route conditions. Include verification notes where relevant.";

/**
 * Country transposition: adapt a proven product's structure to a new
 * country. The route step returns the product identity + an ordered route;
 * the itinerary and listing content then flow through the existing chunked
 * pipelines with a style reference so voice and density match the original.
 */

export const routeTranspositionSchema = z.object({
  name: z.string().min(1),
  regions: z.array(z.string()).default([]),
  positioning: z.string().default(""),
  targetAudience: z.string().default(""),
  route: z
    .array(
      z.object({
        city: z.string().min(1),
        nights: z.number().int().min(0),
        arriveBy: transportModeEnum.optional(),
      }),
    )
    .min(1),
});

export type RouteTransposition = z.infer<typeof routeTranspositionSchema>;

function routeTable(route: RouteStop[]): string {
  if (!route.length) return "None — design the canonical route from scratch.";
  return route
    .map(
      (stop, index) =>
        `${index + 1}. ${stop.city} — ${stop.nights} night${stop.nights === 1 ? "" : "s"}${
          stop.arriveBy ? ` (arrive by ${stop.arriveBy})` : ""
        }`,
    )
    .join("\n");
}

export function buildRouteTranspositionPrompt({
  source,
  edition,
  sourceItinerary,
  targetCountry,
}: {
  source: Project;
  edition: PlannedEdition;
  sourceItinerary?: ItineraryOutput | null;
  targetCountry: string;
}): string {
  const route = editionRoute(source, edition);
  const nights = editionDayCount(edition);
  return `You are adapting a proven, selling travel itinerary product to a new country. Preserve the product's structure, rhythm, and brand promise exactly; replace all destination content.

Source product:
- Name: ${source.name}
- Country: ${source.country || "unknown"}
- Positioning: ${source.positioning || "(none)"}
- Audience: ${source.targetAudience || "(none)"}
- Who it is for: ${sourceItinerary?.whoFor || "(none)"}
- Edition: ${edition.customDays ? `${edition.customDays} days` : edition.duration} · ${edition.travelerType}

Source route (${nights} total nights):
${routeTable(route)}

Target country: ${targetCountry}

Rules:
- Keep the same number of stops as the source route, or one more/fewer only when the target country's geography demands it.
- Distribute exactly ${nights} nights across the stops.
- Anchor every stop on a real, canonical destination in ${targetCountry} — no invented places, no places outside ${targetCountry}.
- Match transport modes to reality: swap train legs to bus, car, or flight where the target country's rail network is weak.
- "name" should follow the source name's pattern with ${targetCountry} in place of ${source.country || "the source country"}.
- "positioning" and "targetAudience" keep the source's promise and buyer, re-expressed for ${targetCountry}.
- "regions" lists the route's main areas in order.
- ${REALISM}

${jsonOnly("RouteTransposition { name, regions, positioning, targetAudience, route: [{ city, nights, arriveBy? }] }")}`;
}

/**
 * A compact digest of the source itinerary passed as the generation focus so
 * transposed content matches the original's voice and density without
 * shipping the whole source JSON in every chunk.
 */
export function buildStyleReferenceDigest(
  source: ItineraryOutput | undefined | null,
): string | undefined {
  if (!source) return undefined;
  const sampleDay = source.days.find(
    (day) => day.morning && day.afternoon && day.evening,
  );
  const parts = [
    "Match the structure, voice, and level of detail of this reference product (from its original country — do NOT reuse its places):",
    source.title ? `Reference title pattern: "${source.title}"` : "",
    source.subtitle ? `Reference subtitle pattern: "${source.subtitle}"` : "",
    source.overview
      ? `Reference overview tone: ${source.overview.slice(0, 400)}`
      : "",
    sampleDay
      ? `Reference day density — morning: "${sampleDay.morning}" / afternoon: "${sampleDay.afternoon}" / evening: "${sampleDay.evening}"`
      : "",
    source.foodGuide
      ? `Reference guide tone: ${source.foodGuide.slice(0, 240)}`
      : "",
  ].filter(Boolean);
  return parts.length > 1 ? parts.join("\n") : undefined;
}

/** Listing focus that keeps the source listing's structure and voice. */
export function buildListingReferenceFocus(
  source: Project,
): string | undefined {
  if (!source.listing) return undefined;
  return [
    `Match the structure, section lengths, and voice of this reference listing (it sells the ${source.country || "original"} version — sell this country's version instead):`,
    JSON.stringify(
      {
        titleOptions: source.listing.titleOptions,
        shortDescription: source.listing.shortDescription,
        tags: source.listing.tags.slice(0, 8),
        packages: source.listing.packages.map((item) => ({
          name: item.name,
          description: item.description,
        })),
      },
      null,
      2,
    ),
  ].join("\n");
}
