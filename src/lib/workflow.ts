import type { Project } from "./types";
import {
  hasText,
  itineraryBlockers,
  lintProjectForPublish,
  listingBlockers,
  type WorkflowIssue,
  type WorkflowStageId,
} from "./readiness";
import { editionLabel, itineraryForEdition } from "./editions";

/**
 * Legacy 5-stage guided-workspace state machine. Slated for deletion with the
 * stepper; edition helpers live in lib/editions.ts and readiness linting in
 * lib/readiness.ts (re-exported below for existing imports).
 */

export type {
  LintFinding,
  LintSeverity,
  WorkflowIssue,
  WorkflowStageId,
} from "./readiness";
export {
  extractLiveDataClaims,
  itineraryBlockers,
  lintItinerary,
  lintProjectForPublish,
  readinessFingerprint,
} from "./readiness";
export {
  OUTPUT_LABELS,
  dayRangeForStop,
  defaultRoute,
  editionContextOptions,
  editionDayCount,
  editionExtraCities,
  editionLabel,
  editionRoute,
  itineraryForEdition,
  normalizeRoute,
  routeNights,
  routeToCities,
} from "./editions";

export type WorkflowStageStatus =
  | "not-started"
  | "in-progress"
  | "needs-attention"
  | "complete";

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
