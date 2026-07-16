import {
  templateSchema,
  type Project,
  type Template,
  type TemplateCategory,
} from "./schemas";

function now() {
  return new Date().toISOString();
}

function seedTemplate(
  id: string,
  name: string,
  description: string,
  category: TemplateCategory,
  project: unknown,
): Template {
  return templateSchema.parse({
    id,
    name,
    description,
    category,
    accent: "sage",
    project,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  });
}

export const seedTemplates: Template[] = [
  seedTemplate(
    "starter-food-culture-city-break",
    "Food & culture city break",
    "A compact, sensory itinerary for sellers building weekend city products.",
    "traveler-preset",
    {
      positioning: "A food-led city break with culture, walkable neighborhoods, and flexible evenings.",
      targetAudience: "Couples and solo travelers who want polished local flavor without overplanning.",
      travelStyles: ["Food/culture heavy", "Classic first-timer"],
      travelerTypes: ["Solo", "Couple"],
      durations: ["3 days", "5 days"],
      productionPlan: { outputs: ["marketplace-listing", "pdf", "food-guide"] },
    },
  ),
  seedTemplate(
    "starter-slow-travel-couple",
    "Slow-travel couple",
    "A calmer premium template with generous pacing and boutique positioning.",
    "traveler-preset",
    {
      positioning: "A romantic, low-friction route with fewer hotel moves and room for discovery.",
      targetAudience: "Couples who prefer atmosphere, food, and relaxed pacing over checklists.",
      travelStyles: ["Local-first slow travel", "Romantic", "Food/culture heavy"],
      travelerTypes: ["Couple"],
      durations: ["7 days", "10 days"],
      brandStyle: { voice: "premium" },
      productionPlan: { outputs: ["marketplace-listing", "pdf", "food-guide", "packing-list"] },
    },
  ),
  seedTemplate(
    "starter-family-first-timer",
    "Family first-timer",
    "Practical family scaffolding with backup plans and low-energy alternatives.",
    "traveler-preset",
    {
      positioning: "A first-time family itinerary with simple transfers, recovery windows, and rainy-day options.",
      targetAudience: "Parents planning a confident first trip with children.",
      travelStyles: ["Family-friendly", "Classic first-timer"],
      travelerTypes: ["Family"],
      durations: ["7 days", "10 days"],
      brandStyle: { voice: "friendly" },
      productionPlan: { outputs: ["marketplace-listing", "pdf", "packing-list", "booking-checklist"] },
    },
  ),
  seedTemplate(
    "starter-japan-golden-route",
    "Japan golden route",
    "A country starter for Tokyo, Hakone, Kyoto, and Osaka products.",
    "country-starter",
    {
      country: "Japan",
      regions: ["Tokyo", "Hakone", "Kyoto", "Osaka"],
      positioning: "A polished first-timer Japan route with food, culture, and clear transport notes.",
      targetAudience: "First-time visitors who want an easy route through Japan's classic stops.",
      travelStyles: ["Classic first-timer", "Food/culture heavy", "Spiritual/cultural"],
      travelerTypes: ["Couple", "Family", "Solo"],
      durations: ["7 days", "10 days", "14 days"],
    },
  ),
  seedTemplate(
    "starter-italy-slow-route",
    "Italy slow route",
    "A country starter for slower Rome, Florence, and Venice editions.",
    "country-starter",
    {
      country: "Italy",
      regions: ["Rome", "Florence", "Venice"],
      positioning: "A slower classic Italy route balancing art, food, train travel, and unstructured afternoons.",
      targetAudience: "Couples and families who want the classics without an exhausting pace.",
      travelStyles: ["Classic first-timer", "Food/culture heavy", "Local-first slow travel"],
      travelerTypes: ["Couple", "Family"],
      durations: ["7 days", "10 days"],
    },
  ),
];

export interface SanitizeProjectForTemplateInput {
  name: string;
  description?: string;
  includeStarterRoute?: boolean;
  includeMappedCoords?: boolean;
}

export function sanitizeProjectForTemplate(
  project: Project,
  input: SanitizeProjectForTemplateInput,
): Template {
  const timestamp = now();
  const primaryItinerary = project.itineraries[0];
  const includeStarterRoute = input.includeStarterRoute ?? true;
  const includeMappedCoords = input.includeMappedCoords ?? false;
  return templateSchema.parse({
    id: crypto.randomUUID(),
    name: input.name,
    description: input.description ?? "",
    category: "my-template",
    accent: project.accent,
    project: {
      country: project.country,
      regions: project.regions,
      positioning: project.positioning,
      targetAudience: project.targetAudience,
      brandStyle: project.brandStyle,
      productionPlan: {
        ...project.productionPlan,
        editions: project.productionPlan.editions.map((edition) => ({
          ...edition,
          id: crypto.randomUUID(),
          route: includeStarterRoute
            ? edition.route.map((stop) => ({
                ...stop,
                id: crypto.randomUUID(),
                coords: includeMappedCoords ? stop.coords : undefined,
              }))
            : [],
          cities: includeStarterRoute ? edition.cities : [],
          itineraryId: undefined,
          sourceEditionId: undefined,
          lineageNote: "Template starter route",
        })),
        review: {
          liveDataVerified: false,
          presentationReviewed: false,
          backupConfirmed: false,
        },
      },
      tripConfigs: project.tripConfigs.map((config) => ({
        ...config,
        id: crypto.randomUUID(),
        updatedAt: timestamp,
      })),
      pdfTheme: primaryItinerary?.pdfTheme ?? "beige",
      promptTweaks: {},
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export function sanitizeProjectToTemplate(
  project: Project,
  input: SanitizeProjectForTemplateInput,
): Template {
  return sanitizeProjectForTemplate(project, input);
}
