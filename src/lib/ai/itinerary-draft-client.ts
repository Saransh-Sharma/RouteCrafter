"use client";

import { z } from "zod";
import type { DayPlan, ItineraryOutput, Project } from "@/lib/types";
import type {
  AiResult,
  AiTextRequest,
  AiUsage,
  DraftProgress,
  ItineraryDraftOverrides,
} from "./types";
import { requestAiText } from "./client";
import { isLikelyTruncatedJson, parseJsonObject } from "./parse";
import {
  buildItineraryDaysPrompt,
  buildItineraryOverviewPrompt,
} from "./tasks";
import {
  normalizeAiDayPlan,
  normalizeAiItinerary,
} from "./itinerary-normalization";

const DAY_CHUNK_SIZE = 4;
const OVERVIEW_MIN_TOKENS = 2500;
const DAY_CHUNK_MIN_TOKENS = 3500;
/** Ceiling used when a single day still truncates and we retry with more room. */
const DAY_SINGLE_MAX_TOKENS = 8000;

/** Thrown when a model response was cut off before the JSON finished. */
export class ItineraryTruncationError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "The model response was cut off before the itinerary JSON finished. RouteCrafter did not apply anything.",
    );
    this.name = "ItineraryTruncationError";
  }
}

const overviewChunkSchema = z.object({
  title: z.string().optional(),
  subtitle: z.string().optional(),
  style: z.string().optional(),
  budget: z.string().optional(),
  overview: z.string().optional(),
  whoFor: z.string().optional(),
  routeSummary: z.string().optional(),
  bestStayAreas: z.string().optional(),
  foodGuide: z.string().optional(),
  transportGuide: z.string().optional(),
  packingList: z.string().optional(),
  etiquetteSafety: z.string().optional(),
  bookingChecklist: z.string().optional(),
  personalizationQuestions: z.string().optional(),
  verificationNotes: z.string().optional(),
});

const dayChunkSchema = z.object({
  days: z.array(z.unknown()).default([]),
});

export async function requestStructuredItineraryDraft({
  request,
  signal,
  project,
  current,
  focus,
  overrides,
  instructions,
  onProgress,
}: {
  request: AiTextRequest;
  signal: AbortSignal;
  project: Project;
  current: ItineraryOutput;
  focus?: string;
  overrides?: ItineraryDraftOverrides;
  instructions?: string;
  onProgress?: (progress: DraftProgress) => void;
}): Promise<AiResult> {
  // Apply the user's lever choices to a working copy so the prompts steer toward
  // them; we re-apply at the end so the chosen levers stay authoritative.
  const tuned = applyOverrides(current, overrides);
  const effectiveFocus = mergeFocus(focus, instructions);

  onProgress?.({
    id: "overview",
    kind: "overview",
    label: "Overview & guides",
    status: "start",
  });
  const overview = await requestAiText(
    {
      ...request,
      label: `${request.label ?? "AI itinerary"} - overview`,
      prompt: buildItineraryOverviewPrompt(project, tuned, effectiveFocus),
      maxOutputTokens: Math.max(request.maxOutputTokens ?? 4000, OVERVIEW_MIN_TOKENS),
      responseFormat: "json",
    },
    signal,
  );
  const overviewData = overviewChunkSchema.parse(parseCompleteJson(overview.text));
  onProgress?.({
    id: "overview",
    kind: "overview",
    label: "Overview & guides",
    status: "done",
    usage: overview.usage,
  });
  const shell = normalizeAiItinerary(
    {
      ...overviewData,
      days: tuned.days,
    },
    {
      project,
      current,
      fallback: {
        id: current.id,
        duration: current.duration,
        travelerType: current.travelerType,
        createdAt: current.createdAt,
      },
    },
  );

  const dayResults: AiResult[] = [];
  const days: DayPlan[] = [];
  for (let index = 0; index < tuned.days.length; index += DAY_CHUNK_SIZE) {
    const chunk = tuned.days.slice(index, index + DAY_CHUNK_SIZE);
    const chunkDays = await runDayChunk({
      request,
      signal,
      project,
      shell,
      chunk,
      focus: effectiveFocus,
      results: dayResults,
      onProgress,
    });
    days.push(...chunkDays);
  }

  const itinerary = applyOverrides(
    normalizeAiItinerary(
      {
        ...shell,
        days,
      },
      {
        project,
        current,
        fallback: {
          id: current.id,
          duration: current.duration,
          travelerType: current.travelerType,
          createdAt: current.createdAt,
        },
      },
    ),
    overrides,
  );

  return {
    provider: overview.provider,
    model: overview.model,
    credentialSource: overview.credentialSource,
    aiRunId: overview.aiRunId,
    aiRunIds: [overview, ...dayResults]
      .map((result) => result.aiRunId)
      .filter((id): id is string => Boolean(id)),
    usage: aggregateUsage([overview, ...dayResults]),
    text: JSON.stringify(itinerary, null, 2),
  };
}

/**
 * Regenerate a specific subset of days (used by per-day "Regenerate this day").
 * Returns the normalized days plus the underlying AiResult for run metadata.
 */
export async function requestItineraryDays({
  request,
  signal,
  project,
  itinerary,
  days,
  overrides,
  instructions,
  focus,
}: {
  request: AiTextRequest;
  signal: AbortSignal;
  project: Project;
  itinerary: ItineraryOutput;
  days: DayPlan[];
  overrides?: ItineraryDraftOverrides;
  instructions?: string;
  focus?: string;
}): Promise<{ days: DayPlan[]; result: AiResult }> {
  const tuned = applyOverrides(itinerary, overrides);
  const tunedChunk = applyDayOverrides(days, overrides);
  const results: AiResult[] = [];
  const out = await runDayChunk({
    request,
    signal,
    project,
    shell: tuned,
    chunk: tunedChunk,
    focus: mergeFocus(focus, instructions),
    results,
    onProgress: undefined,
  });
  return {
    days: out,
    result:
      results[results.length - 1] ??
      ({
        provider: request.provider,
        model: request.model,
        credentialSource: "server",
      } as AiResult),
  };
}

