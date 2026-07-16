import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  buildContext,
  buildImagePrompt,
  buildItinerary,
  buildListing,
} from "../src/lib/generation";
import {
  CURRENT_SCHEMA_VERSION,
  createEmptyTripConfig,
  projectSchema,
  type Accommodation,
  type Budget,
  type Constraint,
  type Deliverable,
  type Duration,
  type FoodPref,
  type Interest,
  type Pace,
  type Project,
  type TravelStyle,
  type TravelerType,
  type TransportPref,
} from "../src/lib/schemas";

const username = process.env.ROUTECRAFTER_PROD_USERNAME ?? "saransh";
const password = process.env.ROUTECRAFTER_PROD_PASSWORD;
const runStamp = new Date().toISOString().slice(0, 10);

type Severity = "blocker" | "major" | "minor" | "observation";
type AiMode = "text" | "image";

type Issue = {
  severity: Severity;
  country?: string;
  variation?: string;
  stage: string;
  action: string;
  url?: string;
  status?: number;
  model?: string;
  credentialSource?: string;
  consoleError?: string;
  error?: string;
  detail?: string;
};

type AiDiagnostic = {
  country?: string;
  variation?: string;
  url: string;
  method: string;
  request?: unknown;
  status?: number;
  response?: unknown;
  error?: string;
  providerAttempts?: number;
};

type AwaitedAiResponse =
  | { ok: true; response: Awaited<ReturnType<Page["waitForResponse"]>> }
  | { ok: false; error: string };

type CloudProject = {
  project: Project;
  revision: number;
};

type Scenario = {
  country: string;
  variation: string;
  regions: string[];
  audience: string;
  styles: TravelStyle[];
  travelerTypes: TravelerType[];
  durations: Duration[];
  pace: Pace;
  budget: Budget;
  accommodation: Accommodation[];
  food: FoodPref[];
  transport: TransportPref[];
  interests: Interest[];
  constraints: Constraint[];
  seasonMonth: string;
  arrivalCity: string;
  departureCity: string;
  arrivalTime: string;
  departureTime: string;
  mustSee: string[];
  avoid: string[];
  specialOccasion?: string;
  positioning: string;
  imageAngles: Array<{
    kind: "hero" | "what-youll-get" | "sample-itinerary" | "beyond-the-brochure" | "built-around-style";
    title: string;
    goal: string;
    visualElements: string;
    textOverlay: string;
  }>;
};

let authCookies: Awaited<ReturnType<BrowserContext["cookies"]>> | null = null;

test.describe.serial("deep persistent production AI audit", () => {
  test.beforeAll(() => {
    if (process.env.ROUTECRAFTER_PROD_AUDIT !== "1") {
      throw new Error(
        "Production audit is opt-in only. Set ROUTECRAFTER_PROD_AUDIT=1 to run this suite.",
      );
    }
    if (!password) {
      throw new Error(
        "ROUTECRAFTER_PROD_PASSWORD is required for production E2E.",
      );
    }
  });

  test("signs in once through the production login UI", async ({
    page,
    context,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(username);
    await page.locator("#login-password").fill(password!);

    const response = await submitUiLogin(page);
    expect(response.status()).toBe(200);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByRole("button", { name: /Logout|Open user menu/ }),
    ).toBeVisible();
    authCookies = await context.cookies();
  });

  test("reports server OpenAI as gpt-5.4 and gpt-image-2", async ({
    context,
  }, testInfo) => {
    await ensureSignedIn(context);

    const response = await context.request.get("/api/ai/config", {
      headers: { Accept: "application/json" },
    });
    const body = await response.json().catch(() => null);
    await attachJson(testInfo, "ai-config", { status: response.status(), body });

    expect(response.ok()).toBe(true);
    expect(body).toMatchObject({
      serverOpenAiAvailable: true,
      serverTextModel: "gpt-5.4",
      serverImageModel: "gpt-image-2",
    });
    expect(JSON.stringify(body)).not.toContain("mini");
  });

  test("creates kept multi-country projects and audits maximal AI flows", async ({
    page,
    context,
  }, testInfo) => {
    await ensureSignedIn(context);
    await clearPersonalAiKeys(page);

    const issues: Issue[] = [];
    const diagnostics: AiDiagnostic[] = [];
    const consoleErrors: string[] = [];
    const projects: Array<{
      id: string;
      name: string;
      country: string;
      variation: string;
    }> = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    try {
      for (const scenario of scenarios) {
        const project = buildProject(scenario);
        projects.push({
          id: project.id,
          name: project.name,
          country: scenario.country,
          variation: scenario.variation,
        });

        const created = await createKeptProject(context.request, project, issues);
        if (!created) break;

        await auditVariation(
          page,
          created.project,
          scenario,
          diagnostics,
          issues,
          consoleErrors,
        );
      }
    } finally {
      await attachJson(testInfo, "created-production-projects", projects);
      await attachJson(
        testInfo,
        "ai-network-diagnostics",
        summarizeDiagnostics(diagnostics),
      );
      await attachJson(testInfo, "browser-console-errors", consoleErrors);
      await attachJson(testInfo, "production-issue-ledger", issues);
    }

    const blockers = issues.filter((issue) => issue.severity === "blocker");
    expect(blockers, JSON.stringify(blockers, null, 2)).toHaveLength(0);
  });
});

const baseDeliverables: Deliverable[] = [
  "PDF",
  "Spreadsheet",
  "Food guide",
  "Booking checklist",
  "Fiverr listing copy",
  "Portfolio image prompts",
];

