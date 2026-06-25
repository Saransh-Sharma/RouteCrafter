"use client";

import type { DayPlan, ItineraryOutput, Project } from "@/lib/types";
import type { AiResult, AiTextRequest, AiUsage } from "./types";
import { requestAiText } from "./client";
import {
  buildDayDetailsFormatPrompt,
  buildDayDetailsResearchPrompt,
} from "./tasks";

const RESEARCH_MIN_TOKENS = 2500;
const FORMAT_MIN_TOKENS = 3000;

function sumUsage(results: AiResult[]): AiUsage | undefined {
  const usage = results.reduce<AiUsage>((total, result) => {
    if (!result.usage) return total;
    return {
      inputTokens: (total.inputTokens ?? 0) + (result.usage.inputTokens ?? 0),
      outputTokens:
        (total.outputTokens ?? 0) + (result.usage.outputTokens ?? 0),
      totalTokens: (total.totalTokens ?? 0) + (result.usage.totalTokens ?? 0),
    };
  }, {});
  return usage.inputTokens || usage.outputTokens || usage.totalTokens
    ? usage
    : undefined;
}

/**
 * Two-pass generation of a day's web-search-grounded "Local details":
 *   1. a grounded research pass (web search on, prose out) that surfaces real,
 *      cited venues;
 *   2. a plain JSON pass that formats the research into DayDetails — no tools,
 *      so JSON reliability matches every other structured task.
 *
 * Returns an AiResult whose `.text` is the DayDetails JSON, ready to drop into
 * AiRunSheet's review or be parsed by the batched runner. Mirrors the shape of
 * `requestStructuredItineraryDraft` in itinerary-draft-client.
 */
export async function requestDayDetails({
  request,
  signal,
  project,
  itinerary,
  day,
}: {
  request: AiTextRequest;
  signal: AbortSignal;
  project: Project;
  itinerary: ItineraryOutput;
  day: DayPlan;
}): Promise<AiResult> {
  const research = await requestAiText(
    {
      ...request,
      taskType: "dayDetails",
      label: `${request.label ?? "Local details"} - research day ${day.day}`,
      prompt: buildDayDetailsResearchPrompt({ project, itinerary, day }),
      enableWebSearch: true,
      maxWebSearches: request.maxWebSearches ?? 5,
      responseFormat: undefined,
      maxOutputTokens: Math.max(
        request.maxOutputTokens ?? 4000,
        RESEARCH_MIN_TOKENS,
      ),
    },
    signal,
  );

  const sourcesBlock = research.citations?.length
    ? `\n\nSources found during research (prefer these for the "source" field):\n${research.citations
        .map((c) => `- ${[c.title, c.url].filter(Boolean).join(" — ")}`)
        .join("\n")}`
    : "";

  const formatted = await requestAiText(
    {
      ...request,
      taskType: "dayDetails",
      label: `${request.label ?? "Local details"} - format day ${day.day}`,
      prompt:
        buildDayDetailsFormatPrompt(research.text ?? "") + sourcesBlock,
      enableWebSearch: false,
      responseFormat: "json",
      maxOutputTokens: Math.max(
        request.maxOutputTokens ?? 4000,
        FORMAT_MIN_TOKENS,
      ),
    },
    signal,
  );

  return {
    provider: formatted.provider,
    model: formatted.model,
    credentialSource: formatted.credentialSource,
    aiRunId: formatted.aiRunId,
    aiRunIds: [research, formatted]
      .map((result) => result.aiRunId)
      .filter((id): id is string => Boolean(id)),
    usage: sumUsage([research, formatted]),
    citations: research.citations,
    text: formatted.text,
  };
}
