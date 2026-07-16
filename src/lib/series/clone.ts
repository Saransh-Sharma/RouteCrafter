import {
  projectSchema,
  type PdfTheme,
  type Project,
  type SeriesLink,
} from "@/lib/schemas";

/**
 * Structural clone of a product for a new country — instant and AI-free.
 * Copies the product's commercial structure (offer model, channels, outputs,
 * editions, brand, brief shape) and blanks everything country-specific.
 * Persisting this draft first is the series pipeline's failure-isolation
 * anchor: any later AI step can fail and retry against it.
 */
export function cloneProductSkeleton({
  source,
  targetCountry,
  series,
}: {
  source: Project;
  targetCountry: string;
  series: SeriesLink;
}): Project {
  const timestamp = new Date().toISOString();
  const name = source.country
    ? source.name.replaceAll(source.country, targetCountry)
    : `${targetCountry} · ${source.name}`;

  return projectSchema.parse({
    id: crypto.randomUUID(),
    name: name === source.name ? `${source.name} — ${targetCountry}` : name,
    country: targetCountry,
    regions: [],
    positioning: "",
    targetAudience: source.targetAudience,
    brandStyle: source.brandStyle,
    coverImage: "",
    series,
    productionPlan: {
      ...source.productionPlan,
      editions: source.productionPlan.editions.map((edition) => ({
        ...edition,
        id: crypto.randomUUID(),
        cities: [],
        route: [],
        itineraryId: undefined,
        sourceEditionId: edition.id,
        lineageNote: `Transposed from ${source.country || source.name}`,
      })),
      review: {
        liveDataVerified: false,
        presentationReviewed: false,
        backupConfirmed: false,
      },
    },
    tripConfigs: source.tripConfigs.map((config, index) => ({
      ...config,
      id: crypto.randomUUID(),
      // Keep the brief's style/pace/budget/interests; drop places.
      cities: [],
      arrivalCity: "",
      departureCity: "",
      mustSee: [],
      avoid: [],
      updatedAt: timestamp,
      label: index === 0 ? "Primary configuration" : config.label,
    })),
    imagePrompts: [],
    itineraries: [],
    listing: undefined,
    aiRuns: [],
    status: "Draft",
    accent: source.accent,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

/** The PDF theme the transposed itineraries should inherit. */
export function sourcePdfTheme(source: Project): PdfTheme {
  return source.itineraries[0]?.pdfTheme ?? "beige";
}
