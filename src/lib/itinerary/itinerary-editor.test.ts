import { describe, expect, it } from "vitest";
import {
  addItineraryDay,
  mergeDayPlan,
  mergeItinerary,
  moveItineraryDay,
  removeItineraryDay,
} from "./itinerary-editor";
import type { ItineraryOutput } from "@/lib/types";
import { dayPlanSchema } from "@/lib/schemas";

const day = (dayNumber: number, title: string, notes = "") =>
  dayPlanSchema.parse({
    day: dayNumber,
    title,
    base: "",
    morning: notes,
    lunch: "",
    afternoon: "",
    evening: "",
    dinner: "",
    transportNotes: "",
    bookingNotes: "",
    walkingIntensity: "",
    optionalUpgrade: "",
    lowEnergyAlternative: "",
    rainyDayAlternative: "",
    whyThisWorks: "",
    image: "",
    imagePrompt: "",
    needsRefresh: false,
  }) satisfies ItineraryOutput["days"][number];

const itinerary = (title: string): ItineraryOutput => ({
  id: title,
  duration: "7 days",
  travelerType: "Couple",
  country: "Japan",
  title,
  subtitle: "",
  overview: "",
  whoFor: "",
  routeSummary: "",
  bestStayAreas: "",
  foodGuide: "",
  transportGuide: "",
  packingList: "",
  etiquetteSafety: "",
  bookingChecklist: "",
  personalizationQuestions: "",
  verificationNotes: "",
  pdfTheme: "beige",
  coverImage: "",
  hiddenElements: [],
  customBlocks: [],
  days: [day(1, "Current", "Keep")],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

describe("itinerary editor helpers", () => {
  it("renumbers days after add, remove, and move", () => {
    const days = [day(1, "One"), day(2, "Two")];

    expect(addItineraryDay(days).map((item) => item.day)).toEqual([1, 2, 3]);
    expect(removeItineraryDay(days, 0).map((item) => item.day)).toEqual([1]);
    expect(moveItineraryDay(days, 0, 1).map((item) => item.title)).toEqual([
      "Two",
      "One",
    ]);
    expect(moveItineraryDay(days, 0, 1).map((item) => item.day)).toEqual([1, 2]);
  });

  it("merges day text by replace, fill-empty, and append", () => {
    const current = day(2, "Current", "Morning");
    const incoming = day(9, "AI", "AI morning");

    expect(mergeDayPlan(current, incoming, "replace")).toMatchObject({
      day: 2,
      title: "AI",
    });
    expect(mergeDayPlan(current, incoming, "fill-empty").morning).toBe(
      "Morning",
    );
    expect(mergeDayPlan(current, incoming, "append").morning).toBe(
      "Morning\n\nAI morning",
    );
  });

  it("merges itinerary top-level fields and days", () => {
    const current = itinerary("Current");
    const incoming = { ...itinerary("AI"), overview: "AI overview" };

    expect(mergeItinerary(current, incoming, "fill-empty").title).toBe("Current");
    expect(mergeItinerary(current, incoming, "append").title).toBe(
      "Current\n\nAI",
    );
    expect(mergeItinerary(current, incoming, "replace").title).toBe("AI");
  });
});