const scenarios: Scenario[] = [
  {
    country: "Japan",
    variation: "Rail & Ryokan Design Route",
    regions: ["Tokyo", "Kanazawa", "Kyoto", "Kinosaki"],
    audience: "Premium couples who want rail ease, design hotels, craft, food, and onsen rhythm.",
    styles: ["Premium comfort", "Food/culture heavy", "Local-first slow travel"],
    travelerTypes: ["Couple", "Luxury travelers"],
    durations: ["7 days", "10 days"],
    pace: "Balanced",
    budget: "Premium",
    accommodation: ["Boutique", "Luxury hotel"],
    food: ["Local food", "Fine dining", "Cafés"],
    transport: ["Scenic rail", "Public transport", "Walking-heavy"],
    interests: ["Food", "Architecture", "Local neighborhoods", "Photography"],
    constraints: ["Avoid tourist traps"],
    seasonMonth: "November",
    arrivalCity: "Tokyo",
    departureCity: "Osaka",
    arrivalTime: "Afternoon",
    departureTime: "Evening",
    mustSee: ["Kanazawa craft district", "Kyoto machiya lanes", "Kinosaki onsen"],
    avoid: ["One-night city hopping", "Generic Golden Route pacing"],
    specialOccasion: "Anniversary",
    positioning: "A polished rail-and-ryokan Japan product for buyers who want tactile design, food depth, and calm transfers.",
    imageAngles: japanAngles("ryokan suite, lacquerware, shinkansen ticket, Kyoto lanterns"),
  },
  {
    country: "Japan",
    variation: "Autumn Tohoku Slow Travel",
    regions: ["Sendai", "Aomori", "Kakunodate"],
    audience: "Photographers and second-time Japan travelers chasing foliage without Kyoto crowds.",
    styles: ["Photography", "Local-first slow travel", "Nature/adventure"],
    travelerTypes: ["Solo", "Couple"],
    durations: ["7 days", "10 days"],
    pace: "Relaxed",
    budget: "Mid-range",
    accommodation: ["Central convenience", "Boutique"],
    food: ["Local food", "Cafés"],
    transport: ["Scenic rail", "Public transport"],
    interests: ["Photography", "Nature", "Local neighborhoods", "Markets"],
    constraints: ["Avoid tourist traps", "Avoid strenuous walking"],
    seasonMonth: "October",
    arrivalCity: "Sendai",
    departureCity: "Aomori",
    arrivalTime: "Morning",
    departureTime: "Afternoon",
    mustSee: ["Kakunodate samurai district", "Oirase stream", "local sake bars"],
    avoid: ["Overbuilt Instagram stops"],
    positioning: "A slow Tohoku autumn route balancing scenic rail, photo windows, and practical rural logistics.",
    imageAngles: japanAngles("maple leaves, rural train, lacquer lunch tray, quiet samurai street"),
  },
  {
    country: "Japan",
    variation: "Family Anime & Nature Loop",
    regions: ["Tokyo", "Hakone", "Kyoto", "Nara"],
    audience: "Families who want anime energy, easy nature, and culture without exhausting children.",
    styles: ["Family-friendly", "Classic first-timer", "Nature/adventure"],
    travelerTypes: ["Family"],
    durations: ["7 days", "10 days"],
    pace: "Balanced",
    budget: "Mid-range",
    accommodation: ["Family-friendly", "Central convenience"],
    food: ["Kid-friendly", "Local food", "Cafés"],
    transport: ["Public transport", "Scenic rail", "Low walking"],
    interests: ["Theme parks", "Nature", "Temples/churches", "Shopping"],
    constraints: ["Kids", "Avoid strenuous walking"],
    seasonMonth: "April",
    arrivalCity: "Tokyo",
    departureCity: "Osaka",
    arrivalTime: "Morning",
    departureTime: "Evening",
    mustSee: ["Ghibli-inspired neighborhoods", "Hakone lake views", "Nara deer park"],
    avoid: ["Late-night bar areas", "Long museum blocks"],
    positioning: "A family-first Japan loop that gives kids memorable pop culture and parents a calmer cultural backbone.",
    imageAngles: japanAngles("family rail passes, Mt Fuji lake, anime-style shopping street, deer park"),
  },
  {
    country: "Morocco",
    variation: "Design Souks & Desert",
    regions: ["Marrakech", "Ait Ben Haddou", "Agafay"],
    audience: "Design-led small groups who want riads, craft sourcing, and a desert-feeling finale.",
    styles: ["Food/culture heavy", "Photography", "Premium comfort"],
    travelerTypes: ["Group", "Luxury travelers"],
    durations: ["5 days", "7 days"],
    pace: "Balanced",
    budget: "Premium",
    accommodation: ["Boutique", "Luxury hotel"],
    food: ["Local food", "Fine dining"],
    transport: ["Private car", "Walking-heavy"],
    interests: ["Markets", "Architecture", "Photography", "Food"],
    constraints: ["Avoid tourist traps"],
    seasonMonth: "March",
    arrivalCity: "Marrakech",
    departureCity: "Marrakech",
    arrivalTime: "Afternoon",
    departureTime: "Morning",
    mustSee: ["private riad courtyard", "textile souks", "Ait Ben Haddou"],
    avoid: ["Forced shopping stops", "generic camel-tour pacing"],
    positioning: "A design-rich Morocco product for buyers who want beauty, craft context, and managed desert logistics.",
    imageAngles: moroccoAngles("riad courtyard, zellige tiles, woven textiles, desert dinner"),
  },
  {
    country: "Morocco",
    variation: "Atlantic Creative Coast",
    regions: ["Essaouira", "Taghazout", "Casablanca"],
    audience: "Solo creatives and couples who want surf, seafood, galleries, and an easier coastal pace.",
    styles: ["Local-first slow travel", "Wellness", "Food/culture heavy"],
    travelerTypes: ["Solo", "Couple"],
    durations: ["7 days", "10 days"],
    pace: "Relaxed",
    budget: "Mid-range",
    accommodation: ["Boutique", "Apartment"],
    food: ["Local food", "Cafés", "No alcohol"],
    transport: ["Private car", "Low walking"],
    interests: ["Beaches", "Markets", "Food", "Wellness"],
    constraints: ["Avoid tourist traps"],
    seasonMonth: "May",
    arrivalCity: "Casablanca",
    departureCity: "Agadir",
    arrivalTime: "Morning",
    departureTime: "Afternoon",
    mustSee: ["Essaouira ramparts", "Taghazout surf cafes", "seafood harbor lunch"],
    avoid: ["Rushed Marrakech add-on"],
    positioning: "A coastal Morocco route selling creative breathing room, surf-town rhythm, and practical transfers.",
    imageAngles: moroccoAngles("blue fishing boats, surf cafe, gallery wall, seafood table"),
  },
  {
    country: "Morocco",
    variation: "Imperial Cities Private Route",
    regions: ["Fes", "Meknes", "Rabat", "Marrakech"],
    audience: "Senior travelers who want historical depth, private drivers, and comfort-first pacing.",
    styles: ["Classic first-timer", "Premium comfort", "Spiritual/cultural"],
    travelerTypes: ["Senior travelers", "Luxury travelers"],
    durations: ["10 days", "14 days"],
    pace: "Relaxed",
    budget: "Premium",
    accommodation: ["Luxury hotel", "Central convenience"],
    food: ["Local food", "Fine dining"],
    transport: ["Private car", "Low walking"],
    interests: ["Landmarks", "Architecture", "Museums", "Food"],
    constraints: ["Elderly travelers", "Avoid strenuous walking"],
    seasonMonth: "October",
    arrivalCity: "Casablanca",
    departureCity: "Marrakech",
    arrivalTime: "Afternoon",
    departureTime: "Morning",
    mustSee: ["Fes medina with guide", "Rabat kasbah", "Marrakech gardens"],
    avoid: ["Long walking-only medina days"],
    positioning: "A comfort-led Morocco classics route that packages history with realistic mobility and guide planning.",
    imageAngles: moroccoAngles("imperial gate, calm riad breakfast, private driver notes, garden pathway"),
  },
  {
    country: "Iceland",
    variation: "Winter Lights Flex Route",
    regions: ["Reykjavik", "South Coast", "Snaefellsnes"],
    audience: "Couples who want northern lights potential with realistic weather backups.",
    styles: ["Romantic", "Nature/adventure", "Photography"],
    travelerTypes: ["Couple"],
    durations: ["5 days", "7 days"],
    pace: "Balanced",
    budget: "Premium",
    accommodation: ["Boutique", "Central convenience"],
    food: ["Local food", "Cafés"],
    transport: ["Self-drive", "Private car"],
    interests: ["Nature", "Photography", "Wellness"],
    constraints: ["Avoid strenuous walking"],
    seasonMonth: "February",
    arrivalCity: "Reykjavik",
    departureCity: "Reykjavik",
    arrivalTime: "Morning",
    departureTime: "Afternoon",
    mustSee: ["South Coast waterfalls", "aurora watch nights", "lava fields"],
    avoid: ["Unsafe storm-day driving", "overpromising aurora visibility"],
    positioning: "A winter Iceland product that sells wonder while clearly planning around weather uncertainty.",
    imageAngles: icelandAngles("aurora cabin, black sand beach, weather plan cards, thermal pool steam"),
  },
  {
    country: "Iceland",
    variation: "Geothermal Wellness Escape",
    regions: ["Reykjavik", "Hvammsvik", "Hella"],
    audience: "Wellness travelers who want lagoons, slow mornings, design stays, and soft adventure.",
    styles: ["Wellness", "Premium comfort", "Romantic"],
    travelerTypes: ["Couple", "Luxury travelers"],
    durations: ["5 days", "7 days"],
    pace: "Relaxed",
    budget: "Luxury",
    accommodation: ["Luxury hotel", "Boutique"],
    food: ["Fine dining", "Local food"],
    transport: ["Private car", "Low walking"],
    interests: ["Wellness", "Nature", "Food"],
    constraints: ["Avoid strenuous walking"],
    seasonMonth: "September",
    arrivalCity: "Reykjavik",
    departureCity: "Reykjavik",
    arrivalTime: "Afternoon",
    departureTime: "Evening",
    mustSee: ["Hvammsvik hot springs", "design hotel spa", "South Coast easy viewpoint"],
    avoid: ["Packed sightseeing loops"],
    positioning: "A geothermal Iceland escape built around restorative pacing, premium stays, and low-friction nature.",
    imageAngles: icelandAngles("minimalist spa robe, steam lagoon, mossy lava field, design hotel breakfast"),
  },
  {
    country: "Iceland",
    variation: "Family Fire & Ice Week",
    regions: ["Golden Circle", "Vik", "Westman Islands"],
    audience: "Families who want wildlife, waterfalls, easy hikes, and safety-first logistics.",
    styles: ["Family-friendly", "Nature/adventure", "Classic first-timer"],
    travelerTypes: ["Family"],
    durations: ["7 days"],
    pace: "Balanced",
    budget: "Mid-range",
    accommodation: ["Family-friendly", "Apartment"],
    food: ["Kid-friendly", "Local food"],
    transport: ["Self-drive", "Low walking"],
    interests: ["Nature", "Beaches", "Photography"],
    constraints: ["Kids", "Avoid strenuous walking"],
    seasonMonth: "June",
    arrivalCity: "Reykjavik",
    departureCity: "Reykjavik",
    arrivalTime: "Morning",
    departureTime: "Afternoon",
    mustSee: ["puffin viewing", "waterfall picnic", "lava show"],
    avoid: ["long gravel-road detours"],
    positioning: "A family Iceland route that turns dramatic landscapes into safe, flexible, child-friendly days.",
    imageAngles: icelandAngles("family rain jackets, puffin cliffs, waterfall picnic, lava museum tickets"),
  },
  {
    country: "Vietnam",
    variation: "North-to-South Food Trail",
    regions: ["Hanoi", "Hue", "Hoi An", "Saigon"],
    audience: "Food-first couples who want markets, rail rhythm, street food, and cooking context.",
    styles: ["Food/culture heavy", "Local-first slow travel", "Classic first-timer"],
    travelerTypes: ["Couple"],
    durations: ["10 days", "14 days"],
    pace: "Balanced",
    budget: "Mid-range",
    accommodation: ["Boutique", "Central convenience"],
    food: ["Street food", "Local food", "Cafés"],
    transport: ["Domestic flights allowed", "Walking-heavy", "Public transport"],
    interests: ["Food", "Markets", "Local neighborhoods"],
    constraints: ["Avoid tourist traps"],
    seasonMonth: "March",
    arrivalCity: "Hanoi",
    departureCity: "Saigon",
    arrivalTime: "Morning",
    departureTime: "Evening",
    mustSee: ["Hanoi street food", "Hue imperial dishes", "Hoi An market", "Saigon cafe culture"],
    avoid: ["generic party backpacker route"],
    positioning: "A Vietnam food trail that packages regional cuisine into a route buyers can actually follow.",
    imageAngles: vietnamAngles("bun cha smoke, lantern alley, train ticket, market herbs"),
  },
  {
    country: "Vietnam",
    variation: "Slow Northern Highlands",
    regions: ["Hanoi", "Ninh Binh", "Pu Luong", "Ha Long"],
    audience: "Photographers who want rice valleys, limestone landscapes, homestays, and slower transfers.",
    styles: ["Photography", "Nature/adventure", "Local-first slow travel"],
    travelerTypes: ["Solo", "Couple"],
    durations: ["7 days", "10 days"],
    pace: "Relaxed",
    budget: "Mid-range",
    accommodation: ["Boutique", "Apartment"],
    food: ["Local food", "Vegetarian"],
    transport: ["Private car", "Low walking"],
    interests: ["Nature", "Photography", "Mountains", "Local neighborhoods"],
    constraints: ["Avoid tourist traps"],
    seasonMonth: "October",
    arrivalCity: "Hanoi",
    departureCity: "Hanoi",
    arrivalTime: "Afternoon",
    departureTime: "Morning",
    mustSee: ["Tam Coc boat route", "Pu Luong rice terraces", "Ha Long overnight water views"],
    avoid: ["overcrowded cruise options"],
    positioning: "A northern Vietnam route selling texture, landscapes, and breathing room instead of checklist tourism.",
    imageAngles: vietnamAngles("rice terrace morning, limestone river boat, homestay table, camera notes"),
  },
  {
    country: "Vietnam",
    variation: "Premium Central Vietnam",
    regions: ["Da Nang", "Hoi An", "Hue"],
    audience: "Luxury travelers who want design resorts, heritage towns, spa time, and private guiding.",
    styles: ["Premium comfort", "Wellness", "Food/culture heavy"],
    travelerTypes: ["Luxury travelers", "Couple"],
    durations: ["5 days", "7 days"],
    pace: "Relaxed",
    budget: "Luxury",
    accommodation: ["Resort", "Luxury hotel"],
    food: ["Fine dining", "Local food", "Cafés"],
    transport: ["Private car", "Low walking"],
    interests: ["Architecture", "Food", "Wellness", "Beaches"],
    constraints: ["Avoid tourist traps"],
    seasonMonth: "April",
    arrivalCity: "Da Nang",
    departureCity: "Da Nang",
    arrivalTime: "Morning",
    departureTime: "Evening",
    mustSee: ["Hoi An heritage lanes", "Hue citadel", "beach resort spa"],
    avoid: ["crowded day-trip buses"],
    positioning: "A premium Central Vietnam product pairing resort ease with sharp cultural curation.",
    imageAngles: vietnamAngles("resort pool, lantern street, imperial gate, spa itinerary page"),
  },
  {
    country: "Peru",
    variation: "Andes & Culinary Lima",
    regions: ["Lima", "Sacred Valley", "Cusco"],
    audience: "Active couples who want culinary Lima, Sacred Valley depth, and altitude-aware routing.",
    styles: ["Food/culture heavy", "Nature/adventure", "Premium comfort"],
    travelerTypes: ["Couple"],
    durations: ["7 days", "10 days"],
    pace: "Balanced",
    budget: "Premium",
    accommodation: ["Boutique", "Central convenience"],
    food: ["Fine dining", "Local food", "Cafés"],
    transport: ["Private car", "Walking-heavy"],
    interests: ["Food", "Mountains", "Markets", "Architecture"],
    constraints: ["Avoid strenuous walking"],
    seasonMonth: "May",
    arrivalCity: "Lima",
    departureCity: "Cusco",
    arrivalTime: "Evening",
    departureTime: "Afternoon",
    mustSee: ["Miraflores tasting route", "Sacred Valley ruins", "Machu Picchu logistics"],
    avoid: ["altitude shock from rushing Cusco"],
    positioning: "A Peru itinerary product that pairs culinary sophistication with careful altitude and rail planning.",
    imageAngles: peruAngles("ceviche counter, Sacred Valley terraces, train ticket, alpaca textile"),
  },
  {
    country: "Peru",
    variation: "Soft Adventure Family Peru",
    regions: ["Lima", "Ollantaytambo", "Machu Picchu"],
    audience: "Families who want the Andes without altitude mistakes or overambitious trekking.",
    styles: ["Family-friendly", "Nature/adventure", "Classic first-timer"],
    travelerTypes: ["Family"],
    durations: ["7 days"],
    pace: "Relaxed",
    budget: "Mid-range",
    accommodation: ["Family-friendly", "Central convenience"],
    food: ["Kid-friendly", "Local food"],
    transport: ["Private car", "Scenic rail", "Low walking"],
    interests: ["Landmarks", "Nature", "Markets"],
    constraints: ["Kids", "Avoid strenuous walking"],
    seasonMonth: "June",
    arrivalCity: "Lima",
    departureCity: "Cusco",
    arrivalTime: "Morning",
    departureTime: "Evening",
    mustSee: ["Machu Picchu", "Ollantaytambo ruins", "family-friendly market walk"],
    avoid: ["long high-altitude hiking days"],
    positioning: "A family Peru route focused on awe, safety, altitude pacing, and realistic train logistics.",
    imageAngles: peruAngles("family train window, stone terraces, market fruit, altitude pacing card"),
  },
  {
    country: "Peru",
    variation: "Textile & Market Immersion",
    regions: ["Cusco", "Pisac", "Chinchero", "Arequipa"],
    audience: "Culture travelers who want textiles, market days, craft context, and design-led stays.",
    styles: ["Spiritual/cultural", "Shopping", "Local-first slow travel"],
    travelerTypes: ["Solo", "Couple"],
    durations: ["10 days", "14 days"],
    pace: "Balanced",
    budget: "Premium",
    accommodation: ["Boutique", "Central convenience"],
    food: ["Local food", "Vegetarian"],
    transport: ["Private car", "Walking-heavy"],
    interests: ["Markets", "Architecture", "Shopping", "Museums"],
    constraints: ["Avoid tourist traps"],
    seasonMonth: "August",
    arrivalCity: "Cusco",
    departureCity: "Arequipa",
    arrivalTime: "Afternoon",
    departureTime: "Morning",
    mustSee: ["Pisac market", "Chinchero weaving", "Arequipa white-stone architecture"],
    avoid: ["performative craft stops with no context"],
    positioning: "A Peru culture product for buyers who want craft, market intelligence, and beautiful routing.",
    imageAngles: peruAngles("woven textiles, market stalls, white volcanic stone, artisan notes"),
  },
];

