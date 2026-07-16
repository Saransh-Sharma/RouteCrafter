import type { Project } from "@/lib/types";
import type { AiCostEstimate, AiProviderId } from "@/lib/ai/types";
import { estimateAiRunCost } from "@/lib/ai/pricing";
import { editionDayCount } from "@/lib/editions";

const DAY_CHUNK_SIZE = 4;
/** Rough prompt sizes, chars — matched to the real builders' output. */
const ROUTE_PROMPT_CHARS = 2200;
const OVERVIEW_PROMPT_CHARS = 4200;
const DAY_CHUNK_PROMPT_CHARS = 5200;
const LISTING_PROMPT_CHARS = 4600;

export interface SeriesCostEstimate {
  perCountry: AiCostEstimate;
  total: AiCostEstimate;
  textCalls: number;
  imagesPerCountry: number;
}

function addEstimates(
  estimates: (AiCostEstimate | null)[],
): AiCostEstimate | null {
  const present = estimates.filter(
    (item): item is AiCostEstimate => item !== null,
  );
  if (!present.length) return null;
  return present.reduce((total, item) => ({
    currency: "USD",
    lowUsd: total.lowUsd + item.lowUsd,
    highUsd: total.highUsd + item.highUsd,
    basis: "series generation",
  }));
}

function scaleEstimate(
  estimate: AiCostEstimate,
  factor: number,
): AiCostEstimate {
  return {
    ...estimate,
    lowUsd: estimate.lowUsd * factor,
    highUsd: estimate.highUsd * factor,
  };
}

/** Day counts of the editions that will be generated per country. */
function editionDayCounts(source: Project): number[] {
  const editions = source.productionPlan.editions;
  return editions.length ? editions.map(editionDayCount) : [7];
}

/**
 * Upfront cost for transposing one product to N countries: per edition, one
 * route call + one overview call + one call per 4-day chunk, plus one listing
 * call per country. Images are itemized only when explicitly opted in.
 */
export function estimateSeriesCost({
  source,
  countries,
  provider,
  model,
  withImages,
  imageProvider,
  imageModel,
  imageSize,
  imageQuality,
}: {
  source: Project;
  countries: number;
  provider: AiProviderId;
  model: string;
  withImages: boolean;
  imageProvider?: AiProviderId;
  imageModel?: string;
  imageSize?: string;
  imageQuality?: string;
}): SeriesCostEstimate | null {
  const dayCounts = editionDayCounts(source);

  const perEdition = dayCounts.map((dayCount) => {
    const chunks = Math.max(1, Math.ceil(dayCount / DAY_CHUNK_SIZE));
    return addEstimates([
      estimateAiRunCost({
        mode: "text",
        provider,
        model,
        prompt: "x".repeat(ROUTE_PROMPT_CHARS),
        taskType: "transpose",
        maxOutputTokens: 1200,
      }),
      estimateAiRunCost({
        mode: "text",
        provider,
        model,
        prompt: "x".repeat(OVERVIEW_PROMPT_CHARS),
        taskType: "itinerary",
        maxOutputTokens: 2500,
      }),
      ...Array.from({ length: chunks }, () =>
        estimateAiRunCost({
          mode: "text",
          provider,
          model,
          prompt: "x".repeat(DAY_CHUNK_PROMPT_CHARS),
          taskType: "itinerary",
          maxOutputTokens: 3500,
        }),
      ),
    ]);
  });

  const listing = estimateAiRunCost({
    mode: "text",
    provider,
    model,
    prompt: "x".repeat(LISTING_PROMPT_CHARS),
    taskType: "listing",
    maxOutputTokens: 2000,
  });

  // Portfolio visuals (5) + one PDF cover, only when opted in.
  const imagesPerCountry = withImages ? 6 : 0;
  const imageEstimate =
    withImages && imageProvider && imageModel
      ? estimateAiRunCost({
          mode: "image",
          provider: imageProvider,
          model: imageModel,
          prompt: "x".repeat(900),
          taskType: "imageGeneration",
          size: imageSize,
          quality: imageQuality,
        })
      : null;

  const perCountry = addEstimates([
    ...perEdition,
    listing,
    ...(imageEstimate
      ? Array.from({ length: imagesPerCountry }, () => imageEstimate)
      : []),
  ]);
  if (!perCountry) return null;

  const chunksTotal = dayCounts.reduce(
    (total, dayCount) => total + Math.max(1, Math.ceil(dayCount / DAY_CHUNK_SIZE)),
    0,
  );

  return {
    perCountry,
    total: scaleEstimate(perCountry, countries),
    textCalls: (dayCounts.length * 2 + chunksTotal + 1) * countries,
    imagesPerCountry,
  };
}
