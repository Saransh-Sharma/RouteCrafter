"use client";

import {
  marketplaceListingSchema,
  type PlannedEdition,
  type Project,
  type RouteStop,
} from "@/lib/schemas";
import type { AiProviderId, AiUsage } from "@/lib/ai/types";
import { requestAiText, requestAiImage } from "@/lib/ai/client";
import { parseJsonObject } from "@/lib/ai/parse";
import { requestStructuredItineraryDraft } from "@/lib/ai/itinerary-draft-client";
import { buildListingPrompt } from "@/lib/ai/tasks";
import {
  buildListingReferenceFocus,
  buildRouteTranspositionPrompt,
  buildStyleReferenceDigest,
  routeTranspositionSchema,
} from "@/lib/ai/transpose";
import { buildImageGenerationPrompt } from "@/lib/ai/tasks";
import {
  buildContext,
  buildImagePrompts,
  buildItinerary,
  imagePromptToText,
  syncItineraryToRoute,
} from "@/lib/generation";
import {
  editionDayCount,
  editionLabel,
  itineraryForEdition,
  normalizeRoute,
} from "@/lib/editions";
import { useProjectsStore } from "@/lib/store/projects-store";
import {
  useSeriesJobStore,
  type CountryJob,
  type SeriesJob,
} from "@/lib/store/series-job-store";
import { cloneProductSkeleton, sourcePdfTheme } from "./clone";

export interface SeriesRunConfig {
  provider: AiProviderId;
  model: string;
  apiKey?: string;
  withImages: boolean;
  image?: {
    provider: AiProviderId;
    model: string;
    apiKey?: string;
    size: string;
    quality: string;
  };
}

export interface SeriesRunInput {
  source: Project;
  seriesId: string;
  seriesName: string;
  countries: string[];
  config: SeriesRunConfig;
  signal: AbortSignal;
  /**
   * Batch mode: the source is a bare spec that needs generation too. Its own
   * country must be first in `countries`; it is generated in place instead
   * of being cloned.
   */
  generateSource?: boolean;
}

/**
 * Transpose one product to N countries, sequentially. Every country starts
 * as an instantly-persisted structural clone, so a failure anywhere leaves a
 * resumable draft; retrying re-runs only the steps whose output is missing.
 */
export async function runSeriesGeneration(input: SeriesRunInput): Promise<void> {
  const jobs = useSeriesJobStore.getState();
  const { source, seriesId, seriesName, countries, config, signal } = input;

  // Stamp the source as the series original (idempotent).
  stampSourceSeries(source, seriesId, seriesName);

  jobs.startJob({
    seriesId,
    seriesName,
    sourceProductId: source.id,
    status: "running",
    withImages: config.withImages,
    countries: countries.map((country) => ({
      country,
      status: "queued",
      steps: plannedSteps(source, config.withImages),
    })),
  });

  for (const country of countries) {
    if (signal.aborted || jobStatus(seriesId) === "cancelled") break;
    await runCountry({
      ...input,
      country,
      useSourceAsDraft:
        input.generateSource &&
        country.toLowerCase() === source.country.toLowerCase(),
    }).catch(() => {
      // runCountry records its own failure; the loop continues.
    });
  }

  if (jobStatus(seriesId) !== "cancelled") {
    useSeriesJobStore.getState().finishJob(seriesId);
  }
}