function japanAngles(detail: string): Scenario["imageAngles"] {
  return imageAngles("Japan", detail);
}

function moroccoAngles(detail: string): Scenario["imageAngles"] {
  return imageAngles("Morocco", detail);
}

function icelandAngles(detail: string): Scenario["imageAngles"] {
  return imageAngles("Iceland", detail);
}

function vietnamAngles(detail: string): Scenario["imageAngles"] {
  return imageAngles("Vietnam", detail);
}

function peruAngles(detail: string): Scenario["imageAngles"] {
  return imageAngles("Peru", detail);
}

function imageAngles(country: string, detail: string): Scenario["imageAngles"] {
  return [
    {
      kind: "hero",
      title: `${country} editorial hero`,
      goal: "Create a premium marketplace hero visual for this travel product.",
      visualElements: detail,
      textOverlay: `${country} Custom Itinerary`,
    },
    {
      kind: "what-youll-get",
      title: `${country} deliverables flatlay`,
      goal: "Show the buyer what files, planning notes, and polished deliverables they receive.",
      visualElements: `PDF mockup, itinerary cards, destination notes, ${detail}`,
      textOverlay: "What You'll Get",
    },
    {
      kind: "sample-itinerary",
      title: `${country} sample day preview`,
      goal: "Preview a day-by-day itinerary page with believable travel details.",
      visualElements: `calendar spread, route notes, meal cues, ${detail}`,
      textOverlay: "Sample Day",
    },
    {
      kind: "beyond-the-brochure",
      title: `${country} local context visual`,
      goal: "Communicate that the product goes beyond generic sightseeing.",
      visualElements: `local texture, practical planning notes, neighborhood cues, ${detail}`,
      textOverlay: "Beyond the Brochure",
    },
    {
      kind: "built-around-style",
      title: `${country} personalization visual`,
      goal: "Show that the itinerary adapts to buyer style, pace, and constraints.",
      visualElements: `style swatches, preference cards, route alternatives, ${detail}`,
      textOverlay: "Built Around You",
    },
  ];
}

