import type {
  Duration,
  ItineraryOutput,
  OutputRequirement,
  PlannedEdition,
  Project,
  RouteStop,
  TransportMode,
  TravelerType,
} from "./types";
import { durationOverrideFromLabel } from "./generation/itinerary";

export type WorkflowStageId =
  | "define"
  | "plan"
  | "build"
  | "package"
  | "publish";

export type WorkflowStageStatus =
  | "not-started"
  | "in-progress"
  | "needs-attention"
  | "complete";

export interface WorkflowIssue {
  id: string;
  label: string;
  stage: WorkflowStageId;
  editionId?: string;
  tool?: string;
}

export type LintSeverity = "must-fix" | "recommended" | "polish";

export interface LintFinding extends WorkflowIssue {
  severity: LintSeverity;
  fieldPath: string;
  message: string;
  fixId?: "move-live-claims-to-verification-notes";
}

export interface WorkflowStage {
  id: WorkflowStageId;
  label: string;
  shortLabel: string;
  status: WorkflowStageStatus;
  completed: number;
  total: number;
}

export interface ProjectWorkflow {
  stages: WorkflowStage[];
  blockers: WorkflowIssue[];
  warnings: WorkflowIssue[];
  completedChecks: number;
  totalChecks: number;
  progress: number;
  recommendedStage: WorkflowStageId;
  recommendedAction: string;
  recommendedReason: string;
  readyToPublish: boolean;
}

const STAGE_COPY: Record<
  WorkflowStageId,
  { label: string; shortLabel: string }
> = {
  define: { label: "Define the product", shortLabel: "Define" },
  plan: { label: "Plan the editions", shortLabel: "Plan" },
  build: { label: "Build itineraries", shortLabel: "Build" },
  package: { label: "Package the offer", shortLabel: "Package" },
  publish: { label: "Review and publish", shortLabel: "Publish" },
};

export const WORKFLOW_STAGE_ORDER: WorkflowStageId[] = [
  "define",
  "plan",
  "build",
  "package",
  "publish",
];

export const OUTPUT_LABELS: Record<OutputRequirement, string> = {
  "marketplace-listing": "Marketplace listing",
  pdf: "PDF",
  spreadsheet: "Spreadsheet",
  "packing-list": "Packing list",
  "food-guide": "Food guide",
  "booking-checklist": "Booking checklist",
  "portfolio-visuals": "Portfolio visuals",
  "map-pins-legacy": "Map pins (legacy)",
};

export function editionLabel(edition: PlannedEdition): string {
  const duration = edition.customDays
    ? `${edition.customDays} days`
    : edition.duration;
  return `${duration} · ${edition.travelerType}`;
}

export function editionDayCount(edition: PlannedEdition): number {
  return edition.customDays ?? Number.parseInt(edition.duration, 10);
}

export function itineraryForEdition(
  project: Project,
  edition: PlannedEdition,
): ItineraryOutput | undefined {
  if (edition.itineraryId) {
    const linked = project.itineraries.find(
      (itinerary) => itinerary.id === edition.itineraryId,
    );
    if (linked) return linked;
  }
  return project.itineraries.find(
    (itinerary) =>
      itinerary.plannedEditionId === edition.id ||
      (itinerary.duration ===
        (edition.customDays ? `${edition.customDays} days` : edition.duration) &&
        itinerary.travelerType === edition.travelerType),
  );
}

/** Additive cities for the planned edition linked to this itinerary, if any. */
export function editionExtraCities(
  project: Project,
  itinerary?: ItineraryOutput | null,
): string[] {
  const id = itinerary?.plannedEditionId;
  if (!id) return [];
  return project.productionPlan.editions.find((e) => e.id === id)?.cities ?? [];
}

/** Generation-context overrides for the edition an itinerary belongs to, so AI
 *  prompts reflect that edition's cities, duration, and traveler type instead of
 *  the project's first trip config. Prefers the linked edition; falls back to the
 *  itinerary's own stored duration/traveler type when there is no link. */