/** Resume a single failed/incomplete country against its persisted draft. */
export async function runCountry({
  source,
  seriesId,
  seriesName,
  country,
  config,
  signal,
  useSourceAsDraft = false,
}: Omit<SeriesRunInput, "countries"> & {
  country: string;
  useSourceAsDraft?: boolean;
}): Promise<void> {
  const jobs = useSeriesJobStore.getState();
  const projects = useProjectsStore.getState();
  jobs.patchCountry(seriesId, country, { status: "running", error: undefined });

  const step = (id: string) => ({
    start: () =>
      useSeriesJobStore
        .getState()
        .patchStep(seriesId, country, id, { status: "running" }),
    done: (usage?: AiUsage) =>
      useSeriesJobStore
        .getState()
        .patchStep(seriesId, country, id, { status: "done", usage }),
    skip: () =>
      useSeriesJobStore
        .getState()
        .patchStep(seriesId, country, id, { status: "done" }),
    fail: (error: string) =>
      useSeriesJobStore
        .getState()
        .patchStep(seriesId, country, id, { status: "failed", error }),
  });

  try {
    // 1. Structural clone (or the source itself in batch mode, or the
    //    existing draft on retry).
    let draft = useSourceAsDraft
      ? current(source.id)
      : findSeriesDraft(seriesId, country);
    if (!draft) {
      draft = cloneProductSkeleton({
        source,
        targetCountry: country,
        series: {
          seriesId,
          seriesName,
          role: "variant",
          sourceProductId: source.id,
          addedAt: new Date().toISOString(),
        },
      });
      projects.importProject(draft);
    }
    const draftId = draft.id;
    jobs.patchCountry(seriesId, country, { productId: draftId });

    const requestBase = {
      provider: config.provider,
      model: config.model,
      apiKey: config.apiKey,
      projectId: draftId,
      source: "series-engine",
    } as const;

    // 2. Route transposition, per edition. The first edition's response also
    //    sets the product identity (name, regions, positioning, audience).
    const editions = current(draftId).productionPlan.editions;
    for (const [index, edition] of editions.entries()) {
      const stepId = `route:${edition.id}`;
      if (edition.route.length) {
        step(stepId).skip();
        continue;
      }
      step(stepId).start();
      const sourceEdition =
        source.productionPlan.editions.find(
          (item) => item.id === edition.sourceEditionId,
        ) ?? source.productionPlan.editions[index];
      const result = await requestAiText(
        {
          ...requestBase,
          taskType: "transpose",
          label: `Transpose route — ${country} ${editionLabel(edition)}`,
          prompt: buildRouteTranspositionPrompt({
            source,
            edition: sourceEdition ?? edition,
            sourceItinerary: sourceEdition
              ? itineraryForEdition(source, sourceEdition)
              : undefined,
            targetCountry: country,
          }),
          maxOutputTokens: 1600,
          responseFormat: "json",
        },
        signal,
      );
      const parsed = routeTranspositionSchema.parse(
        parseJsonObject(result.text ?? "{}"),
      );
      const route: RouteStop[] = normalizeRoute(
        parsed.route.map((stop) => ({
          id: crypto.randomUUID(),
          city: stop.city,
          nights: stop.nights,
          arriveBy: stop.arriveBy,
        })),
      );
      updateProject(draftId, (project) => ({
        ...project,
        ...(index === 0
          ? {
              name: parsed.name || project.name,
              regions: parsed.regions,
              positioning: parsed.positioning || project.positioning,
              targetAudience: parsed.targetAudience || project.targetAudience,
            }
          : {}),
        productionPlan: {
          ...project.productionPlan,
          editions: project.productionPlan.editions.map((item) =>
            item.id === edition.id
              ? { ...item, route, cities: route.map((stop) => stop.city) }
              : item,
          ),
        },
      }));
      step(stepId).done(result.usage);
    }

    // 3. Full itinerary per edition through the existing chunked pipeline.
    const styleReference = buildStyleReferenceDigest(
      source.itineraries.find((itinerary) => itinerary.days.length) ??
        source.itineraries[0],
    );
    for (const edition of current(draftId).productionPlan.editions) {
      const stepId = `itinerary:${edition.id}`;
      const existing = itineraryForEdition(current(draftId), edition);
      if (existing && existing.days.some((day) => day.morning)) {
        step(stepId).skip();
        continue;
      }
      step(stepId).start();
      const project = current(draftId);
      const skeleton =
        existing ?? scaffoldEditionItinerary(project, edition, draftId);
      const result = await requestStructuredItineraryDraft({
        request: {
          ...requestBase,
          taskType: "itinerary",
          label: `Series itinerary — ${country} ${editionLabel(edition)}`,
          prompt: "structured-draft",
        },
        signal,
        project: current(draftId),
        current: skeleton,
        focus: styleReference,
      });
      const generated = JSON.parse(result.text ?? "{}");
      useProjectsStore
        .getState()
        .patchItinerary(draftId, skeleton.id, () => ({
          ...generated,
          id: skeleton.id,
          plannedEditionId: edition.id,
          pdfTheme: sourcePdfTheme(source),
        }));
      step(stepId).done(result.usage);
    }

    // 4. Listing copy, matched to the source listing's voice.
    {
      const stepId = "listing";
      if (current(draftId).listing) {
        step(stepId).skip();
      } else {
        step(stepId).start();
        const project = current(draftId);
        const result = await requestAiText(
          {
            ...requestBase,
            taskType: "listing",
            label: `Series listing — ${country}`,
            prompt: buildListingPrompt(
              project,
              null,
              buildListingReferenceFocus(source),
            ),
            maxOutputTokens: 2400,
            responseFormat: "json",
          },
          signal,
        );
        const listing = marketplaceListingSchema.parse(
          parseJsonObject(result.text ?? "{}"),
        );
        updateProject(draftId, (item) => ({ ...item, listing }));
        step(stepId).done(result.usage);
      }
    }

    // 5. Country-adapted image prompts — local and free, never an API call.
    updateProject(draftId, (project) =>
      project.imagePrompts.length
        ? project
        : { ...project, imagePrompts: buildImagePrompts(buildContext(project)) },
    );

    // 6. Images only when explicitly opted in.
    if (config.withImages && config.image) {
      const stepId = "images";
      step(stepId).start();
      const usage = await generateCountryImages({
        draftId,
        image: config.image,
        signal,
      });
      step(stepId).done(usage);
    }

    updateProject(draftId, (project) => ({
      ...project,
      status: "In progress",
    }));
    jobs.patchCountry(seriesId, country, { status: "done" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Generation failed.";
    useSeriesJobStore.getState().patchCountry(seriesId, country, {
      status: signal.aborted ? "cancelled" : "failed",
      error: message,
    });
    throw error;
  }
}

/* ------------------------------------------------------------------------ */

function plannedSteps(source: Project, withImages: boolean) {
  const editions = source.productionPlan.editions;
  return [
    ...editions.map((edition) => ({
      id: `route:${edition.id}`,
      label: `Route — ${editionLabel(edition)}`,
      status: "queued" as const,
    })),
    ...editions.map((edition) => ({
      id: `itinerary:${edition.id}`,
      label: `Itinerary — ${editionLabel(edition)}`,
      status: "queued" as const,
    })),
    { id: "listing", label: "Listing copy", status: "queued" as const },
    ...(withImages
      ? [{ id: "images", label: "Images", status: "queued" as const }]
      : []),
  ];
}

function stampSourceSeries(
  source: Project,
  seriesId: string,
  seriesName: string,
): void {
  if (source.series?.seriesId === seriesId) return;
  updateProject(source.id, (project) => ({
    ...project,
    series: project.series ?? {
      seriesId,
      seriesName,
      role: "original",
      addedAt: new Date().toISOString(),
    },
  }));
}

function current(projectId: string): Project {
  const project = useProjectsStore.getState().getById(projectId);
  if (!project) throw new Error("Series draft went missing.");
  return project;
}

function updateProject(
  projectId: string,
  updater: (project: Project) => Project,
): void {
  const result = useProjectsStore.getState().updateProject(projectId, updater);
  if (!result.ok) throw new Error(result.error);
}

function jobStatus(seriesId: string): SeriesJob["status"] | undefined {
  return useSeriesJobStore.getState().jobs[seriesId]?.status;
}

export function findSeriesDraft(
  seriesId: string,
  country: string,
): Project | undefined {
  return useProjectsStore
    .getState()
    .projects.find(
      (project) =>
        project.series?.seriesId === seriesId &&
        project.series.role === "variant" &&
        project.country === country,
    );
}

/** Build the local day-scaffold itinerary an edition needs before AI fills it. */
function scaffoldEditionItinerary(
  project: Project,
  edition: PlannedEdition,
  draftId: string,
) {
  const itinerary = buildItinerary(
    buildContext(project, { extraCities: edition.cities }),
    {
      duration: edition.duration,
      customDays: edition.customDays,
      travelerType: edition.travelerType,
      route: edition.route,
    },
  );
  itinerary.plannedEditionId = edition.id;
  const synced = edition.route.length
    ? syncItineraryToRoute(itinerary, edition.route).next
    : itinerary;
  updateProject(draftId, (item) => ({
    ...item,
    itineraries: [...item.itineraries, synced],
    productionPlan: {
      ...item.productionPlan,
      editions: item.productionPlan.editions.map((candidate) =>
        candidate.id === edition.id
          ? { ...candidate, itineraryId: synced.id }
          : candidate,
      ),
    },
  }));
  return synced;
}

/** Cover + portfolio images for one country draft (opt-in only). */
async function generateCountryImages({
  draftId,
  image,
  signal,
}: {
  draftId: string;
  image: NonNullable<SeriesRunConfig["image"]>;
  signal: AbortSignal;
}): Promise<AiUsage | undefined> {
  const project = current(draftId);
  const itinerary = project.itineraries[0];
  let images = 0;

  if (itinerary && !itinerary.coverImage) {
    const result = await requestAiImage(
      {
        provider: image.provider,
        apiKey: image.apiKey,
        model: image.model,
        size: image.size,
        quality: image.quality,
        taskType: "imageGeneration",
        projectId: draftId,
        label: `Series cover — ${project.country}`,
        prompt: buildImageGenerationPrompt(
          project,
          `${itinerary.title || project.name}. ${project.positioning}`,
          "Premium PDF cover photograph",
          [],
          "portrait",
        ),
      },
      signal,
    );
    if (result.image) {
      images += 1;
      useProjectsStore.getState().patchItinerary(draftId, itinerary.id, {
        coverImage: result.image,
      });
      updateProject(draftId, (item) =>
        item.coverImage ? item : { ...item, coverImage: result.image! },
      );
    }
  }

  for (const promptSpec of current(draftId).imagePrompts) {
    if (promptSpec.image) continue;
    const result = await requestAiImage(
      {
        provider: image.provider,
        apiKey: image.apiKey,
        model: image.model,
        size: image.size,
        quality: image.quality,
        taskType: "imageGeneration",
        projectId: draftId,
        label: `Series visual — ${promptSpec.kind}`,
        prompt: buildImageGenerationPrompt(
          current(draftId),
          imagePromptToText(promptSpec),
          "Marketplace listing visual",
          [],
          "landscape",
        ),
      },
      signal,
    );
    if (result.image) {
      images += 1;
      updateProject(draftId, (item) => ({
        ...item,
        imagePrompts: item.imagePrompts.map((candidate) =>
          candidate.id === promptSpec.id
            ? { ...candidate, image: result.image! }
            : candidate,
        ),
      }));
    }
  }

  return images ? { images } : undefined;
}

/**
 * Reconstruct board state for a series after a reload: what exists on each
 * persisted draft determines which steps read as done.
 */
export function reconstructJob(
  seriesId: string,
  source: Project | undefined,
  drafts: Project[],
): SeriesJob | undefined {
  if (!drafts.length && !source) return undefined;
  const seriesName =
    source?.series?.seriesName ?? drafts[0]?.series?.seriesName ?? "Series";
  const countries: CountryJob[] = drafts.map((draft) => {
    const steps = [
      ...draft.productionPlan.editions.map((edition) => ({
        id: `route:${edition.id}`,
        label: `Route — ${editionLabel(edition)}`,
        status: edition.route.length
          ? ("done" as const)
          : ("queued" as const),
      })),
      ...draft.productionPlan.editions.map((edition) => {
        const itinerary = itineraryForEdition(draft, edition);
        const filled = Boolean(
          itinerary &&
            itinerary.days.length >= editionDayCount(edition) &&
            itinerary.days.some((day) => day.morning),
        );
        return {
          id: `itinerary:${edition.id}`,
          label: `Itinerary — ${editionLabel(edition)}`,
          status: filled ? ("done" as const) : ("queued" as const),
        };
      }),
      {
        id: "listing",
        label: "Listing copy",
        status: draft.listing ? ("done" as const) : ("queued" as const),
      },
    ];
    const complete = steps.every((item) => item.status === "done");
    return {
      country: draft.country,
      productId: draft.id,
      status: complete ? ("done" as const) : ("failed" as const),
      steps,
      error: complete ? undefined : "Interrupted — resume to finish.",
    };
  });

  return {
    seriesId,
    seriesName,
    sourceProductId: source?.id ?? "",
    status: "done",
    withImages: false,
    countries,
  };
}