function buildProject(scenario: Scenario): Project {
  const now = new Date().toISOString();
  const slug = slugify(`${scenario.country}-${scenario.variation}-${runStamp}`);
  const id = `prod-e2e-keep-${slug}`;
  const tripConfig = createEmptyTripConfig({
    id: `${id}-config`,
    label: scenario.variation,
    cities: scenario.regions,
    duration: scenario.durations[0],
    travelerType: scenario.travelerTypes[0],
    travelStyles: scenario.styles,
    pace: scenario.pace,
    budget: scenario.budget,
    accommodation: scenario.accommodation,
    food: scenario.food,
    transport: scenario.transport,
    interests: scenario.interests,
    constraints: scenario.constraints,
    seasonMonth: scenario.seasonMonth,
    arrivalCity: scenario.arrivalCity,
    departureCity: scenario.departureCity,
    arrivalTime: scenario.arrivalTime,
    departureTime: scenario.departureTime,
    mustSee: scenario.mustSee,
    avoid: scenario.avoid,
    specialOccasion: scenario.specialOccasion ?? "",
    deliverables: baseDeliverables,
    updatedAt: now,
  });

  let project = projectSchema.parse({
    id,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: `Prod E2E Keep - ${scenario.country} - ${scenario.variation} - ${runStamp}`,
    country: scenario.country,
    regions: scenario.regions,
    positioning: scenario.positioning,
    targetAudience: scenario.audience,
    travelStyles: scenario.styles,
    travelerTypes: scenario.travelerTypes,
    durations: scenario.durations,
    deliverables: baseDeliverables,
    brandStyle: {
      businessName: "RouteCrafter Production QA",
      voice: scenario.budget === "Luxury" ? "premium" : "editorial",
      footerDisclaimer:
        "Live opening hours, prices, tickets, weather, and availability should be verified before travel.",
    },
    productionPlan: {
      offerModel: scenario.budget === "Luxury" ? "hybrid" : "digital",
      channels: ["direct", "fiverr", "etsy"],
      outputs: [
        "marketplace-listing",
        "pdf",
        "spreadsheet",
        "food-guide",
        "packing-list",
        "booking-checklist",
        "portfolio-visuals",
      ],
      editions: [],
      review: {
        liveDataVerified: false,
        presentationReviewed: false,
        backupConfirmed: false,
      },
    },
    tripConfigs: [tripConfig],
    imagePrompts: [],
    itineraries: [],
    listing: undefined,
    aiRuns: [],
    status: "In progress",
    accent: accentForCountry(scenario.country),
    createdAt: now,
    updatedAt: now,
  });

  const context = buildContext(project);
  const itinerary = buildItinerary(context, {
    duration: scenario.durations[0],
    travelerType: scenario.travelerTypes[0],
    style: scenario.styles[0],
    budget: scenario.budget,
  });
  itinerary.id = `${id}-itinerary`;
  itinerary.plannedEditionId = `${id}-edition`;
  itinerary.title = `${scenario.variation}: ${scenario.durations[0]} ${scenario.country}`;
  itinerary.subtitle = `${scenario.audience}`;
  itinerary.overview = scenario.positioning;
  itinerary.routeSummary = scenario.regions.join(" -> ");
  itinerary.whoFor = scenario.audience;
  itinerary.foodGuide = `Prioritize ${scenario.food.join(", ").toLowerCase()} with clear live-check notes for reservations and opening days.`;
  itinerary.transportGuide = `Plan around ${scenario.transport.join(", ").toLowerCase()} and keep backup routing for delays.`;
  itinerary.packingList = `Pack for ${scenario.seasonMonth}, ${scenario.pace.toLowerCase()} pacing, and ${scenario.interests.join(", ").toLowerCase()}.`;
  itinerary.bookingChecklist =
    "Confirm live hours, ticket rules, weather, transfer times, luggage constraints, and cancellation terms before delivery.";
  itinerary.personalizationQuestions =
    "Ask about exact dates, mobility, food restrictions, accommodation standards, must-sees, and tolerance for early starts.";
  itinerary.verificationNotes =
    "All live prices, schedules, opening days, route conditions, and availability must be verified before buyer delivery.";
  itinerary.days = itinerary.days.map((day, index) => ({
    ...day,
    title:
      index === 0
        ? `${scenario.arrivalCity} arrival with context`
        : index === itinerary.days.length - 1
          ? `${scenario.departureCity} final morning`
          : `${scenario.regions[index % scenario.regions.length]} immersion`,
    base: scenario.regions[index % scenario.regions.length],
    morning:
      index === 0
        ? `Arrive in ${scenario.arrivalCity}, settle in, and start with a low-friction orientation walk.`
        : `Anchor the morning around ${scenario.mustSee[index % scenario.mustSee.length]} with realistic transit padding.`,
    lunch: `Choose a ${scenario.food[0].toLowerCase()} lunch near the day's route, with reservation/live-hour verification.`,
    afternoon: `Layer in ${scenario.interests[index % scenario.interests.length].toLowerCase()} without overpacking the day.`,
    evening: `Keep a flexible evening option that respects ${scenario.pace.toLowerCase()} pacing.`,
    whyThisWorks: `This day supports ${scenario.audience.toLowerCase()} while avoiding ${scenario.avoid[0].toLowerCase()}.`,
    rainyDayAlternative: `Swap to an indoor or low-transit option if weather, closures, or energy levels require it.`,
    bookingNotes:
      "Verify live opening hours, ticket availability, transfer schedules, weather, and local conditions.",
  }));

  const imagePrompts = scenario.imageAngles.map((angle) => {
    const prompt = buildImagePrompt(angle.kind, context);
    return {
      ...prompt,
      id: `${id}-${angle.kind}`,
      title: angle.title,
      goal: angle.goal,
      visualElements: angle.visualElements,
      textOverlay: angle.textOverlay,
      style:
        "Premium editorial travel product visual, concrete destination cues, refined typography, marketplace-ready composition.",
      countryAccuracyNotes: `Keep visual cues recognizably accurate for ${scenario.country}; avoid landmarks from other countries.`,
      readabilityNotes:
        "Short readable text only, strong contrast, uncluttered layout, no tiny itinerary text.",
      isFinal: angle.kind === "hero",
    };
  });

  project = projectSchema.parse({
    ...project,
    listing: buildListing(context),
    imagePrompts,
    itineraries: [itinerary],
    productionPlan: {
      ...project.productionPlan,
      editions: [
        {
          id: `${id}-edition`,
          duration: scenario.durations[0],
          travelerType: scenario.travelerTypes[0],
          itineraryId: `${id}-itinerary`,
          createdAt: now,
        },
      ],
    },
  });

  return project;
}

