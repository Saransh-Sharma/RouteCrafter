import type { Project } from "@/lib/schemas";

const PROJECT_UPDATE_FIELD_LABELS = {
  name: "name",
  country: "country",
  regions: "regions",
  positioning: "positioning",
  targetAudience: "target audience",
  brandStyle: "brand style",
  productionPlan: "production plan",
  tripConfigs: "trip configuration",
  imagePrompts: "image prompts",
  itineraries: "itineraries",
  listing: "marketplace listing",
  coverImage: "cover image",
  series: "series",
  aiRuns: "AI runs",
  status: "status",
  accent: "accent",
} satisfies Partial<Record<keyof Project, string>>;

function valuesDiffer(previous: unknown, next: unknown): boolean {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

function formatFieldList(fields: string[]): string {
  if (fields.length === 0) return "project details";
  if (fields.length === 1) return fields[0];
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields.at(-1)}`;
}

export function projectUpdateDetail(
  previous: Project | undefined,
  next: Project | undefined,
): string {
  if (!previous || !next) return "updated project details";

  const changedFields = Object.entries(PROJECT_UPDATE_FIELD_LABELS)
    .filter(([field]) =>
      valuesDiffer(
        previous[field as keyof Project],
        next[field as keyof Project],
      ),
    )
    .map(([, label]) => label);

  return `updated ${formatFieldList(changedFields)}`;
}