/**
 * Request one chunk of days. On truncation, recursively split the chunk in half
 * (down to a single day) so a long itinerary never drops days or hard-fails.
 */
async function runDayChunk({
  request,
  signal,
  project,
  shell,
  chunk,
  focus,
  results,
  onProgress,
  maxTokens,
}: {
  request: AiTextRequest;
  signal: AbortSignal;
  project: Project;
  shell: ItineraryOutput;
  chunk: DayPlan[];
  focus?: string;
  results: AiResult[];
  onProgress?: (progress: DraftProgress) => void;
  maxTokens?: number;
}): Promise<DayPlan[]> {
  if (!chunk.length) return [];
  const first = chunk[0]?.day ?? 0;
  const last = chunk.at(-1)?.day ?? first;
  const tokens =
    maxTokens ?? Math.max(request.maxOutputTokens ?? 4000, DAY_CHUNK_MIN_TOKENS);

  onProgress?.({
    id: `days-${first}-${last}`,
    kind: "days",
    label: chunk.length > 1 ? `Days ${first}–${last}` : `Day ${first}`,
    dayRange: [first, last],
    status: "start",
  });

  try {
    const result = await requestAiText(
      {
        ...request,
        label: `${request.label ?? "AI itinerary"} - days ${first}-${last}`,
        prompt: buildItineraryDaysPrompt({
          project,
          itinerary: shell,
          days: chunk,
          focus,
        }),
        maxOutputTokens: tokens,
        responseFormat: "json",
      },
      signal,
    );
    results.push(result);
    const out = normalizeDayChunk(result.text, chunk);
    onProgress?.({
      id: `days-${first}-${last}`,
      kind: "days",
      label: chunk.length > 1 ? `Days ${first}–${last}` : `Day ${first}`,
      dayRange: [first, last],
      status: "done",
      usage: result.usage,
    });
    return out;
  } catch (error) {
    if (!(error instanceof ItineraryTruncationError)) throw error;
    if (chunk.length > 1) {
      const mid = Math.ceil(chunk.length / 2);
      const left = await runDayChunk({
        request,
        signal,
        project,
        shell,
        chunk: chunk.slice(0, mid),
        focus,
        results,
        onProgress,
      });
      const right = await runDayChunk({
        request,
        signal,
        project,
        shell,
        chunk: chunk.slice(mid),
        focus,
        results,
        onProgress,
      });
      return [...left, ...right];
    }
    // Single day still truncated — give it the most room before giving up.
    if (tokens < DAY_SINGLE_MAX_TOKENS) {
      return runDayChunk({
        request,
        signal,
        project,
        shell,
        chunk,
        focus,
        results,
        onProgress,
        maxTokens: DAY_SINGLE_MAX_TOKENS,
      });
    }
    throw error;
  }
}

function mergeFocus(focus?: string, instructions?: string): string | undefined {
  return (
    [focus, instructions?.trim()].filter(Boolean).join("\n\n") || undefined
  );
}

function applyOverrides(
  itinerary: ItineraryOutput,
  overrides?: ItineraryDraftOverrides,
): ItineraryOutput {
  if (!overrides || (!overrides.style && !overrides.budget && !overrides.pace)) {
    return itinerary;
  }
  return {
    ...itinerary,
    style: overrides.style
      ? (overrides.style as ItineraryOutput["style"])
      : itinerary.style,
    budget: overrides.budget
      ? (overrides.budget as ItineraryOutput["budget"])
      : itinerary.budget,
    days: applyDayOverrides(itinerary.days, overrides),
  };
}

function applyDayOverrides(
  days: DayPlan[],
  overrides?: ItineraryDraftOverrides,
): DayPlan[] {
  if (!overrides?.pace) return days;
  return days.map((day) => ({ ...day, pace: overrides.pace as DayPlan["pace"] }));
}

function parseCompleteJson(text: string | undefined): unknown {
  if (!text || isLikelyTruncatedJson(text)) {
    throw new ItineraryTruncationError();
  }
  return parseJsonObject(text);
}

function normalizeDayChunk(text: string | undefined, currentDays: DayPlan[]): DayPlan[] {
  const parsed = dayChunkSchema.parse(parseCompleteJson(text));
  return currentDays.map((currentDay, index) => {
    const raw =
      parsed.days.find(
        (day) =>
          day &&
          typeof day === "object" &&
          !Array.isArray(day) &&
          "day" in day &&
          day.day === currentDay.day,
      ) ?? parsed.days[index];
    return normalizeAiDayPlan(raw, currentDay);
  });
}

function aggregateUsage(results: AiResult[]): AiUsage | undefined {
  const usage = results
    .map((result) => result.usage)
    .filter((item): item is AiUsage => Boolean(item));
  if (!usage.length) return undefined;
  return {
    inputTokens: sumUsage(usage, "inputTokens"),
    outputTokens: sumUsage(usage, "outputTokens"),
    totalTokens: sumUsage(usage, "totalTokens"),
    images: sumUsage(usage, "images"),
  };
}

function sumUsage(usage: AiUsage[], key: keyof AiUsage): number | undefined {
  const values = usage
    .map((item) => item[key])
    .filter((value): value is number => typeof value === "number");
  return values.length ? values.reduce((total, value) => total + value, 0) : undefined;
}