export function editionContextOptions(
  project: Project,
  itinerary?: ItineraryOutput | null,
): {
  extraCities: string[];
  duration?: Duration;
  customDays?: number;
  travelerType?: TravelerType;
} {
  const extraCities = editionExtraCities(project, itinerary);
  const edition = itinerary?.plannedEditionId
    ? project.productionPlan.editions.find(
        (e) => e.id === itinerary.plannedEditionId,
      )
    : undefined;
  if (edition) {
    return {
      extraCities,
      duration: edition.duration,
      customDays: edition.customDays,
      travelerType: edition.travelerType,
    };
  }
  if (itinerary) {
    return {
      extraCities,
      ...durationOverrideFromLabel(itinerary.duration),
      travelerType: itinerary.travelerType,
    };
  }
  return { extraCities };
}

/* ----------------------------------------------------------------------------
 * Route (ordered, time-aware stops) helpers
 * ------------------------------------------------------------------------- */

/** Total nights placed across the route. With our model this equals trip days. */
export function routeNights(route: RouteStop[]): number {
  return route.reduce((sum, stop) => sum + (stop.nights ?? 0), 0);
}

/**
 * Inclusive day span a stop occupies, 1-based. A stop starting after `o`
 * cumulative nights with `n` nights spans days `o+1 … o+n` (min one day shown).
 */
export function dayRangeForStop(
  route: RouteStop[],
  index: number,
): { start: number; end: number } {
  const offset = route
    .slice(0, index)
    .reduce((sum, stop) => sum + (stop.nights ?? 0), 0);
  const nights = Math.max(route[index]?.nights ?? 0, 1);
  return { start: offset + 1, end: offset + nights };
}

/**
 * Build an ordered route from the brief cities plus edition extras, spreading
 * `dayCount` nights as evenly as possible (remainder to the earliest stops).
 * Used to seed editions that have no explicit route yet.
 */
export function defaultRoute(
  baseCities: string[],
  extra: string[],
  dayCount: number,
): RouteStop[] {
  const cities = [
    ...new Set([...baseCities, ...extra].map((c) => c.trim()).filter(Boolean)),
  ];
  const count = cities.length;
  if (!count) return [];
  const each = Math.floor(dayCount / count);
  let remainder = dayCount % count;
  return cities.map((city, index) => {
    let nights = each + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    if (nights < 1) nights = index === 0 ? 1 : 0; // guarantee a real first stop
    return {
      id: crypto.randomUUID(),
      city,
      nights,
      arriveBy: index === 0 ? undefined : ("train" as TransportMode),
    } satisfies RouteStop;
  });
}

/** The edition's explicit route, or a lazily-built default for legacy editions. */
export function editionRoute(
  project: Project,
  edition: PlannedEdition,
): RouteStop[] {
  if (edition.route?.length) return edition.route;
  const base = project.tripConfigs[0]?.cities.length
    ? project.tripConfigs[0].cities
    : project.regions;
  return defaultRoute(base, edition.cities, editionDayCount(edition));
}

/** Derive the flat `cities` extras list (route cities not in the brief). */
export function routeToCities(
  route: RouteStop[],
  baseCities: string[],
): string[] {
  const baseSet = new Set(baseCities);
  return [...new Set(route.map((stop) => stop.city))].filter(
    (city) => !baseSet.has(city),
  );
}