async function auditVariation(
  page: Page,
  project: Project,
  scenario: Scenario,
  diagnostics: AiDiagnostic[],
  issues: Issue[],
  consoleErrors: string[],
) {
  const scope = {
    country: scenario.country,
    variation: scenario.variation,
  };

  await withIssueCapture(issues, scope, "workspace", "open project", async () => {
    await page.goto(`/projects/${project.id}`);
    await expect(page.getByRole("heading", { name: project.name })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText(project.country, { exact: true }).first()).toBeVisible();
  });

  await runTextAction({
    page,
    project,
    scenario,
    diagnostics,
    issues,
    consoleErrors,
    stage: "prompts",
    action: "Prompt Studio country positioning",
    url: `/projects/${project.id}?stage=package&tool=prompts`,
    trigger: () => page.getByRole("button", { name: "Run with AI" }).click(),
    applyName: "Save AI output",
  });

  await runTextAction({
    page,
    project,
    scenario,
    diagnostics,
    issues,
    consoleErrors,
    stage: "listing",
    action: "AI improve listing",
    url: `/projects/${project.id}?stage=package&tool=listing`,
    trigger: () =>
      page.getByRole("button", { name: "AI improve listing" }).first().click(),
    applyName: "Replace listing",
  });

  await runTextAction({
    page,
    project,
    scenario,
    diagnostics,
    issues,
    consoleErrors,
    stage: "itinerary",
    action: "AI fill empty itinerary sections",
    url: `/projects/${project.id}?stage=build&edition=${project.productionPlan.editions[0]?.id}&tool=overview`,
    trigger: () =>
      page.getByRole("button", { name: "AI fill empty sections" }).click(),
    applyName: "Replace itinerary",
  });

  await runImageAction({
    page,
    project,
    scenario,
    diagnostics,
    issues,
    consoleErrors,
    stage: "visuals",
    action: "AI create portfolio hero image",
    url: `/projects/${project.id}?stage=package&tool=visuals`,
    trigger: () =>
      page.getByRole("button", { name: "AI create hero image" }).click(),
    applyName: "Apply image",
  });

  await runImageAction({
    page,
    project,
    scenario,
    diagnostics,
    issues,
    consoleErrors,
    stage: "visuals",
    action: "AI create secondary portfolio image",
    url: `/projects/${project.id}?stage=package&tool=visuals`,
    trigger: () =>
      page.getByRole("button", { name: "AI create image" }).nth(1).click(),
    applyName: "Apply image",
  });

  await runImageAction({
    page,
    project,
    scenario,
    diagnostics,
    issues,
    consoleErrors,
    stage: "pdf",
    action: "AI create PDF cover image",
    url: `/projects/${project.id}?stage=package&tool=pdf`,
    trigger: () =>
      page.getByRole("button", { name: "AI create cover image" }).click(),
    applyName: "Apply image",
  });

  await withIssueCapture(issues, scope, "exports", "verify AI usage appendix", async () => {
    await page.goto(`/projects/${project.id}?stage=package&tool=exports`);
    await expect(page.getByRole("heading", { name: "Export your work" })).toBeVisible({
      timeout: 45_000,
    });
    await expect(page.getByText("AI usage appendix", { exact: true })).toBeVisible();
  });
}

