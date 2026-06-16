"use client";

import { z } from "zod";
import type { DayPlan, ItineraryOutput, Project } from "@/lib/types";
import type { AiResult, AiTextRequest, AiUsage } from "./types";
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
}: {
  request: AiTextRequest;
  signal: AbortSignal;
  project: Project;
  current: ItineraryOutput;
  focus?: string;
}): Promise<AiResult> {
  const overview = await requestAiText(
    {
      ...request,
      label: `${request.label ?? "AI itinerary"} - overview`,
      prompt: buildItineraryOverviewPrompt(project, current, focus),
      maxOutputTokens: Math.max(request.maxOutputTokens ?? 4000, 2500),
      responseFormat: "json",
    },
    signal,
  );
  const overviewData = overviewChunkSchema.parse(parseCompleteJson(overview.text));
  const shell = normalizeAiItinerary(
    {
      ...overviewData,
      days: current.days,
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
  for (let index = 0; index < current.days.length; index += DAY_CHUNK_SIZE) {
    const chunk = current.days.slice(index, index + DAY_CHUNK_SIZE);
    const result = await requestAiText(
      {
        ...request,
        label: `${request.label ?? "AI itinerary"} - days ${chunk[0]?.day ?? ""}-${chunk.at(-1)?.day ?? ""}`,
        prompt: buildItineraryDaysPrompt({
          project,
          itinerary: shell,
          days: chunk,
          focus,
        }),
        maxOutputTokens: Math.max(request.maxOutputTokens ?? 4000, 3500),
        responseFormat: "json",
      },
      signal,
    );
    dayResults.push(result);
    days.push(...normalizeDayChunk(result.text, chunk));
  }

  const itinerary = normalizeAiItinerary(
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
  );

  return {
    provider: overview.provider,
    model: overview.model,
    credentialSource: overview.credentialSource,
    aiRunId: overview.aiRunId,
    usage: aggregateUsage([overview, ...dayResults]),
    text: JSON.stringify(itinerary, null, 2),
  };
}

function parseCompleteJson(text: string | undefined): unknown {
  if (!text || isLikelyTruncatedJson(text)) {
    throw new Error(
      "The model response was cut off before the itinerary JSON finished. RouteCrafter did not apply anything.",
    );
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
