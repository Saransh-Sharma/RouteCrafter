import { dayPlanSchema } from "@/lib/schemas";
import type { ItineraryOutput } from "@/lib/types";

export type ItineraryMergeMode = "replace" | "fill-empty" | "append";
export type DayPlan = ItineraryOutput["days"][number];

export function renumberDays(days: DayPlan[]): DayPlan[] {
  return days.map((day, index) => ({ ...day, day: index + 1 }));
}

export function createItineraryDay(dayNumber: number): DayPlan {
  return dayPlanSchema.parse({
    day: dayNumber,
    title: `Day ${dayNumber}`,
  });
}

export function addItineraryDay(days: DayPlan[]): DayPlan[] {
  return [...days, createItineraryDay(days.length + 1)];
}

export function removeItineraryDay(days: DayPlan[], index: number): DayPlan[] {
  return renumberDays(days.filter((_, dayIndex) => dayIndex !== index));
}

export function moveItineraryDay(
  days: DayPlan[],
  index: number,
  direction: -1 | 1,
): DayPlan[] {
  const target = index + direction;
  if (target < 0 || target >= days.length) return days;
  const next = [...days];
  [next[index], next[target]] = [next[target], next[index]];
  return renumberDays(next);
}

export function mergeText(
  current: string,
  incoming: string,
  mode: ItineraryMergeMode,
): string {
  if (mode === "replace") return incoming;
  if (mode === "append") return [current, incoming].filter(Boolean).join("\n\n");
  return current || incoming;
}

export function mergeDayPlan(
  current: DayPlan,
  incoming: DayPlan,
  mode: ItineraryMergeMode,
): DayPlan {
  if (mode === "replace") return { ...incoming, day: current.day };
  const next = { ...current };
  for (const key of Object.keys(incoming) as (keyof DayPlan)[]) {
    if (key === "day") continue;
    const currentValue = current[key];
    const incomingValue = incoming[key];
    if (typeof currentValue === "string" && typeof incomingValue === "string") {
      (next as Record<string, unknown>)[key] = mergeText(
        currentValue,
        incomingValue,
        mode,
      );
    } else if (!currentValue && incomingValue) {
      (next as Record<string, unknown>)[key] = incomingValue;
    }
  }
  return next;
}

export function mergeItinerary(
  current: ItineraryOutput | null,
  incoming: ItineraryOutput,
  mode: ItineraryMergeMode,
): ItineraryOutput {
  if (!current || mode === "replace") return incoming;
  return {
    ...current,
    title: mergeText(current.title, incoming.title, mode),
    subtitle: mergeText(current.subtitle, incoming.subtitle, mode),
    overview: mergeText(current.overview, incoming.overview, mode),
    whoFor: mergeText(current.whoFor, incoming.whoFor, mode),
    routeSummary: mergeText(current.routeSummary, incoming.routeSummary, mode),
    bestStayAreas: mergeText(current.bestStayAreas, incoming.bestStayAreas, mode),
    foodGuide: mergeText(current.foodGuide, incoming.foodGuide, mode),
    transportGuide: mergeText(current.transportGuide, incoming.transportGuide, mode),
    packingList: mergeText(current.packingList, incoming.packingList, mode),
    etiquetteSafety: mergeText(
      current.etiquetteSafety,
      incoming.etiquetteSafety,
      mode,
    ),
    bookingChecklist: mergeText(
      current.bookingChecklist,
      incoming.bookingChecklist,
      mode,
    ),
    personalizationQuestions: mergeText(
      current.personalizationQuestions,
      incoming.personalizationQuestions,
      mode,
    ),
    verificationNotes: mergeText(
      current.verificationNotes,
      incoming.verificationNotes,
      mode,
    ),
    days: current.days.map((day, index) =>
      incoming.days[index] ? mergeDayPlan(day, incoming.days[index], mode) : day,
    ),
    updatedAt: new Date().toISOString(),
  };
}