async function runTextAction({
  page,
  project,
  scenario,
  diagnostics,
  issues,
  consoleErrors,
  stage,
  action,
  url,
  trigger,
  applyName,
}: {
  page: Page;
  project: Project;
  scenario: Scenario;
  diagnostics: AiDiagnostic[];
  issues: Issue[];
  consoleErrors: string[];
  stage: string;
  action: string;
  url: string;
  trigger: () => Promise<void>;
  applyName: string;
}) {
  const scope = { country: scenario.country, variation: scenario.variation };
  await withIssueCapture(issues, scope, stage, action, async () => {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: project.name })).toBeVisible({
      timeout: 45_000,
    });
    await trigger();
    await expect(page.getByText("AI request estimate")).toBeVisible();
    await expect(page.getByText("RouteCrafter server key")).toBeVisible();
    await expect(page.getByText("gpt-5.4", { exact: true })).toBeVisible();
    await expect(page.getByText("gpt-5.4-mini", { exact: true })).toHaveCount(0);
    const responsePromise = waitForAiResponse(page, "text");
    await page.getByRole("button", { name: /Confirm run/ }).click();
    const responseResult = await responsePromise;
    if (!responseResult.ok) {
      issues.push({
        severity: "major",
        ...scope,
        stage,
        action,
        url: page.url(),
        consoleError: consoleErrors.at(-1),
        error: responseResult.error,
      });
      return;
    }
    await recordAiResponse(
      responseResult.response,
      diagnostics,
      scope,
      issues,
      stage,
      action,
    );
    await expectAiResultOrPreciseError(page, "text");
    if (await page.getByText("AI proposal", { exact: true }).isVisible()) {
      await page.getByRole("button", { name: applyName }).click();
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      await page.reload();
      await expect(page.getByRole("heading", { name: project.name })).toBeVisible({
        timeout: 45_000,
      });
    }
  });
}

