import {
  expect,
  test as base,
  type Page,
  type Route,
} from "@playwright/test";
import {
  buildContext,
  buildImagePrompts,
  buildItinerary,
  buildListing,
  buildMatrix,
  renderTemplate,
  templates,
} from "../src/lib/generation";
import {
  createEmptyTripConfig,
  CURRENT_SCHEMA_VERSION,
  projectSchema,
  type Project,
} from "../src/lib/schemas";
import { seedProjects } from "../src/lib/seed-projects";

export const FULL_PROJECT_ID = "e2e-complete-project";
export const EMPTY_PROJECT_ID = "e2e-empty-project";

const now = "2026-06-12T08:00:00.000Z";

function createProject(input: Partial<Project> & Pick<Project, "id" | "name">) {
  return projectSchema.parse({
    country: "Portugal",
    regions: ["Lisbon", "Sintra", "Porto"],
    positioning: "Human-paced Portugal with food, rail, and local neighborhoods.",
    targetAudience: "First-time couples",
    travelStyles: ["Food/culture heavy", "Local-first slow travel"],
    travelerTypes: ["Couple", "Solo"],
    durations: ["5 days", "7 days"],
    deliverables: ["PDF", "Food guide", "Packing list"],
    status: "In progress",
    accent: "teal",
    createdAt: now,
    updatedAt: now,
    ...input,
  });
}

export function buildFullProject(): Project {
  const config = createEmptyTripConfig({
    id: "e2e-trip-config",
    cities: ["Lisbon", "Sintra", "Porto"],
    duration: "5 days",
    travelerType: "Couple",
    travelStyles: ["Food/culture heavy", "Local-first slow travel"],
    pace: "Balanced",
    budget: "Mid-range",
    accommodation: ["Boutique"],
    food: ["Local food", "Cafés"],
    transport: ["Scenic rail", "Walking-heavy"],
    interests: ["Food", "Architecture", "Local neighborhoods"],
    constraints: ["Avoid tourist traps"],
    seasonMonth: "September",
    arrivalCity: "Lisbon",
    departureCity: "Porto",
    arrivalTime: "Morning",
    departureTime: "Evening",
    mustSee: ["Jerónimos Monastery", "Douro Valley"],
    avoid: ["Overpacked day tours"],
    specialOccasion: "Anniversary",
    deliverables: ["PDF", "Food guide", "Packing list"],
    updatedAt: now,
  });
  let project = createProject({
    id: FULL_PROJECT_ID,
    name: "Portugal Editorial Escape",
    tripConfigs: [config],
  });
  const context = buildContext(project);
  const itinerary = buildItinerary(context, {
    duration: "5 days",
    travelerType: "Couple",
    style: "Food/culture heavy",
  });
  itinerary.id = "e2e-itinerary";
  itinerary.plannedEditionId = "e2e-edition";
  itinerary.title = "Five Days Across Portugal";
  itinerary.days = itinerary.days.map((day, index) => ({
    ...day,
    base: day.base || (index < 3 ? "Lisbon" : "Porto"),
    morning:
      day.morning ||
      "Explore a compact neighborhood with a practical, human-paced route.",
  }));
  itinerary.days[0].morning = "Arrive in Lisbon and settle into the Baixa.";
  itinerary.days[0].lunch = "Seasonal Portuguese lunch near the hotel.";
  itinerary.days[0].rainyDayAlternative = "Visit the tile museum.";
  itinerary.foodGuide = "Prioritize neighborhood tascas and market lunches.";
  itinerary.transportGuide = "Use intercity rail between Lisbon and Porto.";
  itinerary.packingList = "Comfortable shoes, light layers, reusable bottle.";
  itinerary.bookingChecklist =
    "Reserve rail seats and timed-entry attractions after checking live terms.";
  itinerary.personalizationQuestions =
    "Share preferred pace, dietary needs, and any fixed arrival details.";
  itinerary.verificationNotes =
    "Verify live opening hours, prices, tickets, and availability.";

  project = projectSchema.parse({
    ...project,
    matrix: buildMatrix(context),
    itineraries: [itinerary],
    listing: {
      ...buildListing(context),
      packages: buildListing(context).packages.map((item, index) => ({
        ...item,
        price: `$${79 + index * 40}`,
      })),
    },
    imagePrompts: buildImagePrompts(context).map((prompt) => ({
      ...prompt,
      isFinal: true,
    })),
    productionPlan: {
      offerModel: "hybrid",
      channels: ["etsy", "fiverr"],
      outputs: [
        "marketplace-listing",
        "pdf",
        "spreadsheet",
        "food-guide",
        "packing-list",
        "booking-checklist",
        "portfolio-visuals",
      ],
      editions: [
        {
          id: "e2e-edition",
          duration: "5 days",
          travelerType: "Couple",
          itineraryId: "e2e-itinerary",
          createdAt: now,
        },
      ],
      review: {
        liveDataVerified: false,
        presentationReviewed: false,
        backupConfirmed: false,
      },
    },
    generated: Object.fromEntries(
      templates.map((template) => [
        template.id,
        renderTemplate(template.id, context),
      ]),
    ),
    aiRuns: [
      {
        id: "e2e-ai-run",
        provider: "openai",
        model: "gpt-5.2",
        taskType: "listing",
        label: "Polished listing",
        source: "listing",
        createdAt: now,
        appliedAt: now,
        usage: { inputTokens: 300, outputTokens: 500, totalTokens: 800 },
      },
    ],
  });
  return project;
}

