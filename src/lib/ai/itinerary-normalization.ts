import {
  budgetEnum,
  dayPlanSchema,
  enumValues,
  itineraryOutputSchema,
  paceEnum,
  travelStyleEnum,
  travelerTypeEnum,
  type DayPlan,
  type ItineraryOutput,
  type Project,
} from "@/lib/schemas";

function enumValue<T extends string>(
  value: unknown,
  options: readonly T[],
): T | undefined {
  if (typeof value !== "string") return undefined;
  const exact = options.find((option) => option === value);
  if (exact) return exact;

  const lowerValue = value.trim().toLowerCase();
  const caseInsensitive = options.find(
    (option) => option.toLowerCase() === lowerValue,
  );
  if (caseInsensitive) return caseInsensitive;

  const parts = value
    .split(/[,;/|]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return options.find((option) => parts.includes(option.toLowerCase()));
}

export function normalizeAiDayPlan(raw: unknown, current?: DayPlan): DayPlan {
  const candidate =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<DayPlan>)
      : {};
  return dayPlanSchema.parse({
    ...candidate,
    day: current?.day ?? candidate.day,
    pace: enumValue(candidate.pace, paceEnum.options) ?? current?.pace,
  });
}

export function normalizeAiItinerary(
  raw: unknown,
  {
    project,
    current,
    fallback,
  }: {
    project: Project;
    current: ItineraryOutput | null;
    fallback: {
      id: string;
      duration: string;
      travelerType: string;
      createdAt: string;
    };
  },
): ItineraryOutput {
  const candidate =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Partial<ItineraryOutput>)
      : {};
  const currentStyle =
    current?.style && travelStyleEnum.safeParse(current.style).success
      ? current.style
      : undefined;
  const currentBudget =
    current?.budget && budgetEnum.safeParse(current.budget).success
      ? current.budget
      : undefined;

  return itineraryOutputSchema.parse({
    ...candidate,
    id: current?.id || fallback.id,
    plannedEditionId: current?.plannedEditionId ?? candidate.plannedEditionId,
    country: project.country,
    duration: current?.duration || fallback.duration,
    travelerType:
      (current?.travelerType &&
      travelerTypeEnum.safeParse(current.travelerType).success
        ? current.travelerType
        : enumValue(candidate.travelerType, enumValues.travelerType)) ||
      fallback.travelerType,
    style: enumValue(candidate.style, enumValues.travelStyle) ?? currentStyle,
    budget: enumValue(candidate.budget, enumValues.budget) ?? currentBudget,
    pdfTheme: current?.pdfTheme ?? candidate.pdfTheme,
    coverImage: current?.coverImage ?? candidate.coverImage,
    createdAt: current?.createdAt || fallback.createdAt,
    updatedAt: new Date().toISOString(),
    days: (candidate.days ?? []).map((day, index) =>
      normalizeAiDayPlan(day, current?.days[index]),
    ),
  });
}