async function runImageAction({
  page,
  project,
  scenario,
  diagnostics,
  issues,
  consoleErrors,
  stage,
  action,
  url,
  trigger,
  applyName,
}: {
  page: Page;
  project: Project;
  scenario: Scenario;
  diagnostics: AiDiagnostic[];
  issues: Issue[];
  consoleErrors: string[];
  stage: string;
  action: string;
  url: string;
  trigger: () => Promise<void>;
  applyName: string;
}) {
  const scope = { country: scenario.country, variation: scenario.variation };
  await withIssueCapture(issues, scope, stage, action, async () => {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: project.name })).toBeVisible({
      timeout: 45_000,
    });
    await trigger();
    await expect(page.getByText("AI request estimate")).toBeVisible();
    await expect(page.getByText("RouteCrafter server key")).toBeVisible();
    await expect(page.getByText("gpt-image-2", { exact: true })).toBeVisible();
    const confirm = page.getByRole("button", { name: /Confirm run/ });
    await expect(confirm).toBeVisible();
    await expect(confirm).toBeEnabled();
    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible();
    if (stage === "pdf") {
      await expect(
        dialog.evaluate((element) => element.parentElement?.tagName),
      ).resolves.toBe("BODY");
    }
    await expect(
      confirm.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const target = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return target === button || Boolean(button.contains(target));
      }),
    ).resolves.toBe(true);
    const responsePromise = waitForAiResponse(page, "image");
    await confirm.click();
    const responseResult = await responsePromise;
    if (!responseResult.ok) {
      issues.push({
        severity: "major",
        ...scope,
        stage,
        action,
        url: page.url(),
        consoleError: consoleErrors.at(-1),
        error: responseResult.error,
      });
      return;
    }
    await recordAiResponse(
      responseResult.response,
      diagnostics,
      scope,
      issues,
      stage,
      action,
    );
    await expectAiResultOrPreciseError(page, "image");
    if (await page.getByAltText("AI generated RouteCrafter visual").isVisible()) {
      await page.getByRole("button", { name: applyName }).click();
      await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => undefined);
      await page.reload();
      await expect(page.getByRole("heading", { name: project.name })).toBeVisible({
        timeout: 45_000,
      });
    }
  });
}