export function buildEmptyProject(): Project {
  return createProject({
    id: EMPTY_PROJECT_ID,
    name: "Portugal Blank Canvas",
    status: "Draft",
    tripConfigs: [],
    matrix: undefined,
    itineraries: [],
    listing: undefined,
    imagePrompts: [],
    generated: {},
    aiRuns: [],
  });
}

export const fullProject = buildFullProject();
export const emptyProject = buildEmptyProject();

export const aiSettings = {
  providers: {
    openai: {
      apiKey: "sk-e2e-openai-key",
      customTextModel: "",
      customImageModel: "",
    },
    anthropic: {
      apiKey: "",
      customTextModel: "",
      customImageModel: "",
    },
    gemini: {
      apiKey: "",
      customTextModel: "",
      customImageModel: "",
    },
  },
  text: {
    provider: "openai",
    model: "gpt-5.2",
    temperature: 0.7,
    topP: 0.9,
    maxOutputTokens: 4000,
  },
  image: {
    provider: "openai",
    model: "gpt-image-1",
    size: "1024x1024",
    quality: "medium",
    aspectRatio: "1:1",
  },
  requirePreviewBeforeApply: true,
  showBillableConfirmation: true,
};

export async function seedBrowser(
  page: Page,
  projects: Project[] = [fullProject, emptyProject],
  options: { withAiKey?: boolean } = {},
) {
  const projectState = JSON.stringify({
    state: { projects, initialized: true },
    version: CURRENT_SCHEMA_VERSION,
  });
  const settingsState = JSON.stringify({
    state: options.withAiKey
      ? aiSettings
      : {
          ...aiSettings,
          providers: Object.fromEntries(
            Object.entries(aiSettings.providers).map(([provider, settings]) => [
              provider,
              { ...settings, apiKey: "" },
            ]),
          ),
        },
    version: 1,
  });
  await page.addInitScript(
    ({ projectState, settingsState }) => {
      if (!window.localStorage.getItem("routecrafter:v1")) {
        window.localStorage.setItem("routecrafter:v1", projectState);
      }
      if (!window.localStorage.getItem("routecrafter:ai-settings:v1")) {
        window.localStorage.setItem(
          "routecrafter:ai-settings:v1",
          settingsState,
        );
      }
      if (!window.localStorage.getItem("routecrafter:activity:v1")) {
        window.localStorage.setItem(
          "routecrafter:activity:v1",
          JSON.stringify({ state: { entries: [] }, version: 0 }),
        );
      }
    },
    { projectState, settingsState },
  );
}

export async function prepareApp(
  page: Page,
  options: {
    projects?: Project[];
    withAiKey?: boolean;
  } = {},
) {
  await seedBrowser(page, options.projects, {
    withAiKey: options.withAiKey,
  });
}

export async function mockAiText(
  page: Page,
  text: string,
  status = 200,
) {
  await page.route("**/api/ai/text", async (route) => {
    await fulfillAiRoute(route, {
      status,
      body:
        status >= 400
          ? { error: text }
          : {
              text,
              provider: "openai",
              model: "gpt-5.2",
              usage: {
                inputTokens: 100,
                outputTokens: 200,
                totalTokens: 300,
              },
            },
    });
  });
}

export async function mockAiImage(page: Page, image: string) {
  await page.route("**/api/ai/image", async (route) => {
    await fulfillAiRoute(route, {
      status: 200,
      body: {
        image,
        mimeType: "image/svg+xml",
        provider: "openai",
        model: "gpt-image-1",
        usage: { images: 1 },
      },
    });
  });
}

async function fulfillAiRoute(
  route: Route,
  response: { status: number; body: unknown },
) {
  await route.fulfill({
    status: response.status,
    contentType: "application/json",
    body: JSON.stringify(response.body),
  });
}

export const mockImageDataUrl =
  "data:image/svg+xml;base64," +
  Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="#5c7563"/></svg>',
  ).toString("base64");

type SeededFixtures = {
  seededPage: Page;
};

export const test = base.extend<SeededFixtures>({
  seededPage: async ({ page }, runFixture) => {
    await prepareApp(page);
    await runFixture(page);
  },
});

export { expect, seedProjects };