/** Keep transport coherent: first stop has no inbound leg; others default. */
export function normalizeRoute(route: RouteStop[]): RouteStop[] {
  return route.map((stop, index) => ({
    ...stop,
    arriveBy:
      index === 0 ? undefined : stop.arriveBy ?? ("train" as TransportMode),
  }));
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function hasMeaningfulDay(day: ItineraryOutput["days"][number]): boolean {
  return [
    day.morning,
    day.lunch,
    day.afternoon,
    day.evening,
    day.dinner,
  ].some(hasText);
}

const LIVE_DATA_PATTERN =
  /([$€£¥₹]\s?\d+|\b\d+(?:\.\d{2})?\s?(?:usd|eur|gbp|jpy|inr)\b|\b(?:open|opens|closed|closes)\s+(?:at|from|until)\s+\d{1,2}(?::\d{2})?\s?(?:am|pm)?|\b\d{1,2}(?::\d{2})?\s?(?:am|pm)\s?[-–]\s?\d{1,2}(?::\d{2})?\s?(?:am|pm)?)/i;

const DAY_LINT_FIELDS: Array<keyof ItineraryOutput["days"][number]> = [
  "morning",
  "lunch",
  "afternoon",
  "evening",
  "dinner",
  "transportNotes",
  "bookingNotes",
  "optionalUpgrade",
];

function lintId(...parts: Array<string | number | undefined>): string {
  return parts.filter((part) => part !== undefined && part !== "").join("-");
}

export function extractLiveDataClaims(text: string): {
  cleaned: string;
  claims: string[];
} {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const parts = sentences.length ? sentences : [text.trim()].filter(Boolean);
  const claims = parts.filter((part) => LIVE_DATA_PATTERN.test(part));
  const cleaned = parts
    .filter((part) => !LIVE_DATA_PATTERN.test(part))
    .join(" ")
    .trim();
  return { cleaned, claims };
}

function finding({
  id,
  severity,
  label,
  editionId,
  tool = "quality",
  fieldPath,
  message,
  fixId,
}: {
  id: string;
  severity: LintSeverity;
  label: string;
  editionId?: string;
  tool?: string;
  fieldPath: string;
  message: string;
  fixId?: LintFinding["fixId"];
}): LintFinding {
  return {
    id,
    severity,
    label,
    stage: "build",
    editionId,
    tool,
    fieldPath,
    message,
    fixId,
  };
}

export function lintItinerary(
  itinerary: ItineraryOutput,
  project: Project,
  edition?: PlannedEdition,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const editionId = edition?.id ?? itinerary.plannedEditionId;
  const expectedDays = edition ? editionDayCount(edition) : itinerary.days.length;
  const prefix = editionId ?? itinerary.id;

  if (edition && itinerary.days.length !== expectedDays) {
    findings.push(
      finding({
        id: lintId(prefix, "day-count"),
        severity: "must-fix",
        label: `${editionLabel(edition)}: day count does not match route`,
        editionId,
        fieldPath: "days",
        message: `Expected ${expectedDays} days but found ${itinerary.days.length}.`,
      }),
    );
  }

  if (!hasText(itinerary.verificationNotes)) {
    findings.push(
      finding({
        id: lintId(prefix, "verification-notes"),
        severity: "must-fix",
        label: `${itinerary.title || "Itinerary"} needs verification notes`,
        editionId,
        fieldPath: "verificationNotes",
        message:
          "Add a clear note that live prices, hours, tickets, and availability must be verified before travel.",
      }),
    );
  }

  itinerary.days.forEach((day, dayIndex) => {
    const meaningfulFields = [
      day.morning,
      day.lunch,
      day.afternoon,
      day.evening,
      day.dinner,
    ].filter(hasText).length;
    if (meaningfulFields < 2) {
      findings.push(
        finding({
          id: lintId(prefix, "thin-day", day.day),
          severity: "recommended",
          label: `Day ${day.day} feels light`,
          editionId,
          fieldPath: `days.${dayIndex}`,
          message:
            "Add another activity, meal anchor, or fallback so the product feels complete.",
        }),
      );
    }
    if (!hasText(day.rainyDayAlternative) || !hasText(day.lowEnergyAlternative)) {
      findings.push(
        finding({
          id: lintId(prefix, "backup", day.day),
          severity: "polish",
          label: `Day ${day.day} needs stronger backup options`,
          editionId,
          fieldPath: `days.${dayIndex}.rainyDayAlternative`,
          message:
            "Add rainy-day and low-energy alternatives to make the day safer to sell.",
        }),
      );
    }
    for (const key of DAY_LINT_FIELDS) {
      const value = String(day[key] ?? "");
      if (LIVE_DATA_PATTERN.test(value)) {
        findings.push(
          finding({
            id: lintId(prefix, "live-data", day.day, key),
            severity: "must-fix",
            label: `Day ${day.day}: unverified live detail in ${String(key)}`,
            editionId,
            fieldPath: `days.${dayIndex}.${String(key)}`,
            message:
              "Move live prices, hours, tickets, or availability claims into verification notes, or rewrite them as details to verify.",
            fixId: "move-live-claims-to-verification-notes",
          }),
        );
      }
    }
  });

  if (
    project.productionPlan.outputs.includes("portfolio-visuals") &&
    itinerary.days.some((day) => !hasText(day.image))
  ) {
    findings.push(
      finding({
        id: lintId(prefix, "day-images"),
        severity: "polish",
        label: `${itinerary.title || "Itinerary"} has missing day visuals`,
        editionId,
        tool: "presentation",
        fieldPath: "days.image",
        message:
          "Generate or upload day images so the PDF feels more premium.",
      }),
    );
  }

  return findings;
}

export function lintProjectForPublish(project: Project): LintFinding[] {
  const findings = project.productionPlan.editions.flatMap((edition) => {
    const itinerary = itineraryForEdition(project, edition);
    return itinerary ? lintItinerary(itinerary, project, edition) : [];
  });

  if (
    project.productionPlan.outputs.includes("map-pins-legacy") &&
    project.productionPlan.editions.some((edition) =>
      editionRoute(project, edition).some((stop) => !stop.coords),
    )
  ) {
    findings.push({
      id: "route-map-coordinates",
      severity: "recommended",
      label: "Route map needs geocoded stops",
      stage: "plan",
      tool: "overview",
      fieldPath: "productionPlan.editions.route.coords",
      message:
        "Add or geocode route stops before exporting a buyer-facing map.",
    });
  }

  return findings;
}

export function itineraryBlockers(
  project: Project,
  edition: PlannedEdition,
): string[] {
  const itinerary = itineraryForEdition(project, edition);
  if (!itinerary) return ["Create the itinerary"];

  const blockers: string[] = [];
  if (itinerary.days.length !== editionDayCount(edition)) {
    blockers.push(`Use exactly ${editionDayCount(edition)} days`);
  }
  if (!hasText(itinerary.title)) blockers.push("Add a title");
  if (!hasText(itinerary.overview)) blockers.push("Add an overview");
  if (!hasText(itinerary.whoFor)) blockers.push("Describe who it is for");
  if (!hasText(itinerary.routeSummary)) blockers.push("Add a route summary");
  if (
    itinerary.days.some(
      (day) =>
        !hasText(day.title) || !hasText(day.base) || !hasMeaningfulDay(day),
    )
  ) {
    blockers.push("Complete every day with a title, base, and activity");
  }
  if (
    project.productionPlan.outputs.includes("food-guide") &&
    !hasText(itinerary.foodGuide)
  ) {
    blockers.push("Complete the food guide");
  }
  if (
    project.productionPlan.outputs.includes("packing-list") &&
    !hasText(itinerary.packingList)
  ) {
    blockers.push("Complete the packing list");
  }
  if (
    project.productionPlan.outputs.includes("booking-checklist") &&
    !hasText(itinerary.bookingChecklist)
  ) {
    blockers.push("Complete the booking checklist");
  }
  if (
    project.productionPlan.offerModel !== "digital" &&
    !hasText(itinerary.personalizationQuestions)
  ) {
    blockers.push("Add personalization questions");
  }
  if (!hasText(itinerary.verificationNotes)) {
    blockers.push("Add verification notes");
  }
  return blockers;
}

function listingBlockers(project: Project): string[] {
  const listing = project.listing;
  if (!listing) return ["Create the marketplace listing"];

  const blockers: string[] = [];
  if (!listing.titleOptions.some(hasText)) blockers.push("Add a listing title");
  if (!listing.tags.some(hasText)) blockers.push("Add listing tags");
  if (!hasText(listing.shortDescription)) blockers.push("Add a short description");
  if (!hasText(listing.longDescription)) blockers.push("Add a full description");
  if (!hasText(listing.deliveryNotes)) blockers.push("Add delivery notes");

  if (project.productionPlan.offerModel !== "digital") {
    if (
      !listing.packages.some(
        (item) => hasText(item.name) && hasText(item.price),
      )
    ) {
      blockers.push("Price at least one service package");
    }
    if (!listing.buyerRequirements.some(hasText)) {
      blockers.push("Add buyer requirements");
    }
  }
  return blockers;
}

function stageStatus(
  completed: number,
  total: number,
  hasStarted: boolean,
  blocked = false,
): WorkflowStageStatus {
  if (total > 0 && completed === total) return "complete";
  if (blocked && hasStarted) return "needs-attention";
  return hasStarted ? "in-progress" : "not-started";
}

export function getProjectWorkflow(project: Project): ProjectWorkflow {
  const blockers: WorkflowIssue[] = [];
  const warnings: WorkflowIssue[] = [];
  const lintFindings = lintProjectForPublish(project);
  const config = project.tripConfigs[0];

  const defineChecks = [
    hasText(project.country),
    project.regions.length > 0 || Boolean(config?.cities.length),
    hasText(project.positioning),
    hasText(project.targetAudience),
    Boolean(config),
    project.productionPlan.channels.length > 0,
    project.productionPlan.outputs.includes("marketplace-listing"),
  ];

  if (!hasText(project.country)) {
    blockers.push({
      id: "country",
      label: "Choose a destination country",
      stage: "define",
    });
  }
  if (!config) {
    blockers.push({
      id: "trip-config",
      label: "Complete the primary trip configuration",
      stage: "define",
    });
  }

  const editionChecks = project.productionPlan.editions.map(
    (edition) => itineraryBlockers(project, edition).length === 0,
  );
  if (project.productionPlan.editions.length === 0) {
    blockers.push({
      id: "edition",
      label: "Commit to at least one itinerary edition",
      stage: "plan",
    });
  }
  for (const edition of project.productionPlan.editions) {
    for (const [index, label] of itineraryBlockers(project, edition).entries()) {
      blockers.push({
        id: `${edition.id}-${index}`,
        label: `${editionLabel(edition)}: ${label}`,
        stage: "build",
        editionId: edition.id,
        tool: "overview",
      });
    }
    const itinerary = itineraryForEdition(project, edition);
    if (
      itinerary &&
      itinerary.days.some(
        (day) => !hasText(day.rainyDayAlternative) || !hasText(day.bookingNotes),
      )
    ) {
      warnings.push({
        id: `${edition.id}-resilience`,
        label: `${editionLabel(edition)} could use stronger backup and booking notes`,
        stage: "build",
        editionId: edition.id,
        tool: "quality",
      });
    }
  }

  for (const lint of lintFindings) {
    if (
      lint.id.includes("verification-notes") &&
      blockers.some(
        (issue) =>
          issue.editionId === lint.editionId &&
          issue.label.includes("Add verification notes"),
      )
    ) {
      continue;
    }
    const issue: WorkflowIssue = {
      id: `lint-${lint.id}`,
      label: lint.label,
      stage: lint.stage,
      editionId: lint.editionId,
      tool: lint.tool,
    };
    if (lint.severity === "must-fix") blockers.push(issue);
    else warnings.push(issue);
  }

  const listingProblems = listingBlockers(project);
  for (const [index, label] of listingProblems.entries()) {
    blockers.push({
      id: `listing-${index}`,
      label,
      stage: "package",
      tool: "listing",
    });
  }

  const needsVisuals =
    project.productionPlan.outputs.includes("portfolio-visuals");
  const visualsComplete =
    !needsVisuals ||
    (project.imagePrompts.length === 5 &&
      project.imagePrompts.every((prompt) => prompt.isFinal));
  if (!visualsComplete) {
    blockers.push({
      id: "portfolio-visuals",
      label: "Finalize all five portfolio visual briefs",
      stage: "package",
      tool: "visuals",
    });
  }
  if (
    needsVisuals &&
    project.imagePrompts.length === 5 &&
    project.imagePrompts.some((prompt) => !hasText(prompt.image))
  ) {
    warnings.push({
      id: "portfolio-images",
      label: "Add generated or designed images to strengthen the sales package",
      stage: "package",
      tool: "visuals",
    });
  }

  const review = project.productionPlan.review;
  const reviewChecks = [
    review.liveDataVerified,
    review.presentationReviewed,
    review.backupConfirmed,
  ];
  const contentBlockers = blockers.filter((issue) => issue.stage !== "publish");
  const readyToPublish =
    contentBlockers.length === 0 && reviewChecks.every(Boolean);

  const defineCompleted = defineChecks.filter(Boolean).length;
  const planCompleted = project.productionPlan.editions.length > 0 ? 1 : 0;
  const buildCompleted = editionChecks.filter(Boolean).length;
  const packageChecks = [
    listingProblems.length === 0,
    visualsComplete,
    !project.productionPlan.outputs.includes("pdf") ||
      editionChecks.some(Boolean),
    !project.productionPlan.outputs.includes("spreadsheet") ||
      editionChecks.some(Boolean),
  ];
  const packageCompleted = packageChecks.filter(Boolean).length;
  const publishCompleted = reviewChecks.filter(Boolean).length;

  const stages: WorkflowStage[] = [
    {
      id: "define",
      ...STAGE_COPY.define,
      status: stageStatus(
        defineCompleted,
        defineChecks.length,
        defineCompleted > 1,
        blockers.some((issue) => issue.stage === "define"),
      ),
      completed: defineCompleted,
      total: defineChecks.length,
    },
    {
      id: "plan",
      ...STAGE_COPY.plan,
      status: stageStatus(
        planCompleted,
        1,
        project.productionPlan.editions.length > 0,
      ),
      completed: planCompleted,
      total: 1,
    },
    {
      id: "build",
      ...STAGE_COPY.build,
      status: stageStatus(
        buildCompleted,
        Math.max(editionChecks.length, 1),
        project.itineraries.length > 0,
        blockers.some((issue) => issue.stage === "build"),
      ),
      completed: buildCompleted,
      total: Math.max(editionChecks.length, 1),
    },
    {
      id: "package",
      ...STAGE_COPY.package,
      status: stageStatus(
        packageCompleted,
        packageChecks.length,
        Boolean(project.listing || project.imagePrompts.length),
        blockers.some((issue) => issue.stage === "package"),
      ),
      completed: packageCompleted,
      total: packageChecks.length,
    },
    {
      id: "publish",
      ...STAGE_COPY.publish,
      status: readyToPublish
        ? "complete"
        : publishCompleted > 0
          ? "in-progress"
          : "not-started",
      completed: publishCompleted,
      total: reviewChecks.length,
    },
  ];

  const next = stages.find((stage) => stage.status !== "complete") ?? stages[4];
  const actionCopy: Record<
    WorkflowStageId,
    { action: string; reason: string }
  > = {
    define: {
      action: "Finish the product brief",
      reason: "A clear brief gives every generated artifact the same direction.",
    },
    plan: {
      action: "Plan the first edition",
      reason: "Committed editions turn broad audience ideas into concrete products.",
    },
    build: {
      action: "Complete the next itinerary",
      reason: "Each planned edition needs a polished day-by-day product.",
    },
    package: {
      action: "Finish the sales package",
      reason: "Listing copy and selected assets make the itinerary ready to sell.",
    },
    publish: {
      action: readyToPublish ? "Ready to publish" : "Review for publishing",
      reason: "Resolve final checks, verify live details, and back up the project.",
    },
  };

  const completedChecks =
    defineCompleted +
    planCompleted +
    buildCompleted +
    packageCompleted +
    publishCompleted;
  const totalChecks =
    defineChecks.length +
    1 +
    Math.max(editionChecks.length, 1) +
    packageChecks.length +
    reviewChecks.length;

  return {
    stages,
    blockers,
    warnings,
    completedChecks,
    totalChecks,
    progress: Math.round((completedChecks / totalChecks) * 100),
    recommendedStage: next.id,
    recommendedAction: actionCopy[next.id].action,
    recommendedReason: actionCopy[next.id].reason,
    readyToPublish,
  };
}

export function readinessFingerprint(project: Project): string {
  return JSON.stringify({
    name: project.name,
    country: project.country,
    regions: project.regions,
    positioning: project.positioning,
    targetAudience: project.targetAudience,
    travelStyles: project.travelStyles,
    travelerTypes: project.travelerTypes,
    durations: project.durations,
    brandStyle: project.brandStyle,
    productionPlan: {
      ...project.productionPlan,
      review: undefined,
    },
    tripConfigs: project.tripConfigs,
    imagePrompts: project.imagePrompts,
    itineraries: project.itineraries,
    listing: project.listing,
  });
}
