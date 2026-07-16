import type { ItineraryOutput, PlannedEdition, Project } from "./types";
import {
  editionDayCount,
  editionLabel,
  editionRoute,
  itineraryForEdition,
} from "./editions";

/**
 * Launch-readiness linting. Readiness is a checklist, never a gate: findings
 * deep-link to the offending surface, and export is never blocked.
 */

/** The editor surface a finding points at (formerly workflow stages). */
export type WorkflowStageId =
  | "define"
  | "plan"
  | "build"
  | "package"
  | "publish";

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

export function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function hasMeaningfulDay(
  day: ItineraryOutput["days"][number],
): boolean {
  return [day.morning, day.lunch, day.afternoon, day.evening, day.dinner].some(
    hasText,
  );
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
  const expectedDays = edition
    ? editionDayCount(edition)
    : itinerary.days.length;
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
    const missingRainyDayAlternative = !hasText(day.rainyDayAlternative);
    const missingLowEnergyAlternative = !hasText(day.lowEnergyAlternative);
    if (missingRainyDayAlternative || missingLowEnergyAlternative) {
      findings.push(
        finding({
          id: lintId(prefix, "backup", day.day),
          severity: "polish",
          label: `Day ${day.day} needs stronger backup options`,
          editionId,
          fieldPath: `days.${dayIndex}.${
            missingRainyDayAlternative
              ? "rainyDayAlternative"
              : "lowEnergyAlternative"
          }`,
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
        message: "Generate or upload day images so the PDF feels more premium.",
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

export function listingBlockers(project: Project): string[] {
  const listing = project.listing;
  if (!listing) return ["Create the marketplace listing"];

  const blockers: string[] = [];
  if (!listing.titleOptions.some(hasText)) blockers.push("Add a listing title");
  if (!listing.tags.some(hasText)) blockers.push("Add listing tags");
  if (!hasText(listing.shortDescription))
    blockers.push("Add a short description");
  if (!hasText(listing.longDescription))
    blockers.push("Add a full description");
  if (!hasText(listing.deliveryNotes)) blockers.push("Add delivery notes");

  if (project.productionPlan.offerModel !== "digital") {
    if (
      !listing.packages.some((item) => hasText(item.name) && hasText(item.price))
    ) {
      blockers.push("Price at least one service package");
    }
    if (!listing.buyerRequirements.some(hasText)) {
      blockers.push("Add buyer requirements");
    }
  }
  return blockers;
}

/**
 * Snapshot of everything that affects sell-readiness. When it changes, the
 * publish review resets and "Ready to sell" drops back to "In progress".
 */
export function readinessFingerprint(project: Project): string {
  return JSON.stringify({
    name: project.name,
    country: project.country,
    regions: project.regions,
    positioning: project.positioning,
    targetAudience: project.targetAudience,
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