async function waitForAiResponse(
  page: Page,
  mode: AiMode,
): Promise<AwaitedAiResponse> {
  const endpoint = mode === "text" ? "/api/ai/text" : "/api/ai/image";
  try {
    const response = await page.waitForResponse(
      (candidate) =>
        candidate.url().endsWith(endpoint) &&
        candidate.request().method() === "POST",
      { timeout: 180_000 },
    );
    return { ok: true, response };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function expectAiResultOrPreciseError(page: Page, mode: AiMode) {
  const success =
    mode === "text"
      ? page.getByText("AI proposal", { exact: true })
      : page.getByAltText("AI generated RouteCrafter visual");
  const error = page.locator(
    "text=/Provider authentication failed|Provider rate limit reached|provider is temporarily unavailable|provider rejected|timed out|No AI credential|model|request did not complete|stopped before finishing/i",
  );
  await expect(success.or(error).first()).toBeVisible({ timeout: 180_000 });
}

async function createKeptProject(
  request: APIRequestContext,
  project: Project,
  issues: Issue[],
): Promise<CloudProject | null> {
  let expectedRevision: number | undefined;
  try {
    expectedRevision = await fetchExistingProjectRevision(request, project.id);
  } catch (error) {
    issues.push({
      severity: "blocker",
      country: project.country,
      variation: project.name,
      stage: "create",
      action: "read existing kept project revision",
      url: "/api/projects",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  let response: Awaited<ReturnType<APIRequestContext["post"]>>;
  try {
    response = await request.post("/api/projects", {
      data: {
        project,
        expectedRevision,
        activityDetail: expectedRevision
          ? "Updated persistent production E2E audit project"
          : "Created persistent production E2E audit project",
      },
    });
  } catch (error) {
    issues.push({
      severity: "blocker",
      country: project.country,
      variation: project.name,
      stage: "create",
      action: "create kept project",
      url: "/api/projects",
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
  const body = await response.json().catch(() => null);
  if (!response.ok()) {
    issues.push({
      severity: "blocker",
      country: project.country,
      variation: project.name,
      stage: "create",
      action: "create kept project",
      url: "/api/projects",
      status: response.status(),
      error: extractError(body),
      detail: JSON.stringify(body),
    });
    return null;
  }
  return body.project as CloudProject;
}

async function fetchExistingProjectRevision(
  request: APIRequestContext,
  projectId: string,
): Promise<number | undefined> {
  const response = await request.get("/api/projects", {
    headers: { Accept: "application/json" },
  });
  if (!response.ok()) {
    const body = await response.json().catch(() => null);
    throw new Error(
      `Unable to list production projects before kept-project upsert: ${response.status()} ${extractError(body) ?? ""}`.trim(),
    );
  }
  const body = (await response.json()) as { projects?: CloudProject[] };
  return body.projects?.find((item) => item.project.id === projectId)?.revision;
}

async function recordAiResponse(
  response: Awaited<ReturnType<Page["waitForResponse"]>>,
  diagnostics: AiDiagnostic[],
  scope: Pick<Issue, "country" | "variation">,
  issues: Issue[],
  stage: string,
  action: string,
) {
  const body = await response.json().catch(async () =>
    response.text().catch(() => null),
  );
  const request = safePostData(response.request().postData());
  const providerAttemptsHeader = response.headers()["x-ai-provider-attempts"];
  const providerAttempts =
    providerAttemptsHeader !== undefined
      ? Number(providerAttemptsHeader)
      : body &&
          typeof body === "object" &&
          "providerAttempts" in body &&
          typeof (body as { providerAttempts?: unknown }).providerAttempts ===
            "number"
        ? (body as { providerAttempts: number }).providerAttempts
        : undefined;
  diagnostics.push({
    ...scope,
    url: response.url(),
    method: response.request().method(),
    request,
    status: response.status(),
    response: body,
    providerAttempts,
  });

  const requestModel =
    request && typeof request === "object" && "model" in request
      ? String((request as { model?: unknown }).model)
      : undefined;
  const responseModel =
    body && typeof body === "object" && "model" in body
      ? String((body as { model?: unknown }).model)
      : undefined;
  const credentialSource =
    body && typeof body === "object" && "credentialSource" in body
      ? String((body as { credentialSource?: unknown }).credentialSource)
      : undefined;
  const error = extractError(body);

  if (requestModel?.includes("mini") || responseModel?.includes("mini")) {
    issues.push({
      severity: "blocker",
      ...scope,
      stage,
      action,
      url: response.url(),
      status: response.status(),
      model: responseModel ?? requestModel,
      credentialSource,
      error: "Unexpected mini model used in production AI flow.",
    });
  }

  if (!response.ok() || error) {
    issues.push({
      severity: response.status() >= 500 ? "major" : "minor",
      ...scope,
      stage,
      action,
      url: response.url(),
      status: response.status(),
      model: responseModel ?? requestModel,
      credentialSource,
      error,
    });
  }
}

async function withIssueCapture(
  issues: Issue[],
  scope: Pick<Issue, "country" | "variation">,
  stage: string,
  action: string,
  run: () => Promise<void>,
) {
  try {
    await run();
  } catch (error) {
    issues.push({
      severity: "major",
      ...scope,
      stage,
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function submitUiLogin(page: Page) {
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/login") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  const response = await loginResponse;
  if (response.status() !== 429) return response;

  await waitForRetryAfter(response);
  const retryResponse = page.waitForResponse(
    (next) =>
      next.url().endsWith("/api/auth/login") &&
      next.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Sign in" }).click();
  return retryResponse;
}

async function ensureSignedIn(context: BrowserContext) {
  if (authCookies?.length) {
    await context.addCookies(authCookies);
    return;
  }
  await login(context.request);
  authCookies = await context.cookies();
}

async function login(request: APIRequestContext) {
  const response = await request.post("/api/auth/login", {
    data: { username, password },
  });
  if (response.status() === 429) {
    await waitForRetryAfter(response);
    return login(request);
  }
  const body = await response.json().catch(() => null);
  expect(response.status(), JSON.stringify(body)).toBe(200);
}

async function waitForRetryAfter(response: { headers: () => Record<string, string> }) {
  const seconds = Number(response.headers()["retry-after"]);
  await new Promise((resolve) =>
    setTimeout(resolve, Number.isFinite(seconds) ? seconds * 1000 : 60_000),
  );
}

async function clearPersonalAiKeys(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.removeItem("routecrafter:ai-settings:v1");
  });
}

function summarizeDiagnostics(diagnostics: AiDiagnostic[]) {
  return diagnostics.map((item) => {
    const request = item.request as { model?: string; taskType?: string } | undefined;
    const response = item.response as
      | {
          model?: string;
          credentialSource?: string;
          text?: string;
          image?: string;
          error?: string;
        }
      | undefined;
    return {
      country: item.country,
      variation: item.variation,
      url: item.url,
      method: item.method,
      status: item.status,
      taskType: request?.taskType,
      requestModel: request?.model,
      responseModel: response?.model,
      credentialSource: response?.credentialSource,
      hasText: typeof response?.text === "string",
      textLength: typeof response?.text === "string" ? response.text.length : undefined,
      hasImage: typeof response?.image === "string",
      imagePrefix:
        typeof response?.image === "string" ? response.image.slice(0, 32) : undefined,
      error: response?.error ?? item.error,
    };
  });
}

function safePostData(postData: string | null): unknown {
  if (!postData) return undefined;
  try {
    const parsed = JSON.parse(postData) as Record<string, unknown>;
    if (typeof parsed.apiKey === "string") {
      parsed.apiKey = "[redacted]";
    }
    return parsed;
  } catch {
    return postData;
  }
}

function extractError(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  if ("error" in value && typeof (value as { error?: unknown }).error === "string") {
    return (value as { error: string }).error;
  }
  if ("message" in value && typeof (value as { message?: unknown }).message === "string") {
    return (value as { message: string }).message;
  }
  return undefined;
}

async function attachJson(testInfo: TestInfo, name: string, value: unknown) {
  await testInfo.attach(name, {
    body: JSON.stringify(value, null, 2),
    contentType: "application/json",
  });
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function accentForCountry(country: string): Project["accent"] {
  switch (country) {
    case "Japan":
      return "terracotta";
    case "Morocco":
      return "gold";
    case "Iceland":
      return "teal";
    case "Vietnam":
      return "forest";
    case "Peru":
      return "sage";
    default:
      return "sage";
  }
}
